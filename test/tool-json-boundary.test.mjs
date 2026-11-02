import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';

const source = { source_kind: 'session_event', locator: 'parent#event:1' };
const content = value => ({ title: value, category: 'stable', index_hint: 'Read the isolated fixture decision', group: 'fixture', conditions: 'Only this temporary test project', payload: { kind: 'markdown', text: value } });
const noop = { audit_completion: 'complete', explanation: 'No further changes', operations: [], issues: [] };
const create = value => ({ ...noop, operations: [{ op: 'CREATE', operation_key: value, local_key: 'fixture', reason: 'User supplied an isolated fixture fact', source_refs: [source], content: content(value) }] });

async function setup(t) {
  let pending, nextId = 0;
  const h = await harness(() => {
    if (!pending) return text('done');
    const item = pending; pending = undefined;
    return call(item.name, item.args, item.callId);
  });
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') });
  clearInterval(c.timer); t.after(() => h.close());
  const agent = await h.agent(); const workspace = c.bind(agent.session);
  const invoke = async (name, args, request = 'Remember this isolated project fact.') => {
    const callId = `json-boundary-${++nextId}`;
    pending = { name, args, callId };
    agent.followup(message(request, `request-${nextId}`)); await agent.whenIdle();
    const observation = await h.ctx.sessionQuery.observeSession(agent.id, { projectionMode: 'none' });
    try {
      const result = observation.events.findLast(e => e.type === 'tool/result' && e.data.message?.source?.callId === callId)?.data.message;
      assert.ok(result, `Actual native ToolRuntime result missing for ${name}`);
      return { result, output: result.content.filter(b => b.type === 'text').map(b => b.text).join('\n') };
    } finally { observation[Symbol.dispose](); }
  };
  return { h, c, agent, workspace, invoke };
}

test('native tool registry accepts object and one JSON-encoded DraftResult with identical commits', async t => {
  const { h, c, workspace, invoke } = await setup(t);
  for (const [value, encode] of [['object fact', x => x], ['encoded fact', JSON.stringify]]) {
    const { result, output } = await invoke('memory_submit', { draft: encode(create(value)) });
    assert.equal(result.isError, false, output);
    assert.equal(JSON.parse(output).status, 'committed');
  }
  assert.deepEqual(c.store.exportSnapshot(workspace.id).records.map(r => r.content.title).sort(), ['encoded fact', 'object fact']);
  const schema = h.calls[0].tools.find(x => x.name === 'memory_submit').parameters;
  assert.deepEqual(schema.properties.draft.oneOf, [{ type: 'object', additionalProperties: true }, { type: 'string' }]);
});

test('native JSON tool boundary rejects malformed, scalar, array, double-encoded and invalid proposals without writes', async t => {
  const { c, workspace, invoke } = await setup(t);
  for (const draft of ['{', 'null', '42', '[]', JSON.stringify(JSON.stringify(create('double'))), {}, { ...create('bad-schema'), operations: [{ op: 'CREATE' }] }]) {
    const { result, output } = await invoke('memory_submit', { draft });
    assert.equal(result.isError, true, output);
  }
  assert.equal(c.store.exportSnapshot(workspace.id).records.length, 0);
  assert.equal(c.store.db.prepare('SELECT COUNT(*) AS n FROM receipts WHERE workspace_id=?').get(workspace.id).n, 0);
});

test('encoded native DELETE still requires a real user clearing request', async t => {
  const { c, workspace, invoke } = await setup(t);
  const seeded = c.store.submit(create('retained fact'), { workspaceId: workspace.id, channel: 'G1', requestId: 'seed' });
  const record = c.store.read({ workspaceId: workspace.id, ids: [seeded.results[0].memory_id] })[0].record;
  const draft = { ...noop, operations: [{ op: 'DELETE', operation_key: 'clear', target_id: record.id, expected_version: record.version, reason: 'Fixture tool request without actual user authority', source_refs: [source] }] };
  const { result, output } = await invoke('memory_submit', { draft: JSON.stringify(draft) }, 'Explain the project facts; do not delete anything.');
  assert.equal(result.isError, true, output);
  assert.match(output, /authoriz|clearing/i);
  assert.equal(c.store.read({ workspaceId: workspace.id, ids: [record.id] })[0].record.version, record.version);
});

test('native issue resolution decodes its draft before DELETE and version checks, then resolves the same record', async t => {
  const { h, c, workspace, invoke } = await setup(t);
  const seeded = c.store.submit(create('before'), { workspaceId: workspace.id, channel: 'G1', requestId: 'seed' });
  const record = c.store.read({ workspaceId: workspace.id, ids: [seeded.results[0].memory_id] })[0].record;
  c.store.submit({ ...noop, issues: [{ issue_key: 'choice', question: 'Which value is current?', context: 'A fixture clarification is needed', affected: [{ memory_id: record.id, observed_version: record.version }], source_refs: [source] }] }, { workspaceId: workspace.id, channel: 'G1', requestId: 'issue' });
  const issue = c.store.listIssues({ workspaceId: workspace.id })[0];
  const draft = { ...noop, operations: [{ op: 'UPDATE', operation_key: 'resolve', target_id: record.id, expected_version: record.version, reason: 'User clarified the value', source_refs: [source], content: content('after') }] };
  const deletion = { ...noop, operations: [{ op: 'DELETE', operation_key: 'resolve-delete', target_id: record.id, expected_version: record.version, reason: 'Attempt to clear through resolution', source_refs: [source] }] };
  for (const args of [
    { expected_version: issue.version, draft: JSON.stringify(deletion) },
    { expected_version: 'v999', draft: JSON.stringify(draft) },
    { expected_version: 1, draft: JSON.stringify(draft) },
  ]) {
    const { result, output } = await invoke('memory_resolve', { issue_id: issue.id, ...args });
    assert.equal(result.isError, true, output);
    assert.equal(c.store.listIssues({ workspaceId: workspace.id }).length, 1);
    assert.equal(c.store.read({ workspaceId: workspace.id, ids: [record.id] })[0].record.version, record.version);
  }
  const { result, output } = await invoke('memory_resolve', { issue_id: issue.id, expected_version: issue.version, draft: JSON.stringify(draft) });
  assert.equal(result.isError, false, output); assert.equal(JSON.parse(output).status, 'committed');
  assert.equal(c.store.listIssues({ workspaceId: workspace.id }).length, 0);
  assert.equal(c.store.read({ workspaceId: workspace.id, ids: [record.id] })[0].record.content.title, 'after');
  assert.equal(h.calls[0].tools.find(x => x.name === 'memory_resolve').parameters.properties.expected_version.type, 'string');
});

test('native profile source references accept object/string items, validate shape and retain disabled-write guard', async t => {
  const { c, invoke } = await setup(t);
  const initial = c.profile.read();
  for (const ref of ['null', JSON.stringify(JSON.stringify(source)), { locator: 'missing-source-kind' }]) {
    const { result, output } = await invoke('user_profile_update', { text: 'invalid', expected_hash: initial.hash, reason: 'Fixture source validation', source_refs: [ref] });
    assert.equal(result.isError, true, output); assert.equal(c.profile.read().hash, initial.hash);
  }
  for (const [value, refs] of [['first preference', [JSON.stringify({ ...source, observed_at: '2020-01-01T00:00:00Z' })]], ['second preference', [source]]]) {
    const { result, output } = await invoke('user_profile_update', { text: value, expected_hash: c.profile.read().hash, reason: 'Explicit synthetic global preference', source_refs: refs }, 'Please update USER.md with this synthetic preference.');
    assert.equal(result.isError, false, output); assert.equal(JSON.parse(output).status, 'committed');
    assert.equal(c.profile.read().text, value);
    assert.deepEqual(JSON.parse(output).source_refs, [source], 'Untrusted source timestamps stay normalized');
  }
  c.profile.configure({ autoWrite: false }); const before = c.profile.read();
  const { result, output } = await invoke('user_profile_update', { text: 'must not be saved', expected_hash: before.hash, reason: 'Automatic maintenance disabled', source_refs: [JSON.stringify(source)] }, 'Continue project work.');
  assert.equal(result.isError, true, output); assert.equal(c.profile.read().hash, before.hash);
});
