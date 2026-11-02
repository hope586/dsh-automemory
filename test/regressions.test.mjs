import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply, actionFor, stateFor } from '../lib/index.js';
import { SettingsStore } from '../src/settings.js';
import { UserProfileStore } from '../src/user-profile.js';
import { normalizeSources } from '../src/validation.js';
import { MemoryStore } from '../src/core/index.js';

const DAY = 86400000;
const sourceRefs = [{ source_kind: 'session_event', locator: 'parent#event:1' }];
const memoryContent = body => ({ title: body, category: 'stable', index_hint: 'Read for regression scenario', group: 'regression', conditions: 'Synthetic isolated test project only', payload: { kind: 'markdown', text: body } });
const createDraft = (body = 'regression memory') => ({ audit_completion: 'complete', explanation: 'Synthetic fixture evidence', operations: [{ op: 'CREATE', operation_key: 'create', local_key: 'entry', reason: 'A fixture project decision', source_refs: sourceRefs, content: memoryContent(body) }], issues: [] });
const noop = { audit_completion: 'complete', explanation: 'No additional changes', operations: [], issues: [] };

async function setup(t, respond = () => text('done')) {
  const h = await harness(respond);
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') });
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'fixture-model' }, reviewer: { provider: 'fixture', model: 'fixture-model' } } });
  clearInterval(c.timer);
  t.after(() => h.close());
  return { h, c, home };
}

test('regression: repeated model callId in different native turns binds two distinct durable requests', async t => {
  let step = 0;
  const { h, c } = await setup(t, () => {
    step++;
    if (step === 1) return call('memory_submit', { draft: createDraft('first independent fact') }, 'provider-reused-call-id');
    if (step === 3) return call('memory_submit', { draft: createDraft('second independent fact') }, 'provider-reused-call-id');
    return text('done');
  });
  const agent = await h.agent();
  agent.followup(message('Remember the first fact.', 'first-user-turn')); await agent.whenIdle();
  agent.followup(message('Remember a separate second fact.', 'second-user-turn')); await agent.whenIdle();
  const w = c.bind(agent.session);
  const records = c.store.exportSnapshot(w.id).records;
  assert.equal(records.length, 2, JSON.stringify(c.errors));
  assert.deepEqual(new Set(records.map(r => r.content.payload.text)), new Set(['first independent fact', 'second independent fact']));
  const receipts = c.store.db.prepare('SELECT request_id,receipt FROM receipts WHERE workspace_id=? ORDER BY request_id').all(w.id);
  assert.equal(receipts.length, 2); assert.notEqual(receipts[0].request_id, receipts[1].request_id);
  assert.ok(receipts.every(r => /^parent:event:\d+$/.test(r.request_id) && JSON.parse(r.receipt).status === 'committed'));
});

test('regression: G2 memory.read is audited only after the actual native tool result is admitted', async t => {
  let c, target, parentSteps = 0, auditSteps = 0;
  const auditCountsAtRequests = [];
  const initialized = await setup(t, options => {
    if (options.sessionId === 'parent') return ++parentSteps === 1 ? call('memory_audit', { reason: 'Complete a synthetic stage' }, 'g2-request') : text('future parent output');
    if (options.sessionId.startsWith('automemory-g2-')) {
      auditCountsAtRequests.push(c.store.listActivity({ workspaceId: target.workspaceId, channel: 'ALL' }).filter(x => x.event_type === 'memory.read').length);
      return ++auditSteps === 1 ? call('memory_read', { ids: [target.id] }, 'background-read') : text(noop);
    }
    throw new Error('Unexpected model role');
  });
  c = initialized.c; const h = initialized.h;
  const agent = await h.agent(), w = c.bind(agent.session);
  const created = c.store.submit(createDraft('READ_BODY_MUST_NOT_ENTER_AUDIT_924'), { workspaceId: w.id, requestId: 'seed', channel: 'G1' });
  target = { workspaceId: w.id, id: created.results[0].memory_id };
  agent.followup(message('Audit this stage.', 'stage')); await agent.whenIdle();
  await c.tick(); await c.active;
  assert.deepEqual(auditCountsAtRequests, [0, 1], JSON.stringify(c.errors));
  const reads = c.store.listActivity({ workspaceId: w.id, channel: 'ALL' }).filter(x => x.event_type === 'memory.read');
  assert.equal(reads.length, 1); assert.equal(reads[0].metadata.role, 'g2');
  assert.equal(reads[0].metadata.items[0].memory_id, target.id); assert.equal(reads[0].metadata.items[0].body_provided, true);
  assert.ok(!JSON.stringify(reads).includes('READ_BODY_MUST_NOT_ENTER_AUDIT_924'));
  assert.equal(c.store.db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE session_id LIKE ?').get('automemory-%').n, 0);
  const job = c.store.listJobs({ workspaceId: w.id })[0]; assert.equal(job.status, 'completed', JSON.stringify({ job, errors: c.errors }));
  const meta = c.store.getJobArtifacts(job.id)['audit-input-meta'];
  assert.match(meta.promptHash, /^[a-f0-9]{64}$/); assert.match(meta.schemaHash, /^[a-f0-9]{64}$/);
});

test('regression: stateFor exposes issue text, before/after changes, sources and the independent review', async t => {
  const { h, c } = await setup(t); const agent = await h.agent(), w = c.bind(agent.session);
  const created = c.store.submit(createDraft('old project value'), { workspaceId: w.id, requestId: 'base', channel: 'G1' });
  const memory = c.store.read({ workspaceId: w.id, ids: [created.results[0].memory_id] })[0].record;
  const issue = { issue_key: 'question', question: 'Which condition should apply?', context: 'Two synthetic conditions conflict.', affected: [{ memory_id: memory.id, observed_version: memory.version }], source_refs: sourceRefs, options: ['A', 'B'] };
  assert.equal(c.store.submit({ ...noop, issues: [issue] }, { workspaceId: w.id, requestId: 'issue', channel: 'G1' }).status, 'committed');
  // This test exercises receipt/UI mapping only, not extraction from native
  // evidence. The dedicated evidence tests cover controller-owned scope.
  c.store.enqueueJob({ workspaceId: w.id, kind: 'DREAMING', requestId: 'ui-mapping-fixture', manual: true });
  const job = c.store.claimJob({ owner: 'regression-fixture' });
  const review = { candidate_id: 'fixture-candidate', findings: [], checked_sources: sourceRefs, limitations: ['Synthetic review for UI mapping only'] };
  c.store.saveJobArtifact({ lease: job.lease, stage: 'review', value: review });
  const changed = { ...noop, operations: [{ op: 'UPDATE', operation_key: 'update', target_id: memory.id, expected_version: memory.version, reason: 'Updated project evidence', source_refs: sourceRefs, content: memoryContent('new project value') }] };
  assert.equal(c.store.completeJob({ lease: job.lease, draft: changed }).status, 'committed');
  const state = await stateFor(c, agent.id);
  assert.equal(state.issues[0].question, issue.question); assert.equal(state.issues[0].context, issue.context);
  assert.deepEqual(state.issues[0].affected, issue.affected); assert.deepEqual(state.issues[0].source_refs, sourceRefs);
  assert.equal(state.activity.length, 2);
  assert.equal(state.activity[1].channel, 'G1');
  assert.match(state.activity[0].before, /old project value/); assert.match(state.activity[0].after, /new project value/);
  assert.deepEqual(state.activity[0].review, review); assert.deepEqual(state.activity[0].source_refs, sourceRefs);
  assert.equal(state.activity[0].reason, 'Updated project evidence');
});

test('regression: failed automatic Dreamer can enqueue a new daily attempt without new evidence', async t => {
  const { h, c } = await setup(t); const agent = await h.agent();
  agent.followup(message('A project decision worth checking later.')); await agent.whenIdle();
  const w = c.bind(agent.session), initial = c.store.getWorkspace(w.id);
  let now = initial.created_at + DAY + 10; c.store.clock = () => now;
  const first = await c.requestDream(w, false), firstJob = c.store.claimJob({ owner: 'attempt-one' });
  assert.equal(firstJob.id, first.job_id);
  c.store.failJob({ lease: firstJob.lease, code: 'REVIEW_UNAVAILABLE', message: 'Synthetic reviewer outage' });
  const afterFailure = c.store.getWorkspace(w.id); assert.equal(afterFailure.dirty_seq, initial.dirty_seq);
  now += DAY + 1;
  const second = await c.requestDream(w, false);
  assert.equal(second.status, 'accepted'); assert.notEqual(second.job_id, first.job_id);
  assert.equal(c.store.getJob(first.job_id).status, 'failed'); assert.equal(c.store.getJob(second.job_id).status, 'queued');
  assert.equal(c.store.getWorkspace(w.id).dirty_seq, initial.dirty_seq);
});

test('regression: global clear keeps external cleanup pending and revoked profile requests cannot resurrect', async t => {
  const { h, c, home } = await setup(t); const agent = await h.agent(), w = c.bind(agent.session);
  const create = { text: 'GLOBAL_PRIVATE_CANARY_305', expectedHash: c.profile.read().hash, requestId: 'profile-old', reason: 'Synthetic preference', sources: [] };
  assert.equal(c.profile.update(create).status, 'committed');
  const cleared = c.profile.clear({ expectedHash: c.profile.read().hash, requestId: 'profile-clear', authorized: true, externalCleanupRequired: true });
  assert.equal(cleared.cleanup_status, 'incomplete');
  const scrub = c.store.scrubRuntimeCopies.bind(c.store);
  c.store.scrubRuntimeCopies = workspaceId => ({ workspace_id: workspaceId, cleanup_status: 'incomplete' });
  await assert.rejects(() => c.cleanupGlobal('profile-clear'), { code: 'CLEANUP_INCOMPLETE' });
  assert.equal(c.profile.settings().cleanupRequest, 'profile-clear');
  const other = new UserProfileStore({ dshHome: home, dataDir: c.dataDir }); t.after(() => other.close());
  assert.equal(other.settings().cleanupRequest, 'profile-clear');
  assert.equal(other.update(create).status, 'rejected'); assert.equal(other.read().text, '');
  c.store.scrubRuntimeCopies = scrub;
  const completed = await c.cleanupGlobal('profile-clear');
  assert.equal(completed.cleanup_status, 'complete'); assert.equal(other.settings().cleanupRequest, null);
  assert.equal(other.update(create).status, 'rejected');
  // A stale duplicate cleanup must not wipe work created after the completed clear.
  const queued = c.store.enqueueJob({ workspaceId: w.id, kind: 'DREAMING', requestId: 'new-after-clear', manual: true });
  const futureAbort = new AbortController(); c.jobAbort = futureAbort;
  await c.cleanupGlobal('profile-clear');
  assert.equal(c.store.getJob(queued.job_id).status, 'queued');
  assert.equal(futureAbort.signal.aborted, false, 'A completed cleanup replay must not cancel a later role');
  c.jobAbort = null;
});

test('regression: shared settings reject stale CAS and field-specific profile toggles preserve other fields', async t => {
  const { h, c, home } = await setup(t); const agent = await h.agent(); c.bind(agent.session);
  const other = new SettingsStore(c.dataDir); t.after(() => other.close());
  const old = other.get();
  const changed = c.settings.set({ revision: old.revision, dreamIntervalHours: 48 });
  assert.equal(changed.dreamIntervalHours, 48);
  assert.throws(() => other.set({ ...old, auditRetentionDays: 90 }), { code: 'VERSION_CONFLICT' });
  assert.equal(c.settings.get().auditRetentionDays, 30);
  other.set({ auditRetentionDays: 60 });
  assert.equal(c.settings.get().dreamIntervalHours, 48); assert.equal(c.settings.get().auditRetentionDays, 60);
  const profile = new UserProfileStore({ dshHome: home, dataDir: c.dataDir }); t.after(() => profile.close());
  await actionFor(c, { sessionId: agent.id, action: 'user-profile-toggle', autoWrite: false });
  profile.configure({ enabled: false });
  assert.equal(c.profile.settings().enabled, false); assert.equal(c.profile.settings().autoWrite, false);
  await actionFor(c, { sessionId: agent.id, action: 'user-profile-toggle', autoWrite: true });
  assert.equal(profile.settings().enabled, false); assert.equal(profile.settings().autoWrite, true);
});

test('regression: overlapping scheduler ticks cannot launch two jobs through one controller', async t => {
  const { h, c } = await setup(t);
  const now = Date.now(); c.store.clock = () => now - DAY - 100;
  for (const workspaceId of ['parallel-a', 'parallel-b']) {
    c.store.registerWorkspace({ id: workspaceId, root: path.join(h.temp, workspaceId) });
    c.store.registerSession({ workspaceId, sessionId: workspaceId, newSession: true });
    c.store.updateSessionHead({ workspaceId, sessionId: workspaceId, headSeq: 1 });
  }
  c.store.clock = Date.now;
  let release; const blocked = new Promise(resolve => { release = resolve; });
  const starts = [], runs = [];
  c.executeJob = job => {
    starts.push(job.id);
    const running = (async () => { await blocked; return c.store.completeJob({ lease: job.lease, draft: noop }); })();
    runs.push(running); return running;
  };
  try { await Promise.all([c.tick(), c.tick()]); }
  finally { release(); await Promise.allSettled(runs); if (c.active) await c.active; }
  assert.equal(starts.length, 1, 'Concurrent ticks must coalesce before claimJob, not overwrite active/jobAbort with another project');
});

test('regression: close drains a scheduler already awaiting before it closes shared stores', async t => {
  const { h, c } = await setup(t);
  c.store.clock = () => Date.now() - DAY - 100;
  c.store.registerWorkspace({ id: 'closing-project', root: path.join(h.temp, 'project') });
  c.store.registerSession({ workspaceId: 'closing-project', sessionId: 'closing-session', newSession: true });
  c.store.updateSessionHead({ workspaceId: 'closing-project', sessionId: 'closing-session', headSeq: 1 });
  c.store.clock = Date.now;
  let release, entered; const gate = new Promise(resolve => { release = resolve; }); const reached = new Promise(resolve => { entered = resolve; });
  const request = c.requestDream.bind(c);
  c.requestDream = async (...args) => { entered(); await gate; return request(...args); };
  let launched = 0; c.executeJob = async () => { launched++; return noop; };
  const ticking = c.tick(); await reached;
  const closing = c.close();
  assert.equal(c.close(), closing, 'Repeated close must await the same teardown instead of resolving early');
  release();
  await Promise.all([ticking, closing]);
  assert.equal(launched, 0, 'No new job may start after close begins');
  assert.equal(c.closed, true);
});

test('regression: source normalization preserves semantic content and binds only exact generated evidence aliases', () => {
  const original = createDraft('The factual body and its own date 2024-06-01 stay unchanged.');
  original.operations[0].source_refs = [
    { source_kind: 'project_file', locator: '/tmp/selected-evidence.jsonl#L7', observed_at: '2040-01-01T00:00:00Z' },
    { source_kind: 'project_file', locator: '/tmp/selected-evidence.jsonl.unrelated', version_hint: 'real-project-version', observed_at: '2026-10-30T00:00:00Z' },
  ];
  const normalized = normalizeSources(original, [{ path: '/tmp/selected-evidence.jsonl', locator: 'session-real#events:3-20', version: 'frozen-through-event:20' }]);
  assert.deepEqual(normalized.operations[0].content, original.operations[0].content);
  assert.equal(normalized.operations[0].reason, original.operations[0].reason);
  assert.deepEqual(normalized.operations[0].source_refs[0], { source_kind: 'session_event', locator: 'session-real#events:3-20', version_hint: 'frozen-through-event:20' });
  assert.deepEqual(normalized.operations[0].source_refs[1], { source_kind: 'project_file', locator: '/tmp/selected-evidence.jsonl.unrelated', version_hint: 'real-project-version' });
  assert.equal(original.operations[0].source_refs[0].observed_at, '2040-01-01T00:00:00Z', 'Normalization must not mutate the original model artifact');
  assert.deepEqual(normalizeSources(normalized, [{ path: '/tmp/selected-evidence.jsonl', locator: 'session-real#events:3-20', version: 'frozen-through-event:20' }]), normalized);
});

test('regression: malformed negative provider usage never frees reserved daily budget', async t => {
  const { c } = await setup(t);
  c.settings.set({ budget: { maxDailyTokens: 2000 } });
  c.settings.reserve('malformed-usage', 1500);
  try { c.settings.settle('malformed-usage', { totalTokens: -500 }, -500); } catch (error) { assert.match(error.code || '', /USAGE|BUDGET|INVALID/); }
  assert.throws(() => c.settings.reserve('next-call', 1000), { code: 'MODEL_BUDGET_EXCEEDED' });
});

async function finishedRole(c, workspace, requestId, { fail = false } = {}) {
  c.store.enqueueJob({ workspaceId: workspace.id, kind: 'DREAMING', requestId, manual: true });
  const job = c.store.claimJob({ owner: c.owner, workspaceId: workspace.id });
  try {
    await c.run(job, 'candidate', 'DREAMER', { workspace, model: { provider: 'fixture', model: 'fixture-model' }, prompt: 'Synthetic private background context ROLE_COPY_815', evidencePaths: [] });
    if (fail) c.store.failJob({ lease: job.lease, code: 'SYNTHETIC_POST_MODEL_FAILURE', message: 'The role completed but the job failed afterward' });
    else c.store.completeJob({ lease: job.lease, draft: noop });
  } catch (error) { c.store.failJob({ lease: job.lease, code: error.code || 'FIXTURE_ERROR', message: error.message }); throw error; }
  return c.store.listRoleSessions({ workspaceId: workspace.id }).find(row => row.job_id === job.id);
}

test('regression: project DELETE clears native role logs from completed and failed jobs but retains the original user session', async t => {
  const { h, c } = await setup(t, () => text(noop)); const agent = await h.agent(), w = c.bind(agent.session);
  const roles = [await finishedRole(c, w, 'finished-role'), await finishedRole(c, w, 'failed-role', { fail: true })];
  for (const role of roles) { assert.equal(role.state, 'settled'); assert.ok(await h.ctx.sessionPersistence.stat(role.session_id)); }
  const created = c.store.submit(createDraft('PRIVATE_PROJECT_COPY_815'), { workspaceId: w.id, requestId: 'seed-for-delete', channel: 'G1' });
  const memory = c.store.read({ workspaceId: w.id, ids: [created.results[0].memory_id] })[0].record;
  const draft = { ...noop, operations: [{ op: 'DELETE', operation_key: 'delete', target_id: memory.id, expected_version: memory.version, reason: 'Synthetic authorized clearing', source_refs: sourceRefs }] };
  const receipt = c.store.submit(draft, { workspaceId: w.id, requestId: 'delete-with-role-copies', channel: 'MEMORY_UI', deleteAuthorization: { requestRef: 'fixture-user-request', ids: [memory.id] }, externalCleanupRequired: true });
  assert.equal(receipt.cleanup_status, 'incomplete');
  assert.equal(c.store.completeExternalCleanup({ workspaceId: w.id, requestId: receipt.request_id }).cleanup_status, 'incomplete', 'Host acknowledgement alone cannot hide native role copies');
  assert.deepEqual(c.store.getJobArtifacts(roles[0].job_id), {});
  assert.equal(c.store.listRoleSessions({ workspaceId: w.id, pendingOnly: true }).length, 2, 'Deletion must preserve cleanup identities after artifacts are removed');
  await c.cleanupRoleSessions(w.id);
  assert.equal(c.store.completeExternalCleanup({ workspaceId: w.id, requestId: receipt.request_id }).cleanup_status, 'complete');
  for (const role of roles) assert.equal(await h.ctx.sessionPersistence.stat(role.session_id), undefined);
  assert.ok(await h.ctx.sessionPersistence.stat(agent.id), 'Original user conversation is outside the role-copy cleanup');
});

test('regression: global role-log cleanup retries after restart and completed replay leaves new role sessions intact', async t => {
  const { h, c } = await setup(t, () => text(noop)); const agent = await h.agent(), w = c.bind(agent.session);
  const role = await finishedRole(c, w, 'global-role');
  c.profile.update({ text: 'GLOBAL_ROLE_COPY_815', expectedHash: c.profile.read().hash, requestId: 'global-seed', reason: 'Fixture', sources: [] });
  c.profile.clear({ expectedHash: c.profile.read().hash, requestId: 'global-native-clear', authorized: true, externalCleanupRequired: true });
  const realDelete = c.host.deleteRoleSession; c.host.deleteRoleSession = async () => { throw Object.assign(new Error('Synthetic unavailable persistence backend'), { code: 'ROLE_SESSION_CLEANUP_UNAVAILABLE' }); };
  await assert.rejects(c.cleanupGlobal('global-native-clear'), { code: 'CLEANUP_INCOMPLETE' });
  assert.equal(c.profile.settings().cleanupRequest, 'global-native-clear');
  assert.ok(await h.ctx.sessionPersistence.stat(role.session_id));
  c.store.close(); c.store = new MemoryStore({ dataDir: c.dataDir });
  assert.equal(c.store.listRoleSessions({ pendingOnly: true })[0].session_id, role.session_id);
  c.host.deleteRoleSession = realDelete;
  assert.equal((await c.cleanupGlobal('global-native-clear')).cleanup_status, 'complete');
  assert.equal(await h.ctx.sessionPersistence.stat(role.session_id), undefined);
  const future = await finishedRole(c, w, 'future-role-after-clear');
  await c.cleanupGlobal('global-native-clear');
  assert.ok(await h.ctx.sessionPersistence.stat(future.session_id), 'Completed global clear replay cannot remove a later role');
});

test('regression: a live planned role cannot become deleted before its creation settles; retention excludes running recovery dependencies', async t => {
  const { h, c } = await setup(t, () => text(noop)); const agent = await h.agent(), w = c.bind(agent.session);
  const expired = await finishedRole(c, w, 'retained-finished');
  c.store.enqueueJob({ workspaceId: w.id, kind: 'DREAMING', requestId: 'still-creating', manual: true });
  const active = c.store.claimJob({ owner: c.owner, workspaceId: w.id });
  const sessionId = 'automemory-dreamer-planned-create-window';
  const storage = { name: h.ctx.sessionPersistence.name, root: realpathSync.native(h.ctx.sessionPersistence.root) };
  c.store.planRoleSession({ lease: active.lease, sessionId, role: 'DREAMER', storage });
  c.store.clock = () => Date.now() + 31 * DAY;
  c.store.pruneAudit();
  assert.deepEqual(c.store.listRoleSessions({ pendingOnly: true }).map(row => row.session_id), [expired.session_id]);
  await c.cleanupRoleSessions(w.id);
  assert.equal(await h.ctx.sessionPersistence.stat(expired.session_id), undefined);
  c.store.scrubRuntimeCopies(w.id, { requestId: 'clear-live-plan' });
  await assert.rejects(c.cleanupRoleSessions(w.id), { code: 'CLEANUP_INCOMPLETE' });
  assert.equal(c.store.listRoleSessions({ pendingOnly: true })[0].state, 'planned');
  c.store.settleRoleSession({ sessionId, owner: c.owner });
  await c.cleanupRoleSessions(w.id);
  assert.equal(c.store.completeRuntimeCleanup({ workspaceId: w.id, requestId: 'clear-live-plan' }).cleanup_status, 'complete');
  assert.throws(() => c.store.planRoleSession({ lease: active.lease, sessionId: 'automemory-dreamer-late-seed', role: 'DREAMER', storage }), { code: 'STALE_LEASE' });
});

test('regression: loading AutoMemory during an existing native generation does not claim an idle Dreamer', async t => {
  let release, entered;
  const gate = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  const h = await harness(async () => { entered(); await gate; return text('done'); });
  t.after(() => h.close());
  const agent = await h.agent();
  agent.followup(message('A foreground generation began before the plugin loaded.')); await reached;
  const home = path.join(h.temp, 'reloaded-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') }); clearInterval(c.timer);
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'fixture-model' }, reviewer: { provider: 'fixture', model: 'fixture-model' } } });
  const w = c.bind(agent.session); await c.requestDream(w, true);
  let claims = 0;
  c.executeJob = async job => { claims++; return c.store.completeJob({ lease: job.lease, draft: noop }); };
  try {
    assert.equal(agent.status, 'running'); await c.tick(); if (c.active) await c.active;
    assert.equal(claims, 0, 'Missed turn/start must be recovered from the current public Agent status');
  } finally { release(); await agent.whenIdle(); }
  await c.tick(); if (c.active) await c.active;
  assert.equal(claims, 1, 'The queued job becomes eligible after native foreground generation finishes');
});

test('regression: an upgrade imports old role-session artifacts before deleting the artifacts', async t => {
  const { h, c } = await setup(t, () => text(noop)); const agent = await h.agent(), w = c.bind(agent.session);
  const role = await finishedRole(c, w, 'pre-ledger-role');
  c.store.db.prepare('DELETE FROM role_sessions WHERE session_id=?').run(role.session_id);
  c.store.close(); c.store = new MemoryStore({ dataDir: c.dataDir });
  assert.equal(c.store.listRoleSessions({ workspaceId: w.id })[0].session_id, role.session_id);
  c.store.scrubRuntimeCopies(w.id, { requestId: 'upgraded-cleanup' });
  assert.deepEqual(c.store.getJobArtifacts(role.job_id), {});
  await c.cleanupRoleSessions(w.id);
  assert.equal(await h.ctx.sessionPersistence.stat(role.session_id), undefined);
  assert.equal(c.store.completeRuntimeCleanup({ workspaceId: w.id, requestId: 'upgraded-cleanup' }).cleanup_status, 'complete');
});
