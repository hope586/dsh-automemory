import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';
import { MemoryStore } from '../src/core/index.js';
import { normalizeSources } from '../src/validation.js';
import { installTurnMemory } from '../src/host/index.js';
import { DatabaseSync } from 'node:sqlite';

const noop = { audit_completion: 'complete', explanation: 'Selective no-change is valid.', operations: [], issues: [] };
async function setup(t, respond = () => text('acknowledged')) {
  const h = await harness(respond), home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') }); clearInterval(c.timer);
  t.after(() => h.close());
  return { h, c };
}
async function turn(agent, body) { agent.followup(message(body, `event-${body}`)); await agent.whenIdle(); }
const fileText = files => files.map(file => readFileSync(file, 'utf8')).join('\n');

test('native event hooks exclude disabled turns from Dreamer audit and earlier-context files across hosts', async t => {
  const { h, c } = await setup(t), parent = await h.agent(), w = c.bind(parent.session);
  const other = new MemoryStore({ dataDir: c.dataDir }); t.after(() => other.close());
  await turn(parent, 'ON_BEFORE_CANARY_731');
  other.setWorkspaceEnabled(w.id, false);
  await turn(parent, 'OFF_EXISTING_CANARY_731');
  const offSession = await h.agent('born-while-disabled'); await turn(offSession, 'OFF_NEW_CANARY_731');
  other.setWorkspaceEnabled(w.id, true);
  await turn(parent, 'ON_AFTER_CANARY_731');
  c.refreshPresence(); const receipt = await c.requestDream(w, true), job = c.store.claimJob({ owner: c.owner });
  assert.equal(job.id, receipt.job_id);
  assert.ok(!job.payload.evidenceRanges.some(range => range.sessionId === offSession.id));
  const first = fileText(await c.evidence(job, w));
  assert.match(first, /ON_BEFORE_CANARY_731/); assert.match(first, /ON_AFTER_CANARY_731/); assert.doesNotMatch(first, /OFF_(?:EXISTING|NEW)_CANARY_731/);
  assert.equal(c.store.completeJob({ lease: job.lease, draft: noop }).status, 'no_change'); c.cleanupEvidence(job);
  await turn(parent, 'ON_LATER_CANARY_731');
  c.refreshPresence(); await c.requestDream(w, true); const later = c.store.claimJob({ owner: c.owner });
  const files = await c.evidence(later, w), all = fileText(files);
  assert.ok(files.some(file => file.includes('-context-')), 'Earlier allowed material remains available for verification');
  assert.match(all, /ON_BEFORE_CANARY_731/); assert.match(all, /ON_LATER_CANARY_731/); assert.doesNotMatch(all, /OFF_(?:EXISTING|NEW)_CANARY_731/);
  const aliases = c.sourceAliases(later);
  for (const file of files) {
    const alias = aliases.find(item => item.path === file); assert.ok(alias);
    assert.deepEqual(normalizeSources({ source_kind: 'project_file', locator: file + '#L2' }, aliases), { source_kind: 'session_event', locator: alias.locator, version_hint: alias.version });
  }
  c.store.cancelJob({ workspaceId: w.id, jobId: later.id }); c.cleanupEvidence(later);
});

test('G2 keeps the full parent snapshot while extraction and evidence files exclude disabled intervals', async t => {
  let auditNext = false;
  const { h, c } = await setup(t, () => {
    if (auditNext) { auditNext = false; return call('memory_audit', { reason: 'Explicit audit of the completed stage' }, 'frozen-eligibility'); }
    return text('acknowledged');
  });
  const parent = await h.agent(), w = c.bind(parent.session);
  await turn(parent, 'ALLOWED_EARLY_927');
  c.store.setWorkspaceEnabled(w.id, false); await turn(parent, 'DISABLED_CONTEXT_927');
  c.store.setWorkspaceEnabled(w.id, true); auditNext = true; await turn(parent, 'ALLOWED_NEW_927');
  const queued = c.store.listJobs({ workspaceId: w.id }).find(job => job.kind === 'G2'), job = c.store.claimJob({ owner: c.owner });
  assert.equal(job.id, queued.id); assert.match(JSON.stringify(job.snapshot), /DISABLED_CONTEXT_927/, 'The full inherited effective context must not be secretly trimmed');
  const persisted = await c.host.readSession(parent.id);
  const disabled = persisted.events.find(event => event.type === 'user/message' && JSON.stringify(event.data).includes('DISABLED_CONTEXT_927'));
  assert.ok(disabled);
  const copied = fileText(await c.evidence(job, w)); assert.match(copied, /ALLOWED_EARLY_927/); assert.match(copied, /ALLOWED_NEW_927/); assert.doesNotMatch(copied, /DISABLED_CONTEXT_927/);
  // A later explicit expansion cannot change an already accepted audit cut.
  const submitted = { ...noop, operations: [{ op: 'CREATE', operation_key: 'forbidden-source', local_key: 'fact', reason: 'Visible is not eligible', source_refs: [{ source_kind: 'session_event', locator: `${parent.id}#event:${disabled.seq}` }], content: { title: 'Must reject', category: 'stable', group: 'test', index_hint: 'test', conditions: 'test', payload: { kind: 'markdown', text: 'Do not automatically extract the disabled fact.' } } }] };
  assert.equal(c.store.completeJob({ lease: job.lease, draft: submitted }).errors[0].code, 'SOURCE_SCOPE_MISMATCH');
  assert.equal(c.store.exportSnapshot(w.id).records.length, 0); c.cleanupEvidence(job);
  c.store.includeHistory({ workspaceId: w.id, sessionId: parent.id });
  assert.ok(c.store.allowedEvidenceRanges({ workspaceId: w.id, sessionId: parent.id }).some(range => disabled.seq > range.startExclusive && disabled.seq <= range.endInclusive), 'Explicit historical inclusion is a separate authorization');
});

test('legacy hook write rejection is reported as unavailable while a native ordinary turn can complete', async t => {
  const h = await harness(() => text('Ordinary conversation completed.'));
  const store = new MemoryStore({ dataDir: path.join(h.temp, 'guarded-memory') }); store.registerWorkspace({ id: 'w', root: h.temp });
  const legacy = new DatabaseSync(path.join(h.temp, 'guarded-memory', 'memory.sqlite')), errors = [];
  const denied = () => legacy.prepare('UPDATE workspaces SET enabled=0 WHERE id=?').run('w');
  const stop = installTurnMemory(h.ctx, { prepareTurn: denied, onSessionEvent: denied, onError: err => errors.push(err) });
  t.after(async () => { stop(); legacy.close(); store.close(); await h.close(); });
  const agent = await h.agent(); await turn(agent, 'No memory mutation is requested.');
  assert.equal(agent.status, 'idle'); assert.equal(h.calls.length, 1);
  assert.ok(errors.some(error => /AUTOMEMORY_RELOAD_REQUIRED/.test(error.message)));
  assert.match(JSON.stringify(h.calls[0].messages), /AutoMemory is unavailable/);
  assert.equal(store.getWorkspace('w').enabled, true);
});
