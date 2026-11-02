import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/core/index.js';

const sources = [{ source_kind: 'audit_artifact', locator: 'isolated-user-decision' }];
const draft = operations => ({ audit_completion: 'complete', explanation: 'The user settled this decision.', operations, issues: [] });
function setup(t) {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'automemory-resolution-'));
  const store = new MemoryStore({ dataDir: dir }); store.registerWorkspace({ id: 'w', root: dir });
  t.after(() => { store.close(); rmSync(dir, { recursive: true, force: true }); });
  const created = store.submit(draft([{ op: 'CREATE', local_key: 'one', operation_key: 'one', reason: 'Fixture', source_refs: sources, content: { title: 'Decided requirement', category: 'stable', group: 'Decisions', index_hint: 'Pending requirement, not implemented.', conditions: 'This project', payload: { kind: 'markdown', text: 'Hide DEBUG by default; implementation remains pending.' } } }]), { workspaceId: 'w', requestId: 'seed', channel: 'G1' });
  const memoryId = created.results[0].memory_id;
  const record = () => store.read({ workspaceId: 'w', ids: [memoryId] })[0].record;
  function addIssue(key = 'choice') {
    store.submit({ ...draft([]), issues: [{ issue_key: key, question: 'Which DEBUG behavior?', context: 'Two old opinions.', affected: [{ memory_id: memoryId, observed_version: record().version }], source_refs: sources }] }, { workspaceId: 'w', requestId: 'issue-' + key, channel: 'G1' });
    return store.listIssues({ workspaceId: 'w' }).find(issue => issue.issue_key === key);
  }
  const update = (title = 'Decision already written') => {
    const r = record(); return store.submit(draft([{ op: 'UPDATE', operation_key: 'update', target_id: memoryId, expected_version: r.version, reason: 'Current decision', source_refs: sources, content: { ...r.content, title } }]), { workspaceId: 'w', requestId: 'update-' + title, channel: 'G1' });
  };
  const resolve = (issue, expected = record().version, overrides = {}) => store.resolveIssue({ workspaceId: 'w', issueId: issue.id, expectedVersion: issue.version, requestId: 'resolve', context: {}, resolution: { reason: 'Existing memory matches the confirmed decision.', source_refs: sources, expected_memories: [{ memory_id: memoryId, expected_version: expected }] }, ...overrides });
  return { store, record, addIssue, update, resolve, memoryId };
}

test('confirm current resolves a historically stale issue without rewriting memory, and replays its exact receipt', t => {
  const f = setup(t), issue = f.addIssue(); f.update(); const before = f.record();
  assert.equal(issue.proposal.affected[0].observed_version, 'v1'); assert.equal(before.version, 'v2');
  const receipt = f.resolve(issue); assert.equal(receipt.status, 'committed'); assert.equal(receipt.memory_status, 'no_change');
  assert.deepEqual(receipt.issue, { id: issue.id, status: 'resolved', version: 'v2' }); assert.equal(receipt.resolution, 'confirmed_current');
  assert.deepEqual(f.record(), before); assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 0);
  assert.deepEqual(f.resolve(issue), receipt); assert.deepEqual(f.record(), before);
  const events = f.store.listActivity({ workspaceId: 'w', channel: 'ALL' }).filter(event => event.event_type === 'issue.resolved');
  assert.equal(events.length, 1); assert.deepEqual(events[0].detail.resolution.source_refs, sources);
  const other = f.addIssue('separate'); assert.equal(f.resolve(other).errors[0].code, 'IDEMPOTENCY_CONFLICT');
  assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 1);
});

test('confirm current rejects stale, missing, duplicate and foreign affected versions without closing the issue', t => {
  const f = setup(t), issue = f.addIssue(); const oldVersion = f.record().version; f.update();
  assert.throws(() => f.resolve(issue, oldVersion), { code: 'VERSION_CONFLICT' });
  for (const expected_memories of [[], [{ memory_id: 'foreign', expected_version: 'v1' }], [{ memory_id: f.memoryId, expected_version: 'v2' }, { memory_id: 'extra', expected_version: 'v1' }]]) {
    assert.throws(() => f.resolve(issue, undefined, { resolution: { reason: 'No shortcuts.', source_refs: sources, expected_memories } }), { code: 'VERSION_CONFLICT' });
  }
  assert.throws(() => f.resolve(issue, undefined, { resolution: { reason: 'Duplicate.', source_refs: sources, expected_memories: [{ memory_id: f.memoryId, expected_version: 'v2' }, { memory_id: f.memoryId, expected_version: 'v2' }] } }), { code: 'INVALID_PROPOSAL' });
  assert.throws(() => f.resolve(issue, undefined, { expectedVersion: 'v2' }), { code: 'VERSION_CONFLICT' });
  assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 1); assert.equal(f.record().version, 'v2');
  assert.equal(f.resolve(issue).issue.status, 'resolved');
});

test('an unchanged draft still returns an explicit committed issue receipt and remains idempotent', t => {
  const f = setup(t), issue = f.addIssue(), r = f.record();
  const input = { workspaceId: 'w', issueId: issue.id, expectedVersion: issue.version, requestId: 'resolve-draft', context: {}, draft: draft([{ op: 'UPDATE', operation_key: 'same', target_id: r.id, expected_version: r.version, source_refs: sources, reason: 'The current fact is already correct.', content: r.content }]) };
  const receipt = f.store.resolveIssue(input);
  assert.equal(receipt.status, 'committed'); assert.equal(receipt.memory_status, 'no_change'); assert.equal(receipt.issue.status, 'resolved');
  assert.deepEqual(f.record(), r); assert.deepEqual(f.store.resolveIssue(input), receipt);
  assert.equal(f.store.resolveIssue({ ...input, expectedVersion: 'v2' }).errors[0].code, 'IDEMPOTENCY_CONFLICT');
});

test('resolution rejects mixed mutation and confirmation modes before touching any state', t => {
  const f = setup(t), issue = f.addIssue();
  assert.throws(() => f.resolve(issue, undefined, { draft: draft([]) }), { code: 'INVALID_PROPOSAL' });
  assert.throws(() => f.store.resolveIssue({ workspaceId: 'w', issueId: issue.id, expectedVersion: issue.version, requestId: 'neither', context: {} }), { code: 'INVALID_PROPOSAL' });
  assert.equal(f.store.listIssues({ workspaceId: 'w' }).length, 1);
});

test('confirm current requires every affected memory and closes only the explicitly named issue', t => {
  const f = setup(t), unrelated = f.addIssue('still-undecided');
  const second = f.store.submit(draft([{ op: 'CREATE', local_key: 'two', operation_key: 'two', reason: 'Other constraint', source_refs: sources, content: { ...f.record().content, title: 'Keep original logs' } }]), { workspaceId: 'w', requestId: 'second', channel: 'G1' }).results[0].memory_id;
  f.store.submit({ ...draft([]), issues: [{ issue_key: 'debug', question: 'DEBUG choice?', context: 'Both records are involved.', affected: [f.memoryId, second].map(memory_id => ({ memory_id, observed_version: 'v1' })), source_refs: sources }] }, { workspaceId: 'w', requestId: 'debug-issue', channel: 'G1' });
  const issue = f.store.listIssues({ workspaceId: 'w' }).find(value => value.issue_key === 'debug');
  assert.throws(() => f.resolve(issue), { code: 'VERSION_CONFLICT' });
  const before = f.store.read({ workspaceId: 'w', ids: [f.memoryId, second] }).map(item => item.record);
  const result = f.resolve(issue, undefined, { resolution: { reason: 'DEBUG decision is reflected; other product choices remain undecided.', source_refs: sources, expected_memories: [f.memoryId, second].map(memory_id => ({ memory_id, expected_version: 'v1' })) } });
  assert.equal(result.issue.id, issue.id); assert.deepEqual(f.store.read({ workspaceId: 'w', ids: [f.memoryId, second] }).map(item => item.record), before);
  assert.deepEqual(f.store.listIssues({ workspaceId: 'w' }).map(value => value.id), [unrelated.id]);
});
