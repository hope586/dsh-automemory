import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { MemoryStore } from '../src/core/index.js';
import { stable } from '../src/core/validate.js';

const DAY = 86400000;
const content = (body = 'durable fact') => ({ title: 'Project constraint', category: 'stable', index_hint: 'Read before choosing implementation', group: 'Design', conditions: 'This project', payload: { kind: 'markdown', text: body } });
const sources = [{ source_kind: 'session_event', locator: 'session:S/event:1' }];
const create = (key = 'one', body) => ({ op: 'CREATE', operation_key: key, local_key: key, reason: 'Reduces repeated explanation', source_refs: sources, content: content(body) });
const draft = (operations = [], issues = []) => ({ audit_completion: 'complete', explanation: 'Evidence checked', operations, issues });
const update = (record, body = 'new fact', key = 'update') => ({ op: 'UPDATE', operation_key: key, target_id: record.id, expected_version: record.version, reason: 'New evidence supersedes earlier state', source_refs: sources, content: content(body) });
const action = (op, record, extra = {}) => ({ op, operation_key: op.toLowerCase(), target_id: record.id, expected_version: record.version, source_refs: sources, reason: 'User or evidence requires lifecycle change', ...extra });
function fixture(t, opts = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automemory-core-'));
  let now = 1_000_000;
  const store = new MemoryStore({ dataDir: dir, clock: () => now, ...opts });
  store.registerWorkspace({ id: 'w', root: dir });
  store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  t.after(() => { try { store.close(); } catch {} fs.rmSync(dir, { recursive: true, force: true }); });
  let serial = 0;
  const submit = (d, context = {}) => store.submit(d, { workspaceId: 'w', requestId: `r${++serial}`, channel: 'G1', ...context });
  const read = memoryId => store.read({ workspaceId: 'w', ids: [memoryId], includeNoncurrent: true })[0].record;
  const add = body => { const r = submit(draft([create('one', body)])); assert.equal(r.status, 'committed'); return read(r.results[0].memory_id); };
  return { dir, store, submit, read, add, advance: ms => { now += ms; }, now: () => now };
}

test('Record enforces idempotency across restart, without repeating created IDs', t => {
  const f = fixture(t), d = draft([create()]);
  const first = f.submit(d, { requestId: 'same' });
  assert.deepEqual(f.submit(d, { requestId: 'same' }), first);
  const other = new MemoryStore({ dataDir: f.dir }); t.after(() => other.close());
  assert.deepEqual(other.submit(d, { workspaceId: 'w', requestId: 'same', channel: 'G1' }), first);
  assert.equal(other.exportSnapshot('w').records.length, 1);
  assert.equal(f.submit(draft([create('one', 'different')]), { requestId: 'same' }).errors[0].code, 'IDEMPOTENCY_CONFLICT');
});

test('a conflict in one member rolls back the complete change set', t => {
  const f = fixture(t), a = f.add('A'), b = f.add('B');
  f.submit(draft([update(b, 'B-new')]));
  const receipt = f.submit(draft([update(a, 'A-new'), action('ARCHIVE', b)]));
  assert.equal(receipt.status, 'rejected'); assert.equal(receipt.errors[0].code, 'VERSION_CONFLICT');
  assert.equal(f.read(a.id).content.payload.text, 'A'); assert.equal(f.read(b.id).status, 'current');
});

test('malformed, duplicate and model-supplied authority fields are rejected', t => {
  const f = fixture(t);
  assert.equal(f.submit({ ...draft([create()]), workspace_id: 'other' }).errors[0].code, 'INVALID_PROPOSAL');
  assert.equal(f.submit(draft([create(), create()])).status, 'rejected');
  const bad = create(); delete bad.source_refs;
  assert.equal(f.submit(draft([bad])).status, 'rejected');
  assert.equal(f.store.exportSnapshot('w').records.length, 0);
});

test('workspace isolation hides foreign IDs and blocks foreign mutation', t => {
  const f = fixture(t), a = f.add(); f.store.registerWorkspace({ id: 'other', root: path.join(f.dir, 'other') });
  assert.equal(f.store.read({ workspaceId: 'other', ids: [a.id] })[0].outcome, 'not_found');
  assert.equal(f.submit(draft([update(a)]), { workspaceId: 'other' }).errors[0].code, 'NOT_FOUND');
});

test('archive/retract/restore are distinct and UPDATE cannot silently reactivate', t => {
  const f = fixture(t), a = f.add(); f.submit(draft([action('ARCHIVE', a)]));
  const archived = f.read(a.id);
  assert.equal(f.store.read({ workspaceId: 'w', ids: [a.id] })[0].outcome, 'archived');
  assert.equal(f.submit(draft([update(archived)])).errors[0].code, 'NONCURRENT');
  f.submit(draft([action('RESTORE', archived, { content: content('restored') })]));
  assert.equal(f.read(a.id).status, 'current');
  f.submit(draft([action('RETRACT', f.read(a.id))])); assert.equal(f.read(a.id).status, 'retracted');
});

test('atomic merge resolves local new IDs within the same transaction', t => {
  const f = fixture(t), a = f.add();
  const receipt = f.submit(draft([create('replacement', 'combined'), action('ARCHIVE', a, { replacement_refs: ['local:replacement'] })]));
  assert.equal(receipt.status, 'committed');
  assert.equal(f.read(a.id).replacement_refs[0], receipt.results[0].memory_id);
});

test('same logical turn reuses snapshot; later turns see latest index', t => {
  const f = fixture(t), first = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  f.add();
  assert.deepEqual(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' }), first);
  const next = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't2' });
  assert.notEqual(next.index_hash, first.index_hash);
  assert.equal(next.index_changed, false, 'An unprovided bundle is not a comparison baseline');
});

test('body-only update produces subscription notice even with identical index text', t => {
  const f = fixture(t), a = f.add();
  const bundle = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  f.store.markBundleProvided({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  f.store.markProvided({ workspaceId: 'w', sessionId: 's', results: f.store.read({ workspaceId: 'w', ids: [a.id] }) });
  f.submit(draft([update(a, 'updated body only')]));
  const next = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't2' });
  assert.equal(next.index_hash, bundle.index_hash); assert.equal(next.index_changed, false);
  assert.equal(next.notifications[0].kind, 'updated'); assert.match(next.notifications[0].content_markdown, /updated body only/);
  f.store.markBundleProvided({ workspaceId: 'w', sessionId: 's', turnId: 't2' });
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't3' }).notifications.length, 0);
});

test('queries alone do not subscribe; mid-turn latest body delivery suppresses repeat updates', t => {
  const f = fixture(t), a = f.add(); f.store.read({ workspaceId: 'w', ids: [a.id] });
  f.submit(draft([update(a)]));
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' }).notifications.length, 0);
  f.store.markProvided({ workspaceId: 'w', sessionId: 's', results: f.store.read({ workspaceId: 'w', ids: [a.id] }) });
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't2' }).notifications.length, 0);
});

test('hard index limit fails explicitly without truncating or deleting memory', t => {
  const f = fixture(t, { maxIndexBytes: 10 }); f.add();
  const bundle = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  assert.equal(bundle.state, 'unavailable'); assert.equal(bundle.error.code, 'INDEX_CAPACITY');
  assert.equal(f.store.exportSnapshot('w').records.length, 1);
});

test('Issue metadata changes recall revision and resolution requires current versions', t => {
  const f = fixture(t), a = f.add();
  f.store.markProvided({ workspaceId: 'w', sessionId: 's', results: f.store.read({ workspaceId: 'w', ids: [a.id] }) });
  const issue = { issue_key: 'question', question: 'Which applies?', context: 'Two conflicting decisions', affected: [{ memory_id: a.id, observed_version: a.version }], source_refs: sources };
  const receipt = f.submit(draft([], [issue]));
  assert.equal(receipt.status, 'committed');
  const bundle = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  assert.match(bundle.index_markdown, /unresolved:/); assert.equal(bundle.notifications[0].kind, 'needs_resolution');
  const row = f.store.listIssues({ workspaceId: 'w' })[0];
  f.submit(draft([update(a, 'new facts')]));
  assert.throws(() => f.store.resolveIssue({ workspaceId: 'w', issueId: row.id, expectedVersion: row.version, requestId: 'resolve', context: {}, draft: draft([update(a)]) }), /current affected/);
  assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 1);
  const resolved = f.store.resolveIssue({ workspaceId: 'w', issueId: row.id, expectedVersion: row.version, requestId: 'resolve-new', context: {}, draft: draft([update(f.read(a.id), 'resolved current fact')]) });
  assert.equal(resolved.status, 'committed'); assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 0);
});

test('DELETE requires explicit trusted user scope and cannot be performed by G2/Dreamer', t => {
  const f = fixture(t), a = f.add(), d = draft([action('DELETE', a)]);
  assert.equal(f.submit(d).errors[0].code, 'DELETE_NOT_AUTHORIZED');
  assert.equal(f.submit(d, { channel: 'G2', deleteAuthorization: { requestRef: 'user1', ids: [a.id] } }).errors[0].code, 'DELETE_NOT_AUTHORIZED');
  assert.ok(f.read(a.id));
});

test('DELETE scrubs persisted copies, fences old jobs, and replay never restores content', t => {
  const f = fixture(t), secret = 'UNIQUE-DELETE-CONTENT-83721', original = draft([create('one', secret)]);
  const created = f.submit(original, { requestId: 'create-original' }); const a = f.read(created.results[0].memory_id);
  f.store.markProvided({ workspaceId: 'w', sessionId: 's', results: f.store.read({ workspaceId: 'w', ids: [a.id] }) });
  f.submit(draft([update(a, secret + '-updated')]));
  f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'old-turn' });
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 5 });
  const accepted = f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'job', sessionId: 's', endSeq: 5, snapshot: { context: secret } });
  const job = f.store.claimJob({ owner: 'worker' }); f.store.saveJobArtifact({ lease: job.lease, stage: 'candidate', value: { text: secret } });
  const deleted = f.submit(draft([action('DELETE', f.read(a.id))]), { requestId: 'delete', deleteAuthorization: { requestRef: 'user-delete', ids: [a.id] } });
  assert.equal(deleted.cleanup_status, 'complete'); assert.equal(f.store.getJob(accepted.job_id).snapshot, null);
  assert.equal(f.store.getJob(accepted.job_id).status, 'cancelled');
  assert.throws(() => f.store.completeJob({ lease: job.lease, draft: original }), /lease/);
  assert.equal(f.store.read({ workspaceId: 'w', ids: [a.id] })[0].outcome, 'deleted');
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'old-turn' }).error.code, 'MEMORY_CONTENT_CLEARED');
  assert.deepEqual(f.submit(original, { requestId: 'create-original' }), created);
  assert.equal(f.store.exportSnapshot('w').records.length, 0);
  for (const table of ['memories', 'jobs', 'job_artifacts', 'activity', 'bundles', 'receipts']) assert.ok(!JSON.stringify(f.store.db.prepare(`SELECT * FROM ${table}`).all()).includes(secret), `${table} leaked deleted content`);
});

test('existing sessions exclude old prefix until explicitly included', t => {
  const f = fixture(t); const s = f.store.registerSession({ workspaceId: 'w', sessionId: 'old', headSeq: 40 });
  assert.equal(s.g2_cursor, 40);
  assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'outside', sessionId: 'old', endSeq: 40, snapshot: { context: 'old' } }), /managed/);
  f.store.includeHistory({ workspaceId: 'w', sessionId: 'old', startExclusive: 10 });
  assert.equal(f.store.listSessions('w').find(x => x.id === 'old').g2_cursor, 10);
});

test('G2 acceptance persists frozen input; no-op completion advances cursor exactly once', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 10 });
  const snapshot = { messages: ['earlier', 'current'] };
  const accepted = f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'g2', sessionId: 's', endSeq: 10, snapshot }); snapshot.messages.push('future');
  const other = new MemoryStore({ dataDir: f.dir, clock: f.now }); t.after(() => other.close());
  const job = other.claimJob({ owner: 'second-process' }); assert.deepEqual(job.snapshot.messages, ['earlier', 'current']);
  const result = other.completeJob({ lease: job.lease, draft: draft() });
  assert.equal(result.status, 'no_change'); assert.equal(f.store.listSessions('w')[0].g2_cursor, 10);
  assert.deepEqual(other.completeJob({ lease: job.lease, draft: draft() }), result);
  assert.equal(f.store.getJob(accepted.job_id).status, 'completed');
});

test('G2 partial/conflict results never advance coverage; same-session tasks serialize', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 20 });
  for (const h of [10, 20]) f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: `g${h}`, sessionId: 's', endSeq: h, snapshot: { h } });
  const first = f.store.claimJob({ owner: 'a' }); assert.equal(f.store.claimJob({ owner: 'b' }), null);
  f.store.completeJob({ lease: first.lease, draft: { ...draft(), audit_completion: 'partial' } });
  assert.equal(f.store.listSessions('w')[0].g2_cursor, -1);
  const next = f.store.claimJob({ owner: 'b' }); assert.equal(next.window.start_exclusive, -1); assert.equal(next.window.end_inclusive, 20);
  f.store.completeJob({ lease: next.lease, draft: draft() }); assert.equal(f.store.listSessions('w')[0].g2_cursor, 20);
});

test('expired lease rejects old worker after recovery by another connection', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'g', sessionId: 's', endSeq: 1, snapshot: { h: 1 } });
  const first = f.store.claimJob({ owner: 'old', leaseMs: 100 }); f.advance(101);
  const other = new MemoryStore({ dataDir: f.dir, clock: f.now }); t.after(() => other.close());
  const recovered = other.claimJob({ owner: 'new' }); assert.ok(recovered.token > first.token);
  assert.throws(() => f.store.completeJob({ lease: first.lease, draft: draft([create()]) }), /lease/);
  assert.equal(other.completeJob({ lease: recovered.lease, draft: draft() }).status, 'no_change');
});

test('Dreamer enforces 24h, new evidence, cross-host idleness and single-job ownership', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'early' }), /interval/);
  f.advance(DAY);
  const accepted = f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'daily' });
  const other = new MemoryStore({ dataDir: f.dir, clock: f.now }); t.after(() => other.close());
  other.setWorkspaceBusy({ workspaceId: 'w', owner: 'desktop', busy: true });
  assert.equal(f.store.claimJob({ owner: 'web' }), null);
  other.setWorkspaceBusy({ workspaceId: 'w', owner: 'desktop', busy: false });
  const job = f.store.claimJob({ owner: 'web' }); assert.equal(job.id, accepted.job_id);
  assert.equal(other.claimJob({ owner: 'desktop' }), null);
  assert.equal(other.enqueueJob({ workspaceId: 'w', kind: 'BACKFILL', requestId: 'backfill', manual: true }).job_id, job.id);
  f.store.completeJob({ lease: job.lease, draft: draft() });
  assert.throws(() => other.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'no-new' }), /No new/);
  other.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 2 });
  assert.throws(() => other.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'again' }), /interval/);
});

test('Dreamer requires one persisted review for changes; successful changes alone enter activity', t => {
  const f = fixture(t);
  f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'manual1', manual: true });
  const first = f.store.claimJob({ owner: 'w' });
  assert.equal(f.store.completeJob({ lease: first.lease, draft: draft([create()]) }).errors[0].code, 'REVIEW_UNAVAILABLE');
  f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'manual2', manual: true });
  const second = f.store.claimJob({ owner: 'w' });
  f.store.saveJobArtifact({ lease: second.lease, stage: 'candidate', value: draft([create()]) });
  f.store.saveJobArtifact({ lease: second.lease, stage: 'review', value: { candidate_id: 'c', findings: [], checked_sources: [], limitations: [] } });
  assert.throws(() => f.store.saveJobArtifact({ lease: second.lease, stage: 'review', value: { candidate_id: 'other', findings: [], checked_sources: [], limitations: [] } }), /immutable/);
  assert.equal(f.store.completeJob({ lease: second.lease, draft: draft([create()]) }).status, 'committed');
  f.add('G1');
  assert.equal(f.store.listActivity({ workspaceId: 'w' }).length, 1);
  assert.ok(f.store.listActivity({ workspaceId: 'w' })[0].detail.changes.length);
});

test('project disable persists, fences live workers, pauses recall and resumes queued work', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'g', sessionId: 's', endSeq: 1, snapshot: { h: 1 } });
  const old = f.store.claimJob({ owner: 'a' }); f.store.setWorkspaceEnabled('w', false);
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'off' }).error.code, 'WORKSPACE_DISABLED');
  assert.throws(() => f.store.renewJob(old.lease), /lease/);
  assert.equal(f.store.registerWorkspace({ id: 'w', root: f.dir }).enabled, false);
  f.store.setWorkspaceEnabled('w', true); const next = f.store.claimJob({ owner: 'a' });
  assert.ok(next.token > old.token); assert.equal(f.store.completeJob({ lease: next.lease, draft: draft() }).status, 'no_change');
});

test('two independent processes racing the same request commit one effect', async t => {
  const f = fixture(t), url = new URL('../src/core/index.js', import.meta.url).href;
  const program = `import {MemoryStore} from ${JSON.stringify(url)};const s=new MemoryStore({dataDir:process.argv[1]});const r=s.submit(JSON.parse(process.argv[2]),{workspaceId:'w',requestId:'racing',channel:'G1'});process.stdout.write(JSON.stringify(r));s.close();`;
  const run = () => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['--input-type=module', '-e', program, f.dir, JSON.stringify(draft([create()]))]);
    let stdout = '', stderr = ''; child.stdout.on('data', x => stdout += x); child.stderr.on('data', x => stderr += x);
    child.on('error', reject); child.on('close', code => code === 0 ? resolve(JSON.parse(stdout)) : reject(new Error(stderr)));
  });
  const [a, b] = await Promise.all([run(), run()]); assert.deepEqual(a, b); assert.equal(f.store.exportSnapshot('w').records.length, 1);
});

test('committed receipt survives abrupt process exit before response acknowledgement', t => {
  const f = fixture(t), url = new URL('../src/core/index.js', import.meta.url).href, d = draft([create()]);
  const code = `import {MemoryStore} from ${JSON.stringify(url)}; const s=new MemoryStore({dataDir:process.argv[1]});s.submit(JSON.parse(process.argv[2]),{workspaceId:'w',requestId:'crash',channel:'G1'});process.kill(process.pid,'SIGKILL');`;
  const child = spawnSync(process.execPath, ['--input-type=module', '-e', code, f.dir, JSON.stringify(d)]);
  assert.equal(child.signal, 'SIGKILL');
  const replay = f.submit(d, { requestId: 'crash' }); assert.equal(replay.status, 'committed'); assert.equal(f.store.exportSnapshot('w').records.length, 1);
});

test('restart finishes interrupted deletion cleanup and revokes old uncommitted staged requests', t => {
  const f = fixture(t), a = f.add('erase-me'), staged = draft([create('stale', 'erase-me')]);
  const stagePath = f.store._tx(() => f.store._stage('w', 'orphan-before-delete', 'test-hash', staged));
  const finish = f.store._finishCleanup;
  f.store._finishCleanup = () => { throw new Error('simulated process interruption after commit'); };
  assert.throws(() => f.submit(draft([action('DELETE', a)]), { requestId: 'interrupted-delete', deleteAuthorization: { requestRef: 'user', ids: [a.id] } }), /interruption/);
  assert.ok(fs.existsSync(stagePath)); f.store._finishCleanup = finish;
  const reopened = new MemoryStore({ dataDir: f.dir, clock: f.now }); t.after(() => reopened.close());
  assert.ok(!fs.existsSync(stagePath));
  const row = reopened.db.prepare('SELECT receipt FROM receipts WHERE request_id=?').get('interrupted-delete');
  assert.equal(JSON.parse(row.receipt).cleanup_status, 'complete');
  const retry = reopened.submit(staged, { workspaceId: 'w', requestId: 'orphan-before-delete', channel: 'G1' });
  assert.equal(retry.errors[0].code, 'REQUEST_REVOKED');
  assert.ok(!fs.existsSync(stagePath));
});

test('disabled project never re-supplies an earlier ready turn bundle', t => {
  const f = fixture(t); f.add();
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't' }).state, 'ready');
  f.store.setWorkspaceEnabled('w', false);
  const disabled = f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't' });
  assert.equal(disabled.state, 'unavailable'); assert.equal(disabled.index_markdown, undefined);
});

test('audit retention expires cached historical bundle bodies without deleting formal memories', t => {
  const f = fixture(t); f.add();
  f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'old' }); f.advance(31 * DAY);
  f.store.pruneAudit();
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'old' }).error.code, 'CONTEXT_EXPIRED');
  assert.equal(f.store.exportSnapshot('w').records.length, 1);
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'new' }).state, 'ready');
});

test('longer configured Dreamer intervals apply but intervals below one day are rejected', t => {
  const f = fixture(t, { dreamIntervalMs: 2 * DAY });
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 }); f.advance(DAY);
  assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'early' }), /interval/);
  f.advance(DAY); assert.equal(f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'due' }).status, 'accepted');
  assert.throws(() => f.store.setDreamIntervalMs(1000), /at least 24/);
});

test('adapter cleanup remains incomplete across restart until explicitly acknowledged', t => {
  const f = fixture(t), a = f.add();
  const receipt = f.submit(draft([action('DELETE', a)]), { requestId: 'external-delete', externalCleanupRequired: true, deleteAuthorization: { requestRef: 'user', ids: [a.id] } });
  assert.equal(receipt.cleanup_status, 'incomplete');
  const reopened = new MemoryStore({ dataDir: f.dir }); t.after(() => reopened.close());
  assert.equal(reopened.pendingCleanups().length, 1);
  const complete = reopened.completeExternalCleanup({ workspaceId: 'w', requestId: 'external-delete' });
  assert.equal(complete.cleanup_status, 'complete'); assert.deepEqual(complete.errors, []); assert.equal(f.store.pendingCleanups().length, 0);
});

test('canonical JSON handles optional undefined fields without invalid persisted JSON', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  const receipt = f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'optional', sessionId: 's', endSeq: 1, snapshot: { context: 'bound' }, payload: { reason: 'stage', focus: undefined } });
  const job = f.store.claimJob({ owner: 'worker' });
  assert.deepEqual(job.payload, { reason: 'stage' });
  f.store.saveJobArtifact({ lease: job.lease, stage: 'audit-usage', value: { status: 'completed', error: undefined, usage: [undefined] } });
  assert.deepEqual(f.store.getJobArtifacts(receipt.job_id)['audit-usage'], { status: 'completed', usage: [null] });
  assert.equal(stable({ z: 1, omitted: undefined, a: 2 }), '{"a":2,"z":1}');
});

test('non-JSON runtime payloads are rejected before any job is persisted', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  const cyclic = {}; cyclic.self = cyclic;
  for (const [i, payload] of [{ bad: NaN }, { bad: Infinity }, { bad: 1n }, { bad: () => 1 }, { bad: new Map() }, cyclic].entries()) {
    assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: `bad-${i}`, sessionId: 's', endSeq: 1, snapshot: { bound: true }, payload }), /JSON|finite|plain/);
  }
  assert.equal(f.store.listJobs({ workspaceId: 'w' }).length, 0);
});

test('Dreamer advances its frozen per-session range without consuming later evidence or G2 coverage', t => {
  const f = fixture(t); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 10 });
  f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'window', manual: true, payload: { evidenceRanges: [{ sessionId: 's', startExclusive: -1, endInclusive: 10 }] } });
  const job = f.store.claimJob({ owner: 'worker' });
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 20 });
  assert.equal(f.store.completeJob({ lease: job.lease, draft: draft() }).status, 'no_change');
  const session = f.store.listSessions('w')[0];
  assert.equal(session.dream_cursor, 10); assert.equal(session.head_seq, 20); assert.equal(session.g2_cursor, -1);
  const workspace = f.store.getWorkspace('w'); assert.ok(workspace.dirty_seq > workspace.dream_processed_seq);
});

test('global-profile runtime scrub fences snapshots while preserving formal project records', t => {
  const f = fixture(t), memory = f.add('project fact stays');
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'global-context', sessionId: 's', endSeq: 1, snapshot: { userProfile: 'global data to clear' } });
  const job = f.store.claimJob({ owner: 'worker' });
  f.store.saveJobArtifact({ lease: job.lease, stage: 'candidate', value: { inheritedProfile: 'global data to clear' } });
  f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' });
  const result = f.store.scrubRuntimeCopies('w'); assert.equal(result.cleanup_status, 'complete');
  assert.deepEqual(f.read(memory.id), memory);
  assert.equal(f.store.getJob(job.id).snapshot, null); assert.equal(f.store.getJob(job.id).status, 'cancelled');
  assert.deepEqual(f.store.getJobArtifacts(job.id), {});
  assert.throws(() => f.store.renewJob(job.lease), /lease/);
  assert.equal(f.store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 't1' }).state, 'unavailable');
});

test('read audit records actual main/background delivery metadata without copying memory text', t => {
  const f = fixture(t), record = f.add('READ_BODY_NOT_FOR_AUDIT_7735');
  const results = f.store.read({ workspaceId: 'w', ids: [record.id] });
  assert.equal(f.store.listActivity({ workspaceId: 'w', channel: 'ALL' }).filter(e => e.event_type === 'memory.read').length, 0);
  f.store.markProvided({ workspaceId: 'w', sessionId: 's', results });
  f.store.recordReadProvided({ workspaceId: 'w', sessionId: 'automemory-g2-unregistered', role: 'g2', results });
  const reads = f.store.listActivity({ workspaceId: 'w', channel: 'ALL' }).filter(e => e.event_type === 'memory.read');
  assert.equal(reads.length, 2);
  assert.deepEqual(new Set(reads.map(x => x.metadata.role)), new Set(['main', 'g2']));
  assert.ok(reads.every(x => x.metadata.items[0].memory_id === record.id && x.metadata.items[0].version === record.version && x.metadata.items[0].body_provided));
  assert.ok(!JSON.stringify(reads).includes('READ_BODY_NOT_FOR_AUDIT_7735'));
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM subscriptions WHERE session_id=?').get('automemory-g2-unregistered').n, 0);
});
