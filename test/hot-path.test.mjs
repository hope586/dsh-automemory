import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';
import { MemoryStore } from '../src/core/index.js';
import { workspaceIdentity } from '../src/identity.js';

const DAY = 86400000;
const content = body => ({ title: body, category: 'stable', index_hint: 'Read for hot-path scenario', group: 'hot-path', conditions: 'Synthetic isolated test project only', payload: { kind: 'markdown', text: body } });
const sources = [{ source_kind: 'session_event', locator: 's#event:1' }];
const create = (key, body) => ({ op: 'CREATE', operation_key: key, local_key: key, reason: 'Fixture evidence', source_refs: sources, content: content(body) });
const draft = (operations, issues = []) => ({ audit_completion: 'complete', explanation: 'Synthetic fixture evidence', operations, issues });
const noop = { audit_completion: 'complete', explanation: 'No changes.', operations: [], issues: [] };

function coreFixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automemory-hotpath-'));
  const store = new MemoryStore({ dataDir: dir });
  store.registerWorkspace({ id: 'w', root: dir });
  store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  t.after(() => { try { store.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  let serial = 0;
  return { store, submit: d => store.submit(d, { workspaceId: 'w', requestId: `r${++serial}`, channel: 'G1' }) };
}

async function controllerFixture(t, respond = () => text('fixture')) {
  const h = await harness(respond);
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') });
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'fixture-model' }, reviewer: { provider: 'fixture', model: 'fixture-model' } } });
  clearInterval(c.timer);
  t.after(async () => { await c.close(); await h.close(); });
  return { h, c, home };
}

test('duplicate or older session events open no write transaction while new events still admit evidence', t => {
  const { store } = coreFixture(t);
  let transactions = 0;
  const original = store._tx.bind(store);
  store._tx = fn => { transactions++; return original(fn); };
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 0, eventOnly: true });
  const baseline = transactions;
  assert.ok(baseline >= 1, 'A genuinely new event must still commit observation durably');
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 0, eventOnly: true });
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: -1, eventOnly: true });
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 3, hasNewEvidence: false, observeOnly: true });
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 2, eventOnly: true });
  assert.equal(transactions, baseline + 1, 'Only the observe-only advance of the observation head may write; stale duplicates stay no-ops');
  // Observation state still advances exactly as before: seq 3 observed, head 3,
  // and the out-of-order seq 2 afterwards can no longer admit anything.
  assert.equal(store.listSessions('w')[0].head_seq, 3);
  assert.deepEqual(store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's', endInclusive: 3 }), [{ startExclusive: -1, endInclusive: 0 }]);
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 4, eventOnly: true });
  assert.deepEqual(store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [{ startExclusive: -1, endInclusive: 0 }, { startExclusive: 3, endInclusive: 4 }]);
});

test('browse entries and the rendered index keep exact per-memory open-issue references', t => {
  const { store, submit } = coreFixture(t);
  const ids = [];
  for (let i = 0; i < 5; i++) {
    const receipt = submit(draft([create(`k${i}`, `fact ${i}`)]));
    assert.equal(receipt.status, 'committed');
    ids.push(receipt.results[0].memory_id);
  }
  const issue = (key, affected) => submit(draft([], [{ issue_key: key, question: `q ${key}`, context: 'fixture', affected: affected.map(id => ({ memory_id: id, observed_version: 'v1' })), source_refs: sources }]));
  const issueA = issue('i1', [ids[0], ids[1]]).issue_ids[0];
  const issueB = issue('i2', [ids[1]]).issue_ids[0];
  const ordered = [issueA, issueB].sort();
  const byId = Object.fromEntries(store.browse({ workspaceId: 'w', pageSize: 100 }).entries.map(entry => [entry.id, entry.issue_refs]));
  assert.deepEqual(byId[ids[0]], [issueA]);
  assert.deepEqual(byId[ids[1]], ordered, 'A memory referenced by two open issues lists both, in issue-id order');
  assert.deepEqual(byId[ids[2]], []);
  const bundle = store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  assert.equal(bundle.state, 'ready');
  assert.match(bundle.index_markdown, new RegExp(`unresolved: ${ordered.map(id => id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join(', ')}`));
  // Resolving one issue is reflected in the same grouped read path.
  const target = store.listIssues({ workspaceId: 'w' }).find(x => x.id === issueA);
  assert.equal(store.resolveIssue({ workspaceId: 'w', issueId: issueA, expectedVersion: target.version, requestId: 'resolve-1', context: { workspaceId: 'w', requestId: 'resolve-1', channel: 'MEMORY_UI' }, resolution: { reason: 'Current contents settle it', source_refs: sources, expected_memories: [{ memory_id: ids[0], expected_version: 'v1' }, { memory_id: ids[1], expected_version: 'v1' }] } }).status, 'committed');
  store.db.exec("UPDATE workspaces SET revision=revision+1 WHERE id='w'");
  const after = Object.fromEntries(store.browse({ workspaceId: 'w', pageSize: 100 }).entries.map(entry => [entry.id, entry.issue_refs]));
  assert.deepEqual(after[ids[1]], [issueB]);
  assert.deepEqual(after[ids[0]], []);
});

test('controller per-session bookkeeping is released when the native session is disposed', async t => {
  const { h, c } = await controllerFixture(t, (_options, calls) => calls.length <= 1 ? call('memory_read', { ids: ['missing'] }, 'read-call') : text('done'));
  const handle = await h.ctx.agents.create({ sessionId: 'lifecycle-fixture', agentOptions: { provider: 'fixture', model: 'fixture-model' }, meta: { cwd: h.temp } });
  const agent = handle.agent;
  agent.followup(message('Read a memory.', 'lifecycle-turn')); await agent.whenIdle();
  assert.equal(c.sessions.has('lifecycle-fixture'), true);
  assert.ok([...c.callSeqs.keys()].some(key => key.startsWith('lifecycle-fixture:')), 'A durable tool-call sequence was recorded');
  // A delivered read clears its own marker; a lingering one only appears when a
  // turn is interrupted before its tool result. Seed that state directly to
  // verify the disposal boundary releases it together with the rest.
  c.pendingReads.set('lifecycle-fixture:event:999', { workspaceId: c.sessions.get('lifecycle-fixture').id, results: [] });
  c.turnProfiles.set('lifecycle-fixture:7', { text: '', hash: 'fixture', enabled: true });
  await handle.dispose();
  assert.equal(h.ctx.sessions.get('lifecycle-fixture'), undefined, 'Fixture must actually dispose the native session');
  assert.equal(c.sessions.has('lifecycle-fixture'), false);
  assert.ok(![...c.callSeqs.keys()].some(key => key.startsWith('lifecycle-fixture:')), 'Tool-call sequences must not outlive their session');
  assert.ok(![...c.pendingReads.keys()].some(key => key.startsWith('lifecycle-fixture:')), 'Undelivered read markers retain memory bodies and must be released');
  assert.ok(![...c.turnProfiles.keys()].some(key => key.startsWith('lifecycle-fixture:')));
});

test('a finished job removes stale attempt evidence directories under its own root', async t => {
  const { h, c } = await controllerFixture(t, () => text(noop));
  const root = path.join(h.temp, 'sweep-project'); mkdirSync(root);  const w = workspaceIdentity(root); c.store.registerWorkspace(w);
  c.store.registerSession({ workspaceId: w.id, sessionId: 'sweep-evidence', newSession: true });
  c.store.updateSessionHead({ workspaceId: w.id, sessionId: 'sweep-evidence', headSeq: 2 });
  c.host.readSession = async () => ({ header: { cwd: root }, cursor: 2, events: [{ seq: 1, time: 0, type: 'user/message', data: message('bounded fixture evidence') }] });
  const request = await c.requestDream(w, true);
  // A previous crashed attempt (expired lease or dead worker) left its directory.
  const stale = path.join(c.dataDir, 'job-evidence', request.job_id, 'deadhost00000000-1');
  mkdirSync(stale, { recursive: true }); writeFileSync(path.join(stale, 'fragment.jsonl'), '{"leaked":"conversation projection"}');
  await c.tick(); if (c.active) await c.active;
  assert.equal(c.store.getJob(request.job_id).status, 'completed', JSON.stringify(c.errors));
  assert.equal(existsSync(stale), false, 'A terminal job must not keep a dead attempt directory');
  assert.equal(existsSync(path.join(c.dataDir, 'job-evidence', request.job_id)), false, 'The finished job root is removed entirely');
});

test('evidence sweeping keeps running jobs and removes only missing or terminal roots', async t => {
  const { h, c } = await controllerFixture(t);
  const root = path.join(h.temp, 'sweep-live'); mkdirSync(root);
  const w = workspaceIdentity(root); c.store.registerWorkspace(w);
  c.store.registerSession({ workspaceId: w.id, sessionId: 'sweep-live-evidence', newSession: true });
  c.store.updateSessionHead({ workspaceId: w.id, sessionId: 'sweep-live-evidence', headSeq: 2 });
  c.host.readSession = async () => ({ header: { cwd: root }, cursor: 2, events: [{ seq: 1, time: 0, type: 'user/message', data: message('bounded fixture evidence') }] });
  await c.requestDream(w, true);
  const job = c.store.claimJob({ owner: c.owner });
  assert.ok(job);
  const liveFiles = await c.evidence(job, w);
  assert.ok(liveFiles.length);
  const orphan = path.join(c.dataDir, 'job-evidence', 'J_unknown_never_existed');
  mkdirSync(orphan, { recursive: true }); writeFileSync(path.join(orphan, 'stale.jsonl'), '{}');
  c.sweepAllJobEvidence();
  assert.equal(existsSync(liveFiles[0]), true, 'A running job keeps its evidence until it settles');
  assert.equal(existsSync(orphan), false, 'A directory without any durable job is removed');
  c.store.cancelJob({ workspaceId: w.id, jobId: job.id });
  c.sweepAllJobEvidence();
  assert.equal(existsSync(path.dirname(liveFiles[0])), false, 'A cancelled job root is swept');
});

test('an enable switch flipped by another host between the pre-lock read and the transaction excludes the closed-period event', t => {
  // Reproduces the coordinator's dual-connection interleave: host B flips the
  // workspace switch after host A's no-op fast path read its snapshot but
  // before A's BEGIN IMMEDIATE. The admission decision must be re-read under
  // the write lock, never from the pre-lock snapshot.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automemory-interleave-'));
  const a = new MemoryStore({ dataDir: dir }), b = new MemoryStore({ dataDir: dir });
  t.after(() => { try { a.close(); b.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  a.registerWorkspace({ id: 'w', root: dir });
  a.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  let armed = true;
  const enterTx = a._tx.bind(a);
  a._tx = fn => { if (armed) { armed = false; b.setWorkspaceEnabled('w', false); } return enterTx(fn); };
  a.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 0, eventOnly: true });
  assert.deepEqual(a.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [], 'An event whose admission transaction runs after the switch turned off must not become eligible evidence');
  // While disabled, further events advance observation only.
  a.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1, eventOnly: true });
  assert.deepEqual(a.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), []);
  // Re-enabling must not retroactively admit the closed-period events; the
  // next live event starts a fresh admitted range with the gap preserved.
  b.setWorkspaceEnabled('w', true);
  a.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 2, eventOnly: true });
  assert.deepEqual(a.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [{ startExclusive: 1, endInclusive: 2 }]);
  assert.equal(a.getWorkspace('w').enabled, true);
});

test('an expired-lease worker coexisting with a running successor never removes its evidence', async t => {
  const { h, c } = await controllerFixture(t);
  const root = path.join(h.temp, 'sweep-coexist'); mkdirSync(root);
  const w = workspaceIdentity(root); c.store.registerWorkspace(w);
  c.store.registerSession({ workspaceId: w.id, sessionId: 'coexist-evidence', newSession: true });
  c.store.updateSessionHead({ workspaceId: w.id, sessionId: 'coexist-evidence', headSeq: 2 });
  c.host.readSession = async () => ({ header: { cwd: root }, cursor: 2, events: [{ seq: 1, time: 0, type: 'user/message', data: message('bounded fixture evidence') }] });
  await c.requestDream(w, true);
  let now = Date.now(); c.store.clock = () => now;
  const old = c.store.claimJob({ owner: 'old-host', leaseMs: 10 });
  assert.ok(old);
  const oldDir = c.evidenceDirectory(old);
  await c.evidence(old, w);
  assert.equal(existsSync(oldDir), true);
  now += 60001;
  const successor = c.store.claimJob({ owner: 'new-host' });
  assert.ok(successor); assert.notEqual(successor.lease.token, old.lease.token);
  const successorDir = c.evidenceDirectory(successor);
  await c.evidence(successor, w);
  assert.equal(existsSync(successorDir), true);
  // The old worker unwinds only after its lease was replaced: its failure write
  // is rejected as stale, and the sweep that follows must observe the job as
  // running under the successor instead of trusting the old attempt's own state.
  assert.throws(() => c.store.failJob({ lease: old.lease, code: 'STALE_WORKER_UNWIND', message: 'Old worker unwinding after lease replacement.' }), { code: 'STALE_LEASE' });
  c.sweepJobEvidence(old.id);
  c.sweepAllJobEvidence();
  assert.equal(existsSync(successorDir), true, 'A running successor keeps its evidence when the expired worker unwinds');
  assert.equal(existsSync(oldDir), true, 'While the job is alive even the replaced attempt directory is kept conservatively');
  // Once the successor settles terminally, the whole job root is removed.
  c.store.completeJob({ lease: successor.lease, draft: noop });
  c.sweepJobEvidence(successor.id);
  assert.equal(existsSync(path.join(c.dataDir, 'job-evidence', successor.id)), false);
});
