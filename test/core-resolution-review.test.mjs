import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/core/index.js';

const canary = 'RESOLUTION_CLEAR_PRIVATE_491';
const source = [{ source_kind: 'audit_artifact', locator: `fixture:${canary}` }];
const draft = operations => ({ audit_completion: 'complete', explanation: canary, operations, issues: [] });
function setup(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'automemory-resolution-review-'));
  const store = new MemoryStore({ dataDir: dir }); store.registerWorkspace({ id: 'w', root: dir });
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  const content = { title: canary, category: 'stable', group: 'test', index_hint: canary, conditions: 'Fixture only', payload: { kind: 'markdown', text: canary } };
  const id = store.submit(draft([{ op: 'CREATE', operation_key: 'seed', local_key: 'm', reason: canary, source_refs: source, content }]), { workspaceId: 'w', requestId: 'seed', channel: 'G1' }).results[0].memory_id;
  store.submit({ ...draft([]), issues: [{ issue_key: 'i', question: 'Which option?', context: canary, affected: [{ memory_id: id, observed_version: 'v1' }], source_refs: source }] }, { workspaceId: 'w', requestId: 'issue', channel: 'G1' });
  const issue = store.listIssues({ workspaceId: 'w' })[0];
  const deletion = draft([{ op: 'DELETE', operation_key: 'delete', target_id: id, expected_version: 'v1', reason: 'Explicit user clearing', source_refs: source }]);
  const authorization = { deleteAuthorization: { requestRef: 'explicit-user-clearing', ids: [id] } };
  const persisted = () => JSON.stringify(['memories', 'memory_provenance', 'issues', 'activity', 'receipts'].map(table => store.db.prepare(`SELECT * FROM ${table}`).all()));
  return { store, id, issue, deletion, authorization, persisted };
}

test('issue resolution rejects DELETE even with trusted authorization, and cannot recreate details after dedicated clearing', t => {
  const f = setup(t), original = f.persisted();
  const input = { workspaceId: 'w', issueId: f.issue.id, expectedVersion: f.issue.version, requestId: 'must-not-clear-via-resolve', context: f.authorization, draft: f.deletion };
  assert.throws(() => f.store.resolveIssue(input), { code: 'DELETE_NOT_AUTHORIZED' });
  assert.equal(f.persisted(), original, 'The rejected mixed flow must not mutate memory, Issue, activity or receipts');
  const cleared = f.store.submit(f.deletion, { workspaceId: 'w', requestId: 'dedicated-clear', channel: 'MEMORY_UI', ...f.authorization });
  assert.equal(cleared.status, 'committed'); assert.equal(cleared.cleanup_status, 'complete');
  assert.equal(f.store.read({ workspaceId: 'w', ids: [f.id] })[0].outcome, 'deleted'); assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 0);
  assert.ok(!f.persisted().includes(canary));
  const afterClear = f.persisted();
  assert.throws(() => f.store.resolveIssue(input), { code: 'DELETE_NOT_AUTHORIZED' });
  assert.equal(f.persisted(), afterClear); assert.ok(!f.persisted().includes(canary));
});

test('confirmed-current receipt replay after dedicated deletion keeps metadata only and does not restore private sources', t => {
  const f = setup(t);
  const input = { workspaceId: 'w', issueId: f.issue.id, expectedVersion: f.issue.version, requestId: 'confirm-current', context: {}, resolution: { reason: canary, source_refs: source, expected_memories: [{ memory_id: f.id, expected_version: 'v1' }] } };
  const receipt = f.store.resolveIssue(input);
  assert.equal(receipt.issue.status, 'resolved'); assert.ok(f.persisted().includes(canary));
  const cleared = f.store.submit(f.deletion, { workspaceId: 'w', requestId: 'dedicated-clear', channel: 'MEMORY_UI', ...f.authorization });
  assert.equal(cleared.cleanup_status, 'complete'); assert.ok(!f.persisted().includes(canary));
  const afterClear = f.persisted();
  assert.deepEqual(f.store.resolveIssue(input), receipt);
  assert.equal(f.persisted(), afterClear); assert.ok(!JSON.stringify(receipt).includes(canary));
});
