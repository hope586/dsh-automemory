import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { harness, text } from './fixtures/harness.mjs';
import { apply, actionFor, stateFor, globalStateFor, catalogFor, historyMetadataFor } from '../lib/index.js';
import { workspaceIdentity } from '../src/identity.js';

async function setup(t) {
  const h = await harness(() => text('Fixture management acknowledgement.'));
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') }); clearInterval(c.timer);
  t.after(() => h.close());
  return { h, c };
}
async function projectAgent(h, t, suffix) {
  const cwd = path.join(h.temp, suffix); mkdirSync(cwd);
  const handle = await h.ctx.agents.create({ sessionId: `session-${suffix}`, agentOptions: { provider: 'fixture', model: 'fixture-model' }, meta: { cwd } });
  t.after(() => handle.dispose());
  return { agent: handle.agent, workspace: workspaceIdentity(cwd) };
}
const createDraft = { audit_completion: 'complete', explanation: 'Synthetic project fact', operations: [{ op: 'CREATE', operation_key: 'create', local_key: 'fact', reason: 'User fixture evidence', source_refs: [{ source_kind: 'session_event', locator: 'synthetic#event:1' }], content: { title: 'Stored project fact', category: 'stable', group: 'fixture', index_hint: 'Read for global page test', conditions: 'This synthetic project', payload: { kind: 'markdown', text: 'A project fact remains accessible without any conversation.' } } }], issues: [] };

test('global API reads profile/settings and changes non-semantic controls with no sessions', async t => {
  const { h, c } = await setup(t);
  const initial = await globalStateFor(c);
  assert.equal(initial.sessionId, null); assert.equal(initial.userProfile.content, '');
  assert.equal(initial.settings.dreamIntervalHours, 24); assert.equal(initial.capabilities.manage, true);
  assert.deepEqual((await catalogFor(c)).projects, []);
  assert.equal((await actionFor(c, { action: 'settings-save', settings: { revision: initial.settings.revision, dreamIntervalHours: 48 } })).status, 'committed');
  assert.equal((await actionFor(c, { action: 'user-profile-toggle', enabled: false })).status, 'committed');
  const changed = await globalStateFor(c);
  assert.equal(changed.settings.dreamIntervalHours, 48); assert.equal(changed.userProfile.enabled, false);
  assert.equal(changed.userProfile.autoWrite, true, 'A global toggle must preserve the other switch');
  assert.equal(c.store.listWorkspaces().length, 0); assert.equal(h.calls.length, 0);
  await assert.rejects(actionFor(c, { action: 'manage', text: 'Edit USER.md', scope: 'user' }), { code: 'INVALID_ACTION' });
});

test('catalog identifies persisted projects without reading history or enrolling old sessions', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'project-a'), b = await projectAgent(h, t, 'project-b');
  const before = c.store.listWorkspaces(); assert.equal(before.length, 0);
  const catalog = await catalogFor(c);
  assert.equal(catalog.selectedSessionId, null); assert.equal(catalog.projects.length, 2);
  const project = catalog.projects.find(p => p.id === a.workspace.id);
  assert.equal(project.registered, false); assert.deepEqual(project.sessions.map(s => s.id), [a.agent.id]);
  assert.equal(project.sessions[0].canManage, true); assert.equal(project.sessions[0].live, true);
  assert.ok(!project.sessions.some(s => s.id === b.agent.id));
  assert.equal(c.store.listWorkspaces().length, 0, 'Catalog browsing must not enroll project history');
  const state = await stateFor(c, { workspaceId: a.workspace.id });
  assert.equal(state.sessionId, null); assert.equal(state.workspace.id, a.workspace.id); assert.equal(state.capabilities.manage, true);
  assert.equal(c.store.listSessions(a.workspace.id).length, 0, 'Selecting a project must not include its old sessions');
  assert.equal(h.calls.length, 0);
});

test('project catalog and scoped controls work after its original session and directory are absent', async t => {
  const { h, c } = await setup(t);
  const root = path.join(h.temp, 'past-project'); mkdirSync(root);
  const workspace = workspaceIdentity(root); c.store.registerWorkspace(workspace);
  const created = c.store.submit(createDraft, { workspaceId: workspace.id, requestId: 'seed', channel: 'G1' });
  const memoryId = created.results[0].memory_id; rmSync(root, { recursive: true });
  const catalog = await catalogFor(c), project = catalog.projects.find(p => p.id === workspace.id);
  assert.ok(project); assert.equal(project.sessions.length, 0); assert.equal(project.registered, true);
  const state = await stateFor(c, { workspaceId: workspace.id });
  assert.equal(state.memories[0].id, memoryId); assert.equal(state.capabilities.manage, true);
  const read = await actionFor(c, { workspaceId: workspace.id, action: 'read', ids: [memoryId] });
  assert.match(read.items[0].markdown, /accessible without any conversation/);
  const disabled = await actionFor(c, { workspaceId: workspace.id, action: 'project-toggle', enabled: false });
  assert.equal(disabled.workspace.enabled, false);
  assert.equal((await stateFor(c, { workspaceId: workspace.id })).workspace.enabled, false);
  await assert.rejects(stateFor(c, { workspaceId: '/arbitrary/untrusted/path' }), { code: 'PROJECT_NOT_FOUND' });
  assert.equal(h.calls.length, 0);
});

test('global project actions reject a foreign session and manage requires an explicitly confirmed target', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'manage-a'), b = await projectAgent(h, t, 'manage-b');
  const request = { action: 'manage', workspaceId: a.workspace.id, sessionId: a.agent.id, expectedWorkspaceId: a.workspace.id, confirmedSessionId: a.agent.id, text: 'Explain the current project memory.' };
  await assert.rejects(actionFor(c, { ...request, confirmedSessionId: undefined }), { code: 'INVALID_ACTION' });
  await assert.rejects(actionFor(c, { ...request, confirmedSessionId: b.agent.id }), { code: 'TARGET_SESSION_UNCONFIRMED' });
  await assert.rejects(actionFor(c, { ...request, expectedWorkspaceId: b.workspace.id }), { code: 'SOURCE_SCOPE_MISMATCH' });
  await assert.rejects(actionFor(c, { ...request, sessionId: b.agent.id, confirmedSessionId: b.agent.id }), { code: 'SOURCE_SCOPE_MISMATCH' });
  await assert.rejects(stateFor(c, { sessionId: a.agent.id, workspaceId: b.workspace.id }), { code: 'SOURCE_SCOPE_MISMATCH' });
  assert.equal(h.calls.length, 0, 'Rejected selection must not dispatch to either native agent');
  const accepted = await actionFor(c, request); assert.equal(accepted.status, 'accepted'); assert.equal(accepted.sessionId, a.agent.id);
  await a.agent.whenIdle();
  assert.ok(h.calls.some(call => call.sessionId === a.agent.id)); assert.ok(!h.calls.some(call => call.sessionId === b.agent.id));
});

test('history inclusion and Dreamer enqueue use the selected known project without a current conversation', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'history-a'), b = await projectAgent(h, t, 'history-b');
  await stateFor(c, { workspaceId: a.workspace.id });
  await assert.rejects(actionFor(c, { action: 'include-sessions', workspaceId: a.workspace.id, sessionIds: [b.agent.id] }), { code: 'SOURCE_SCOPE_MISMATCH' });
  assert.equal(c.store.listSessions(a.workspace.id).length, 0);
  const included = await actionFor(c, { action: 'include-sessions', workspaceId: a.workspace.id, sessionIds: [a.agent.id] });
  assert.equal(included.status, 'committed'); assert.equal(c.store.listSessions(a.workspace.id)[0].managed_start, -1);
  const job = await actionFor(c, { action: 'dream', workspaceId: a.workspace.id });
  assert.equal(job.status, 'accepted'); assert.equal(c.store.getJob(job.job_id).workspace_id, a.workspace.id);
  assert.equal(c.store.getJob(job.job_id).status, 'queued'); assert.equal(h.calls.length, 0, 'The API only enqueues; this test never executes a background model');
});

test('history selection remains available when an otherwise managed session has an off-period gap', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'history-gap');
  await stateFor(c, { workspaceId: a.workspace.id });
  c.store.registerSession({ workspaceId: a.workspace.id, sessionId: a.agent.id, newSession: true });
  const observe = headSeq => c.store.updateSessionHead({ workspaceId: a.workspace.id, sessionId: a.agent.id, headSeq, eventOnly: true });
  observe(0);
  assert.equal((await stateFor(c, { workspaceId: a.workspace.id })).sessions[0].included, true);
  c.store.setWorkspaceEnabled(a.workspace.id, false);
  observe(1);
  c.store.setWorkspaceEnabled(a.workspace.id, true);
  observe(2);
  assert.equal(c.store.listSessions(a.workspace.id)[0].managed_start, -1, 'Legacy prefix flag alone cannot describe a gap');
  assert.equal((await stateFor(c, { workspaceId: a.workspace.id })).sessions[0].included, false, 'The historical inclusion UI must permit selecting the missing interval');
  await actionFor(c, { action: 'include-sessions', workspaceId: a.workspace.id, sessionIds: [a.agent.id] });
  assert.equal((await stateFor(c, { workspaceId: a.workspace.id })).sessions[0].included, true);
  assert.equal(h.calls.length, 0);
});

test('native workspaces own names/order/add/delete; history never recreates removed choices', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'native-a'), b = await projectAgent(h, t, 'native-b');
  let items = [];
  h.ctx.provide('workspaceRegistry', { list: () => items });
  assert.deepEqual((await catalogFor(c)).projects, [], 'History must not create a sidebar workspace');
  items = [{ id: 'native-b', title: 'Beta display name', path: b.workspace.root, sessionIds: [b.agent.id] }, { id: 'native-a', title: 'Alpha display name', path: a.workspace.root, sessionIds: [a.agent.id] }];
  let catalog = await catalogFor(c);
  assert.deepEqual(catalog.projects.map(p => p.name), ['Beta display name', 'Alpha display name']);
  assert.deepEqual(catalog.projects.map(p => p.key), ['native-b', 'native-a']);
  assert.equal(c.store.listWorkspaces().length, 0, 'Reading native registrations must not enrol history');
  await stateFor(c, { workspaceId: a.workspace.id });
  c.store.submit(createDraft, { workspaceId: a.workspace.id, requestId: 'native-seed', channel: 'G1' });
  const memoryId = c.store.browse({ workspaceId: a.workspace.id }).entries[0].id;
  items[1].title = 'Renamed Alpha';
  assert.equal((await catalogFor(c)).projects[1].name, 'Renamed Alpha');
  items = items.slice(0, 1);
  catalog = await catalogFor(c);
  assert.deepEqual(catalog.projects.map(p => p.key), ['native-b']);
  assert.equal(catalog.retainedProjects[0].name, 'Renamed Alpha');
  assert.equal(catalog.retainedProjects[0].automaticConsolidationPaused, true);
  const state = await stateFor(c, { workspaceId: a.workspace.id });
  assert.equal(state.workspace.detached, true); assert.equal(state.memories[0].id, memoryId);
  c.store.setWorkspaceEnabled(a.workspace.id, false);
  items.push({ id: 'new-native-a', title: 'Restored Alpha', path: a.workspace.root, sessionIds: [a.agent.id] });
  catalog = await catalogFor(c);
  assert.equal(catalog.projects[1].id, a.workspace.id); assert.equal(catalog.projects[1].enabled, false);
  assert.deepEqual(catalog.retainedProjects, []); assert.equal(h.calls.length, 0);
});

test('empty native workspace is selectable; a disappeared directory keeps its known memory identity', async t => {
  const { h, c } = await setup(t);
  const root = path.join(h.temp, 'empty-native'); mkdirSync(root);
  const item = { id: 'empty-native', title: 'Empty workspace', path: root, sessionIds: [] };
  h.ctx.provide('workspaceRegistry', { list: () => [item] });
  const project = (await catalogFor(c)).projects[0];
  assert.equal(project.canBrowse, true); assert.deepEqual(project.sessions, []);
  await stateFor(c, { workspaceId: project.id });
  rmSync(root, { recursive: true });
  const after = (await catalogFor(c)).projects[0];
  assert.equal(after.id, project.id); assert.equal(after.canBrowse, true);
  assert.equal((await stateFor(c, { workspaceId: project.id })).workspace.detached, false);
});

test('removed workspace suspends automatic Dreamer queue and rejects late commits without changing memories', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'dream-native');
  const item = { id: 'dream-native', title: 'Dream workspace', path: a.workspace.root, sessionIds: [a.agent.id] };
  let items = [item]; h.ctx.provide('workspaceRegistry', { list: () => items });
  await stateFor(c, { workspaceId: a.workspace.id });
  // Synthetic clock and evidence make a real automatic job eligible without waiting a day.
  const initialTime = Date.now(); c.store.clock = () => initialTime + 3 * 86400000;
  c.store.registerSession({ workspaceId: a.workspace.id, sessionId: a.agent.id, newSession: true });
  c.store.updateSessionHead({ workspaceId: a.workspace.id, sessionId: a.agent.id, headSeq: 1 });
  const queued = await c.requestDream(a.workspace, false);
  items = [];
  assert.equal((await c.requestDream(a.workspace, false)).status, 'deferred');
  assert.equal(c.store.claimJob({ owner: 'fixture', automaticWorkspaceIds: c.automaticWorkspaceIds() }), null);
  assert.equal(c.store.getJob(queued.job_id).status, 'queued');
  items = [item];
  const job = c.store.claimJob({ owner: 'fixture', automaticWorkspaceIds: c.automaticWorkspaceIds() });
  assert.equal(job.id, queued.job_id);
  items = [];
  assert.throws(() => c.commitJob(job, createDraft), { code: 'WORKSPACE_REMOVED' });
  assert.equal(c.store.getJob(job.id).status, 'cancelled');
  assert.equal(c.store.browse({ workspaceId: a.workspace.id }).entries.length, 0);
  assert.equal(c.store.getWorkspace(a.workspace.id).enabled, true);
  assert.equal(h.calls.length, 0);
});

test('workspace registry failures never masquerade as deletion or an empty registry', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'registry-fault');
  await stateFor(c, { workspaceId: a.workspace.id });
  h.ctx.provide('workspaceRegistry', { list: () => { throw new Error('Fixture registry unavailable'); } });
  await assert.rejects(catalogFor(c), /Fixture registry unavailable/);
  await assert.rejects(c.requestDream(a.workspace, false), /Fixture registry unavailable/);
  assert.equal(c.store.getWorkspace(a.workspace.id).enabled, true);
  assert.equal(c.store.listJobs({ workspaceId: a.workspace.id }).length, 0);
  assert.equal(h.calls.length, 0);
});

test('history presentation distinguishes native blank metadata from enrollment and never uses an ID as a title', async t => {
  const { h, c } = await setup(t);
  const a = await projectAgent(h, t, 'history-presentation');
  c.bind(a.agent.session);
  h.ctx.provide('sessionController', { list: async () => ({ items: [{ sessionId: a.agent.id, blank: true, updatedAt: 1234 }] }) });
  let state = await stateFor(c, { workspaceId: a.workspace.id });
  const blank = state.sessions.find(s => s.id === a.agent.id);
  assert.equal(blank.blank, true); assert.equal(blank.included, true);
  assert.equal(blank.title, null); assert.equal(blank.updatedAt, 1234);
  const listSessions = c.host.listSessions;
  c.host.listSessions = async (...args) => (await listSessions(...args)).map(item => ({ ...item, title: '较早的会话标题' }));
  h.ctx.sessionController.list = async () => ({ items: [{ sessionId: a.agent.id, blank: false, updatedAt: 5678,
    projections: { kind: 'sequenced', asOfSeq: 12, values: { title: '最新的原生会话标题', sessionListMetadata: { blank: false } } } }] });
  state = await stateFor(c, { workspaceId: a.workspace.id });
  assert.equal(state.sessions.find(s => s.id === a.agent.id).blank, false);
  assert.equal(state.sessions.find(s => s.id === a.agent.id).title, '最新的原生会话标题', 'Official native projection title takes precedence over stale metadata');
  h.ctx.sessionController.list = async () => ({ items: [{ sessionId: a.agent.id, blank: false,
    projections: { kind: 'cached', asOfSeq: 12, values: { title: a.agent.id, sessionListMetadata: { blank: false } } } }] });
  state = await stateFor(c, { workspaceId: a.workspace.id });
  assert.equal(state.sessions.find(s => s.id === a.agent.id).title, '较早的会话标题', 'An identifier in the native hint must not suppress a valid metadata title');
  c.host.listSessions = async (...args) => (await listSessions(...args)).map(item => ({ ...item, title: item.id || item.sessionId }));
  h.ctx.sessionController.list = async () => ({ items: [{ sessionId: a.agent.id, blank: false,
    projections: { kind: 'cached', asOfSeq: 12, values: { title: 'session-12345678-1234-1234-1234-123456789abc', sessionListMetadata: { blank: false } } } }] });
  state = await stateFor(c, { workspaceId: a.workspace.id });
  assert.equal(state.sessions.find(s => s.id === a.agent.id).title, null, 'Raw IDs never become human-facing history titles');
  assert.equal(h.calls.length, 0, 'Metadata browsing neither calls a model nor starts a conversation');
});


test('small cold history metadata is revision-cached and a new real turn invalidates blank', async () => {
  let revision = 'r1', reads = 0, disposals = 0;
  const persistence = { stat: async () => ({ revision, sizeBytes: 300 }) };
  const query = { observeSession: async (_id, options) => {
    assert.equal(options.projectionMode, 'all'); reads++;
    return { revision, events: [], projections: { values: { title: '真实原生标题', sessionListMetadata: { blank: revision === 'r1' } } }, [Symbol.dispose]() { disposals++; } };
  } };
  const c = { ctx: { sessions: { get: () => undefined }, get: name => ({ sessionPersistence: persistence, sessionQuery: query })[name] } };
  const fallback = { blank: false };
  assert.equal((await historyMetadataFor(c, { id: 'cold' }, fallback)).blank, true);
  assert.equal((await historyMetadataFor(c, { id: 'cold' }, fallback)).blankKnown, true);
  assert.equal(reads, 1, 'Repeated state refresh must not reread an unchanged cold log');
  revision = 'r2';
  const changed = await historyMetadataFor(c, { id: 'cold' }, fallback);
  assert.equal(changed.blank, false); assert.equal(changed.title, '真实原生标题');
  assert.equal(reads, 2); assert.equal(disposals, 2);
});

test('large, inaccessible, or metadata-less cold sessions remain unknown and visible without body scans', async () => {
  let reads = 0;
  const query = { observeSession: async () => { reads++; throw Error('must not read'); } };
  for (const stat of [async () => ({ revision: 'r1', sizeBytes: 65537 }), async () => ({ revision: 'r1' }), async () => { throw Error('offline'); }]) {
    const persistence = { stat }, c = { ctx: { sessions: { get: () => undefined }, get: name => ({ sessionPersistence: persistence, sessionQuery: query })[name] } };
    const result = await historyMetadataFor(c, { id: 'cold' }, { blank: false });
    assert.deepEqual(result, { blankKnown: false });
  }
  assert.equal(reads, 0);
});


test('cold history recovery bounds aggregate reads, physical bytes, and cancellation per state request', async () => {
  let reads = 0;
  const persistence = { stat: async () => { throw Error('Listed snapshots already have bounded metadata'); } };
  const query = { observeSession: async () => { reads++; return { revision: 'r1', events: [], [Symbol.dispose]() {} }; } };
  const c = { ctx: { sessions: { get: () => undefined }, get: name => ({ sessionPersistence: persistence, sessionQuery: query })[name] } };
  const budget = { reads: 0, checks: 0, bytes: 0, signal: new AbortController().signal };
  for (let i = 0; i < 10; i++) await historyMetadataFor(c, { id: 'small-' + i, revision: 'r1', sizeBytes: 100 }, {}, budget);
  assert.equal(reads, 8, 'At most eight cold bodies are recovered in one state request');
  const byteBudget = { reads: 0, checks: 0, bytes: 0, signal: new AbortController().signal };
  for (let i = 0; i < 6; i++) await historyMetadataFor(c, { id: 'bounded-' + i, revision: 'r1', sizeBytes: 65536 }, {}, byteBudget);
  assert.equal(byteBudget.reads, 4); assert.equal(byteBudget.bytes, 256 * 1024);
  const stop = new AbortController(); stop.abort();
  const expired = { reads: 0, checks: 0, bytes: 0, signal: stop.signal };
  assert.deepEqual(await historyMetadataFor(c, { id: 'timeout', revision: 'r1', sizeBytes: 100 }, {}, expired), { blankKnown: false });
  assert.equal(expired.reads, 0);
});
