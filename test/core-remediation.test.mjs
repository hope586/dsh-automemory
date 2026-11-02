import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { MemoryStore } from '../src/core/index.js';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const ref = n => ({ source_kind: 'session_event', locator: `s#event:${n}` });
const content = text => ({ title: 'Project fact', category: 'stable', group: 'test', index_hint: 'Fixture fact', conditions: 'Only this project', payload: { kind: 'markdown', text } });
const draft = (operations = [], issues = []) => ({ audit_completion: 'complete', explanation: 'Fixture evidence', operations, issues });
const create = (text = 'first fact', source = ref(1)) => ({ op: 'CREATE', operation_key: 'create', local_key: 'fact', reason: 'Initial evidence', source_refs: [source], content: content(text) });
const update = (memory, text = 'updated fact', source = ref(2)) => ({ op: 'UPDATE', operation_key: 'update', target_id: memory.id, expected_version: memory.version, reason: 'New evidence', source_refs: [source], content: content(text) });
function fixture(t) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'automemory-remediation-'));
  const store = new MemoryStore({ dataDir }); store.registerWorkspace({ id: 'w', root: dataDir });
  store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  t.after(() => { store.close(); rmSync(dataDir, { recursive: true, force: true }); });
  let serial = 0;
  const submit = value => store.submit(value, { workspaceId: 'w', channel: 'G1', requestId: `r${++serial}` });
  const read = id => store.read({ workspaceId: 'w', ids: [id], includeNoncurrent: true })[0].record;
  const add = () => read(submit(draft([create()])).results[0].memory_id);
  return { store, dataDir, submit, read, add };
}

test('UPDATE and Issue atomically validate the observed pre-change version and link the committed version', t => {
  const f = fixture(t), memory = f.add();
  const issue = { issue_key: 'date', question: 'Which date applies?', context: 'Two equal sources disagree.', affected: [{ memory_id: memory.id, observed_version: memory.version }], source_refs: [ref(1), ref(2)] };
  const result = f.submit(draft([update(memory)], [issue]));
  assert.equal(result.status, 'committed', JSON.stringify(result));
  assert.equal(f.read(memory.id).version, 'v2');
  assert.equal(f.store.listIssues({ workspaceId: 'w' })[0].proposal.affected[0].observed_version, 'v2');
});

test('stale Issue observation rolls back a fresh UPDATE and never guesses the new version', t => {
  const f = fixture(t), original = f.add(); f.submit(draft([update(original)]));
  const current = f.read(original.id);
  const issue = { issue_key: 'stale', question: 'Which value?', context: 'Read an older version', affected: [{ memory_id: original.id, observed_version: original.version }], source_refs: [ref(1)] };
  const result = f.submit(draft([update(current, 'must roll back', ref(3))], [issue]));
  assert.equal(result.errors[0].code, 'VERSION_CONFLICT'); assert.deepEqual(f.read(original.id), current);
  assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 0);
});

test('UPDATE, ARCHIVE, RETRACT and RESTORE retain provenance separately from their new change evidence', t => {
  const f = fixture(t); let memory = f.add();
  f.submit(draft([update(memory, 'retained first fact; new second fact')])); memory = f.read(memory.id);
  assert.deepEqual(memory.source_refs, [ref(1), ref(2)]); assert.deepEqual(memory.change_source_refs, [ref(2)]);
  for (const [i, op] of ['ARCHIVE', 'RETRACT', 'RESTORE'].entries()) {
    const change = { op, operation_key: op, target_id: memory.id, expected_version: memory.version, reason: 'Lifecycle evidence', source_refs: [ref(3 + i)], ...(op === 'RESTORE' ? { content: content('Revalidated current fact') } : {}) };
    assert.equal(f.submit(draft([change])).status, 'committed'); memory = f.read(memory.id);
    assert.deepEqual(memory.change_source_refs, [ref(3 + i)]); assert.equal(memory.source_refs.length, 3 + i);
  }
  assert.match(f.store.read({ workspaceId: 'w', ids: [memory.id] })[0].markdown, /historical sources are not all reconfirmed/);
});

test('explicit source removal needs the observed version, an existing identity and a reason', t => {
  const f = fixture(t), initial = f.add(); f.submit(draft([update(initial)])); const current = f.read(initial.id);
  const remove = { ...update(current, 'Only the revised fact remains', ref(3)), remove_source_refs: [{ source_ref: ref(1), reason: 'The fact supported by this source was explicitly corrected.' }] };
  assert.equal(f.submit(draft([{ ...remove, expected_version: initial.version }])).errors[0].code, 'VERSION_CONFLICT');
  assert.equal(f.submit(draft([{ ...remove, remove_source_refs: [{ source_ref: ref(99), reason: 'Not an existing source' }] }])).errors[0].code, 'SOURCE_REMOVAL_CONFLICT');
  assert.equal(f.submit(draft([{ ...remove, remove_source_refs: [{ source_ref: ref(1), reason: '' }] }])).status, 'rejected');
  assert.equal(f.submit(draft([remove])).status, 'committed');
  assert.deepEqual(f.read(initial.id).source_refs, [ref(2), ref(3)]);
});

test('DELETE removes new provenance metadata and replay cannot restore a private old reference', t => {
  const f = fixture(t), source = { source_kind: 'project_file', locator: 'PRIVATE_SOURCE_CANARY_664.md' };
  const receipt = f.submit(draft([create('private fact', source)])), memory = f.read(receipt.results[0].memory_id);
  assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM memory_provenance').get().n, 1);
  const deleted = f.store.submit(draft([{ op: 'DELETE', operation_key: 'clear', target_id: memory.id, expected_version: memory.version, reason: 'Explicit fixture clear', source_refs: [ref(9)] }]), { workspaceId: 'w', requestId: 'delete', channel: 'G1', deleteAuthorization: { requestRef: 'user', ids: [memory.id] } });
  assert.equal(deleted.cleanup_status, 'complete'); assert.equal(f.store.db.prepare('SELECT COUNT(*) AS n FROM memory_provenance').get().n, 0);
  assert.ok(!JSON.stringify(f.store.listActivity({ workspaceId: 'w', channel: 'ALL' })).includes(source.locator));
  assert.equal(f.store.read({ workspaceId: 'w', ids: [memory.id] })[0].outcome, 'deleted');
  assert.equal(f.submit(draft([update(memory)])).errors[0].code, 'NOT_FOUND');
});

test('same-session enabled/off/enabled admits disjoint intervals and never re-admits an old off event', t => {
  const f = fixture(t), observe = n => f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: n, eventOnly: true });
  observe(1); observe(2); const before = f.store.getWorkspace('w').dirty_seq;
  f.store.setWorkspaceEnabled('w', false); observe(3); observe(4);
  assert.equal(f.store.getWorkspace('w').dirty_seq, before);
  f.store.setWorkspaceEnabled('w', true); observe(5); observe(6); observe(3);
  assert.deepEqual(f.store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [{ startExclusive: 0, endInclusive: 2 }, { startExclusive: 4, endInclusive: 6 }]);
  assert.equal(f.store.listSessions('w')[0].head_seq, 6);
  f.store.includeHistory({ workspaceId: 'w', sessionId: 's', startExclusive: 2 });
  assert.deepEqual(f.store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [{ startExclusive: 0, endInclusive: 6 }]);
  const dirty = f.store.getWorkspace('w').dirty_seq;
  f.store.includeHistory({ workspaceId: 'w', sessionId: 's', startExclusive: 2 });
  assert.equal(f.store.getWorkspace('w').dirty_seq, dirty, 'Repeating the same explicit inclusion has no new effect');
});

test('new sessions while disabled remain unselected across restart and another host toggle', t => {
  const f = fixture(t), other = new MemoryStore({ dataDir: f.dataDir }); t.after(() => other.close());
  other.setWorkspaceEnabled('w', false);
  f.store.registerSession({ workspaceId: 'w', sessionId: 'off-session', newSession: true });
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 'off-session', headSeq: 8, eventOnly: true });
  assert.deepEqual(f.store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 'off-session' }), []);
  other.setWorkspaceEnabled('w', true);
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 'off-session', headSeq: 10, eventOnly: true });
  assert.deepEqual(other.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 'off-session' }), [{ startExclusive: 9, endInclusive: 10 }]);
  const third = new MemoryStore({ dataDir: f.dataDir }); t.after(() => third.close());
  assert.deepEqual(third.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 'off-session' }), [{ startExclusive: 9, endInclusive: 10 }]);
  other.setAutomaticDream('w', false);
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 'off-session', headSeq: 11, eventOnly: true });
  assert.deepEqual(third.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 'off-session' }), [{ startExclusive: 9, endInclusive: 11 }]);
});

test('frozen evidence rejects disabled gaps, unrecognized aliases and disguised session refs', t => {
  const f = fixture(t);
  for (const n of [1, 2]) f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: n, eventOnly: true });
  f.store.setWorkspaceEnabled('w', false); f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 4 }); f.store.setWorkspaceEnabled('w', true);
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 5, eventOnly: true });
  const ranges = f.store.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' });
  const payload = { evidencePolicy: 1, evidenceRanges: [{ sessionId: 's', startExclusive: -1, endInclusive: 5, allowedRanges: ranges, contextRanges: ranges }] };
  assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'bad-range', sessionId: 's', endSeq: 5, snapshot: { bound: true }, payload: { ...payload, evidenceRanges: [{ ...payload.evidenceRanges[0], allowedRanges: [{ startExclusive: -1, endInclusive: 5 }] }] } }), { code: 'SOURCE_SCOPE_MISMATCH' });
  for (const [i, source] of [ref(3), { ...ref(3), locator: 'session:s/event:3' }, { ...ref(3), locator: 'session://s/event/3' }, { ...ref(3), locator: 's#events:1-5' }, { ...ref(3), locator: 's#event=3' }, { source_kind: 'project_file', locator: 's#event:3' }].entries()) {
    f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: `outside-${i}`, sessionId: 's', endSeq: 5, snapshot: { bound: true }, payload });
    const job = f.store.claimJob({ owner: 'worker' });
    assert.equal(f.store.completeJob({ lease: job.lease, draft: draft([create('disallowed', source)]) }).errors[0].code, 'SOURCE_SCOPE_MISMATCH');
  }
  f.store.enqueueJob({ workspaceId: 'w', kind: 'G2', requestId: 'allowed', sessionId: 's', endSeq: 5, snapshot: { bound: true }, payload });
  const job = f.store.claimJob({ owner: 'worker' });
  assert.equal(f.store.completeJob({ lease: job.lease, draft: draft([create('allowed', ref(5))]) }).status, 'committed');
});

test('legacy INSERT layout remains intact while old mutations require reload and reads remain available', t => {
  const f = fixture(t), memory = f.add(), legacy = new DatabaseSync(path.join(f.dataDir, 'memory.sqlite')); t.after(() => legacy.close());
  assert.equal(legacy.prepare('PRAGMA table_info(memories)').all().length, 14);
  assert.throws(() => legacy.prepare('UPDATE memories SET source_refs=? WHERE workspace_id=? AND id=?').run(JSON.stringify([ref(99)]), 'w', memory.id), /AUTOMEMORY_RELOAD_REQUIRED/);
  assert.throws(() => legacy.prepare('INSERT INTO memories VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run('w', 'legacy', 1, 'current', JSON.stringify(content('old')), JSON.stringify([ref(1)]), 'old', '[]', 'old', 'stable', 'test', 'hint', 1, 1), /AUTOMEMORY_RELOAD_REQUIRED/);
  assert.equal(legacy.prepare('SELECT version FROM memories WHERE id=?').get(memory.id).version, 1);
  assert.equal(legacy.prepare('SELECT active FROM core_write_gate').get().active, 0);
  assert.throws(() => f.store._tx(() => { throw new Error('fixture rollback'); }), /fixture rollback/);
  assert.equal(legacy.prepare('SELECT active FROM core_write_gate').get().active, 0);
});

test('write capability is isolated from other connections and crash rollback never leaves it enabled', t => {
  const f = fixture(t), memory = f.add(), other = new DatabaseSync(path.join(f.dataDir, 'memory.sqlite')); t.after(() => other.close());
  other.exec('PRAGMA busy_timeout=1');
  f.store._tx(() => {
    assert.equal(f.store.db.prepare('SELECT active FROM core_write_gate').get().active, 2);
    assert.equal(other.prepare('SELECT active FROM core_write_gate').get().active, 0, 'Uncommitted capability must not be visible to another connection');
    assert.throws(() => other.prepare('UPDATE memories SET reason=? WHERE id=?').run('old writer', memory.id), /locked|busy/i);
  });
  const program = `import {MemoryStore} from ${JSON.stringify(new URL('../src/core/index.js', import.meta.url).href)}; const store=new MemoryStore({dataDir:process.argv[1]});store._tx(()=>{process.kill(process.pid,'SIGKILL')});`;
  const crashed = spawnSync(process.execPath, ['--input-type=module', '-e', program, f.dataDir]); assert.equal(crashed.signal, 'SIGKILL');
  assert.equal(other.prepare('SELECT active FROM core_write_gate').get().active, 0);
  assert.throws(() => other.prepare('UPDATE memories SET reason=? WHERE id=?').run('old writer', memory.id), /AUTOMEMORY_RELOAD_REQUIRED/);
  assert.equal(f.submit(draft([update(memory)])).status, 'committed');
});

test('legacy enrollment migrates once with explicit unknown-off-period provenance', t => {
  const f = fixture(t);
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 10 });
  // Simulate the old schema's only available scope metadata: a continuous cut,
  // with no eligibility tables/marker from which disabled gaps can be inferred.
  f.store.db.exec("DELETE FROM schema_meta WHERE key='evidence_ranges_v1'; DELETE FROM evidence_ranges; DELETE FROM evidence_observed");
  const upgraded = new MemoryStore({ dataDir: f.dataDir }); t.after(() => upgraded.close());
  assert.deepEqual(upgraded.allowedEvidenceRanges({ workspaceId: 'w', sessionId: 's' }), [{ startExclusive: -1, endInclusive: 10 }]);
  const notice = upgraded.listActivity({ workspaceId: 'w', channel: 'ALL' }).find(event => event.event_type === 'evidence.migrated');
  assert.equal(notice.metadata.historic_disabled_intervals_unknown, true);
  const another = new MemoryStore({ dataDir: f.dataDir }); t.after(() => another.close());
  assert.equal(another.listActivity({ workspaceId: 'w', channel: 'ALL' }).filter(event => event.event_type === 'evidence.migrated').length, 1);
});

test('source capacity rejects accumulated overflow instead of dropping old references', t => {
  const f = fixture(t), memory = f.add();
  const operation = { ...update(memory), source_refs: Array.from({ length: 256 }, (_, i) => ref(i + 2)) };
  assert.equal(f.submit(draft([operation])).errors[0].code, 'SOURCE_CAPACITY');
  assert.deepEqual(f.read(memory.id), memory);
});
