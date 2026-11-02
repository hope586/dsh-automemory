import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import { harness, text } from './fixtures/harness.mjs';
import { apply, stateFor } from '../lib/index.js';
import { workspaceIdentity } from '../src/identity.js';

const route = { provider: 'zai-fixture', model: 'configured-exact-model' };
const noop = { audit_completion: 'complete', explanation: 'No durable change.', operations: [], issues: [] };
class LocalModel extends LlmAdapter {
  constructor(calls, respond = () => noop) { super(); this.calls = calls; this.respond = respond; }
  async *stream(options) {
    this.calls.push(options);
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'block-end', index: 0, block: { type: 'text', text: JSON.stringify(this.respond(options)) } };
    yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}
async function pair(t) {
  const shared = await mkdtemp(path.join(os.tmpdir(), 'automemory-model-routing-'));
  const web = await harness(() => text('unused'), { root: shared }), desktop = await harness(() => text('unused'), { root: shared });
  const home = path.join(shared, 'memory-home'), dataDir = path.join(home, 'automemory');
  const wc = apply(web.ctx, { dshHome: home, dataDir }), dc = apply(desktop.ctx, { dshHome: home, dataDir });
  clearInterval(wc.timer); clearInterval(dc.timer);
  t.after(async () => { await wc.close(); await dc.close(); await web.close(); await desktop.close(); await rm(shared, { recursive: true, force: true }); });
  const root = path.join(shared, 'project'); await mkdir(root);
  const workspace = workspaceIdentity(root); wc.store.registerWorkspace(workspace);
  wc.settings.set({ models: { dreamer: route, reviewer: route } });
  return { web, desktop, wc, dc, workspace };
}

test('two hosts share a queue but only the host with the frozen route claims and completes Dreamer', async t => {
  const { web, desktop, wc, dc, workspace } = await pair(t), calls = [];
  const file = path.join(workspace.root, 'decision.txt'); await writeFile(file, 'A fixture-only user decision.');
  const draft = { audit_completion: 'complete', explanation: 'A fixture project decision.', operations: [{ op: 'CREATE', operation_key: 'decision', local_key: 'decision', reason: 'Explicit fixture decision.', source_refs: [{ source_kind: 'project_file', locator: file }], content: { title: 'Fixture decision', category: 'stable', group: 'workflow', index_hint: 'Read for this fixture', conditions: 'Only the fixture', payload: { kind: 'markdown', text: 'Use the agreed release gate.' } } }], issues: [] };
  desktop.ctx.llm.registerAdapter([route.provider], new LocalModel(calls, options => {
    if (!options.sessionId.startsWith('automemory-reviewer-')) return draft;
    const input = options.messages.flatMap(message => message.content).map(block => block.text || '').join('\n');
    return { candidate_id: input.match(/"candidate_id":"([a-f0-9]+)"/)[1], findings: [], checked_sources: draft.operations[0].source_refs, limitations: [] };
  }));
  const accepted = await dc.requestDream(workspace, true);
  await wc.tick(); if (wc.active) await wc.active;
  const waiting = dc.store.getJob(accepted.job_id);
  assert.equal(waiting.status, 'queued'); assert.equal(waiting.token, 0); assert.equal(waiting.owner, null); assert.equal(waiting.started_at, null);
  assert.equal(dc.store.getWorkspace(workspace.id).last_dream_started, null);
  assert.equal(waiting.deferral.code, 'HOST_MODEL_UNAVAILABLE'); assert.equal(waiting.deferral.missingRoutes.length, 2);
  assert.match(waiting.deferral.message, /Waiting for a host/);
  assert.equal((await stateFor(wc, { workspaceId: workspace.id })).jobs[0].deferral.code, 'HOST_MODEL_UNAVAILABLE');
  assert.equal(wc.settings.usage().length, 0); assert.equal(wc.store.listRoleSessions().length, 0); assert.equal(web.calls.length, 0);
  await dc.tick(); await dc.active;
  const completed = wc.store.getJob(accepted.job_id);
  assert.equal(completed.status, 'completed', JSON.stringify(dc.errors)); assert.equal(completed.deferral, undefined);
  assert.equal(calls.length, 3); assert.equal(web.calls.length, 0);
  assert.ok(wc.store.listRoleSessions().every(row => row.owner === dc.owner));
  assert.equal(wc.store.exportSnapshot(workspace.id).records.length, 1);
});

test('job eligibility uses frozen G2 inherited or override routes and both Dreamer stages', async t => {
  const { wc, dc, workspace } = await pair(t), calls = [];
  dc.ctx.llm.registerAdapter([route.provider], new LocalModel(calls));
  const queued = await wc.requestDream(workspace, true), job = wc.store.getJob(queued.job_id);
  wc.settings.set({ models: { dreamer: { provider: 'fixture', model: 'new-setting' }, reviewer: { provider: 'fixture', model: 'new-setting' } } });
  assert.deepEqual(wc.jobModelRoutes(job).map(item => item.route), [route, route], 'Later settings do not silently reroute an accepted job');
  const frozen = { ...job, kind: 'G2', payload: { models: { g2: null } }, snapshot: { route } };
  assert.deepEqual(wc.jobModelRoutes(frozen), [{ role: 'G2', route }]);
  const override = { provider: 'fixture', model: 'override' };
  assert.deepEqual(wc.jobModelRoutes({ ...frozen, payload: { models: { g2: override } } }), [{ role: 'G2', route: override }]);
  const map = new Map([[wc.modelRouteKey(route), await dc.host.checkModelRoute(route)]]);
  assert.equal(wc.jobEligibility(frozen, map).eligible, false, 'A stale positive result from another host never grants local provider registration');
  assert.equal(dc.jobEligibility(frozen, map).eligible, true);
  assert.equal(calls.length, 0);
});

test('a route removed after claim is durably deferred with zero calls and can resume on the same job', async t => {
  const { desktop, dc, workspace } = await pair(t), calls = [];
  let remove = desktop.ctx.llm.registerAdapter([route.provider], new LocalModel(calls));
  const nativeRun = dc.host.runRole; let shouldRemove = true;
  dc.host.runRole = input => {
    if (!shouldRemove) return nativeRun(input);
    const planned = input.onSessionPlanned;
    return nativeRun({ ...input, onSessionPlanned: async info => { await planned(info); shouldRemove = false; remove(); } });
  };
  const accepted = await dc.requestDream(workspace, true); await dc.tick(); await dc.active;
  const waiting = dc.store.getJob(accepted.job_id), retained = dc.store.getJobArtifacts(waiting.id);
  assert.equal(waiting.status, 'queued', JSON.stringify(dc.errors)); assert.equal(waiting.error, null); assert.equal(waiting.deferral.code, 'HOST_MODEL_UNAVAILABLE');
  assert.equal(calls.length, 0); assert.equal(dc.settings.usage().length, 0);
  assert.equal(retained['candidate-input-meta'], undefined); assert.equal(retained['candidate-session'], undefined);
  assert.equal(retained['candidate-deferred-1'].usage.status, 'deferred'); assert.deepEqual(retained['candidate-deferred-1'].usage.requests, []);
  assert.ok(retained['candidate-deferred-1'].session.sessionId); assert.equal(dc.store.listRoleSessions()[0].state, 'settled');
  remove = desktop.ctx.llm.registerAdapter([route.provider], new LocalModel(calls));
  await dc.tick(); await dc.active;
  assert.equal(dc.store.getJob(accepted.job_id).status, 'completed', JSON.stringify(dc.errors));
  assert.equal(dc.store.getJob(accepted.job_id).token, 2); assert.equal(calls.length, 1);
  assert.ok(dc.store.getJobArtifacts(accepted.job_id)['candidate-deferred-1'], 'Keep the zero-call failed-host attempt diagnosable');
});

test('recovery completes a durable zero-call deferral left before the queue transition', async t => {
  const { desktop, dc, workspace } = await pair(t), calls = [];
  desktop.ctx.llm.registerAdapter([route.provider], new LocalModel(calls));
  let now = Date.now(); dc.store.clock = () => now;
  const accepted = await dc.requestDream(workspace, true), old = dc.store.claimJob({ owner: 'crashed-before-requeue', leaseMs: 1 });
  dc.store.saveJobArtifact({ lease: old.lease, stage: 'candidate-input-meta', value: { promptHash: 'proven-unpaid-fixture' } });
  dc.store.saveJobArtifact({ lease: old.lease, stage: 'candidate-session', value: { sessionId: 'automemory-dreamer-never-dispatched' } });
  dc.store.saveJobArtifact({ lease: old.lease, stage: 'candidate-usage', value: { status: 'deferred', requests: [], usage: [], error: { code: 'HOST_MODEL_UNAVAILABLE', message: 'Provider was removed before dispatch.' } } });
  now += 2;
  await dc.tick(); await dc.active;
  assert.equal(dc.store.getJob(accepted.job_id).status, 'queued', JSON.stringify(dc.errors)); assert.equal(calls.length, 0);
  assert.ok(dc.store.getJobArtifacts(accepted.job_id)['candidate-deferred-1']);
  await dc.tick(); await dc.active;
  assert.equal(dc.store.getJob(accepted.job_id).status, 'completed', JSON.stringify(dc.errors)); assert.equal(calls.length, 1);
});
