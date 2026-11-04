import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { zh, en, translator } from '../src/i18n.js';

const require = createRequire(import.meta.url);
const { build } = require('esbuild');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundle = await build({ entryPoints: [path.join(root, 'src/client.js')], bundle: true, platform: 'browser', format: 'iife', globalName: 'AutoMemoryClient', write: false });

function client(fetchImpl = async () => { throw new Error('Unexpected fetch'); }) {
  const sandbox = { React: {}, STYLE: '', URLSearchParams, AbortController, fetch: fetchImpl };
  vm.runInNewContext(bundle.outputFiles[0].text, sandbox);
  return sandbox.AutoMemoryClient;
}
const response = (body, status = 200, type = 'application/json') => ({ status, ok: status >= 200 && status < 300, headers: { get: () => type }, json: async () => body });
const plain = value => JSON.parse(JSON.stringify(value));

test('client binds the requested session, uses native authentication and forwards cancellation', async () => {
  let request;
  const signal = new AbortController().signal;
  const api = client(async (url, options) => { request = { url, options }; return response({ ok: true, data: { status: 'accepted', job_id: 'J1' } }); });
  await api.apiRequest('session-A', 'manage', { text: 'Remember this', sessionId: 'forged', action: 'delete' }, signal);
  assert.equal(request.url, '/api/dsh-automemory/action');
  assert.equal(request.options.credentials, 'same-origin');
  assert.equal(request.options.signal, signal);
  assert.deepEqual(JSON.parse(request.options.body), { text: 'Remember this', sessionId: 'session-A', action: 'manage' });
});

test('a late response for another session is rejected before presentation', async () => {
  const api = client(async () => response({ ok: true, data: { sessionId: 'session-B', workspace: { id: 'secret-project' } } }));
  await assert.rejects(api.apiRequest('session-A'), error => error.code === 'sessionMismatch');
});

test('permission, unloaded service, malformed and failed replies never become success receipts', async () => {
  for (const [reply, code] of [
    [response({}, 403), 'accessDenied'],
    [response({}, 404, 'text/html'), 'unavailable'],
    [response({ ok: true }), 'responseInvalid'],
    [response({ ok: false, error: { code: 'VERSION_CONFLICT', message: 'Version changed' } }, 409), 'VERSION_CONFLICT'],
  ]) {
    const api = client(async () => reply);
    await assert.rejects(api.apiRequest('session-A', 'project-toggle', { enabled: false }), error => error.code === code);
  }
});

test('receipts distinguish accepted work from commits and incomplete deletion', () => {
  const api = client();
  assert.deepEqual(plain(api.receiptPresentation({ status: 'accepted', job_id: 'J1' })), { status: 'accepted', tone: 'warning', jobId: 'J1', errors: [], results: [] });
  const incomplete = api.receiptPresentation({ status: 'committed', cleanup_status: 'incomplete', scope_statement: 'Formal entry and plugin copies' });
  assert.equal(incomplete.status, 'committed');
  assert.equal(incomplete.tone, 'warning');
  assert.equal(incomplete.cleanup, 'incomplete');
  assert.equal(api.receiptPresentation({ status: 'failed' }).tone, 'error');
  assert.equal(api.receiptPresentation({}).status, 'unknown');
});

test('consolidation feed excludes G1/G2, no-ops, candidates and failures', () => {
  const api = client();
  const items = [
    { id: 'a', channel: 'DREAMING', status: 'committed', changed: true },
    { id: 'b', channel: 'G1', status: 'committed', changed: true },
    { id: 'c', channel: 'G2', status: 'committed', changed: true },
    { id: 'd', channel: 'DREAMING', status: 'no_change', changed: false },
    { id: 'e', channel: 'DREAMING', status: 'accepted', changed: true },
    { id: 'f', channel: 'DREAMING', status: 'failed', changed: true },
    { id: 'g', channel: 'DREAMING', status: 'committed', changed: false },
  ];
  assert.deepEqual(Array.from(api.visibleDreamActivity(items), x => x.id), ['a']);
});

test('job usage keeps unknown distinct from zero and never derives input or totals from cache reads', () => {
  const api = client();
  const values = (usage, locale) => Object.fromEntries(api.usagePresentation(usage, translator(locale)).map(row => [row.key, row.value]));
  assert.deepEqual(values({ calls: 0, totalTokens: null, cacheReadTokens: 0, cost: null }, 'en'), { calls: '0', totalTokens: 'Unknown', cacheReadTokens: '0', cost: 'Unknown' });
  assert.deepEqual(values(undefined, 'zh'), { calls: '未知', totalTokens: '未知', cacheReadTokens: '未知', cost: '未知' });
  assert.deepEqual(values({ calls: 2, totalTokens: 1200, cacheReadTokens: 800, cost: 0 }, 'en'), { calls: '2', totalTokens: '1,200', cacheReadTokens: '800', cost: '0' });
  assert.equal(values({ cacheReadTokens: 800 }, 'en').totalTokens, 'Unknown');
  assert.equal(values({ totalTokens: NaN, cost: -1 }, 'en').cost, 'Unknown');
});

test('missing model service is visible waiting work, not a failure or a stale terminal label', () => {
  const api = client(), deferral = { code: 'MODEL_ROUTE_UNAVAILABLE', message: 'Provider zai is not registered on this host.' };
  const pending = api.jobPresentation({ status: 'queued', deferral }, translator('zh'));
  assert.equal(pending.waiting, true); assert.equal(pending.label, '等待模型服务');
  assert.match(pending.message, /不会自动改用/);
  assert.equal(api.jobPresentation({ status: 'running' }, translator('en')).label, 'Running');
  const terminal = api.jobPresentation({ status: 'completed', deferral }, translator('zh'));
  assert.equal(terminal.waiting, false); assert.equal(terminal.label, '已完成'); assert.equal(terminal.message, null);
  const failed = api.jobPresentation({ status: 'failed', error: { code: 'NETWORK_FAILED' } }, translator('zh'));
  assert.equal(failed.label, '失败'); assert.match(failed.message, /未完成/);
});

test('settings prevent sub-daily automatic runs and incomplete model routes', () => {
  const api = client();
  const base = { models: { g2: null, dreamer: { provider: 'deepseek', model: 'deepseek-flash' }, reviewer: { provider: 'another', model: 'reviewer' } }, dreamIntervalHours: '24', auditRetentionDays: '30', budget: { maxInputTokens: '131072', maxOutputTokens: '4096', maxSteps: '8', maxDailyTokens: '1000000' } };
  const valid = api.normaliseSettings(base);
  assert.equal(valid.dreamIntervalHours, 24);
  assert.equal(valid.models.g2, null);
  assert.equal(valid.models.reviewer.provider, 'another');
  for (const invalid of [
    { ...base, dreamIntervalHours: 23 },
    { ...base, dreamIntervalHours: '24.5' },
    { ...base, models: { ...base.models, dreamer: null } },
    { ...base, models: { ...base.models, g2: { provider: 'deepseek' } } },
    { ...base, budget: { ...base.budget, maxSteps: 'Infinity' } },
  ]) assert.throws(() => api.normaliseSettings(invalid));
});

test('global page and workspace-above navigation use public slots and dispose cleanly', () => {
  const api = client(), slots = [], dictionaries = [], effects = [];
  let releases = 0;
  const ctx = {
    locale: { bind: () => translator('en'), register: (namespace, value) => { dictionaries.push({ namespace, value }); return () => releases++; } },
    effect: fn => { const disposer = fn(); effects.push(disposer); return disposer; },
    on: () => () => {},
    remote: { session: { modelCatalog: async () => { throw Error('Catalog should load only when settings are opened'); } }, $on: () => () => {} },
    uiWorkspace: { openSession() {} },
    slots: { inject: (_name, fn) => fn(), register: (definition, component) => { slots.push({ definition, component }); return () => releases++; } },
  };
  api.apply(ctx);
  assert.equal(dictionaries[0].namespace, 'autoMemory');
  assert.deepEqual(slots.map(x => x.definition.name), ['main', 'sidebar.panellist']);
  assert.equal(slots[0].definition.key, 'autoMemory');
  assert.equal(slots[1].definition.id, 'autoMemory');
  assert.equal(slots[1].definition.label(), 'Memory');
  assert.equal(slots[1].definition.order, 15);
  assert.ok(!slots.some(x => /sidebar\.right|header\.utilities/.test(x.definition.name)));
  effects.forEach(dispose => dispose());
  assert.equal(releases, 3);
});

test('global access needs no conversation, and project actions cannot override their selected scope', async () => {
  const requests = [];
  const api = client(async (url, options) => { requests.push({url, options}); return response({ok:true,data:{status:'committed'}}); });
  await api.apiRequest(null); assert.equal(requests.at(-1).url, '/api/dsh-automemory/global');
  await api.catalogRequest(); assert.equal(requests.at(-1).url, '/api/dsh-automemory/catalog');
  await api.apiRequest({workspaceId:'project-A'}, 'project-toggle', {workspaceId:'project-B',sessionId:'hidden-old-chat',enabled:false});
  assert.deepEqual(JSON.parse(requests.at(-1).options.body), {enabled:false,workspaceId:'project-A',action:'project-toggle'});
  await assert.rejects(api.apiRequest(null,'manage',{text:'hello'}), error=>error.code==='noSession');
  const mismatched = client(async()=>response({ok:true,data:{workspace:{id:'project-B'}}}));
  await assert.rejects(mismatched.apiRequest({workspaceId:'project-A'}), error=>error.code==='sessionMismatch');
});

test('default library includes active and stable current entries, while history and filtering stay explicit', () => {
  const api=client();
  const rows=[{id:'s',status:'current',content:{category:'stable',title:'Release contract',group:'API'}},{id:'a',status:'current',content:{category:'active',title:'Pending migration',group:'DB'}},{id:'h',status:'archived',content:{category:'stable',title:'Old protocol'}}];
  assert.deepEqual(Array.from(api.filterMemories(rows),x=>x.id),['a','s']);
  assert.deepEqual(Array.from(api.filterMemories(rows,'history'),x=>x.id),['h']);
  assert.deepEqual(Array.from(api.filterMemories(rows,'all','api'),x=>x.id),['s']);
});

test('legacy sidebar migration closes only AutoMemory in the still-mounted session and cancels on dispose', () => {
  const api=client(), frames=new Map(), listeners=new Set(), closed=[]; let next=0,mounted='A';
  const source={subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}};
  const sidebar={mounted:{...source,getSnapshot:()=>mounted},openTabs:source,tabsIn:id=>[{id:id+'-old',kind:'autoMemory'},{id:id+'-context',kind:'contextLite'}],close:id=>closed.push(id)};
  const schedule=fn=>{frames.set(++next,fn);return next;},cancel=id=>frames.delete(id);
  const flush=()=>{const run=[...frames.values()];frames.clear();run.forEach(fn=>fn());};
  const stop=api.migrateLegacyTabs(sidebar,schedule,cancel);
  flush();flush(); assert.deepEqual(closed,['A-old']);
  [...listeners].forEach(fn=>fn()); mounted='B'; flush();flush();assert.deepEqual(closed,['A-old']);
  [...listeners].forEach(fn=>fn());stop();flush();flush();assert.equal(listeners.size,0);assert.deepEqual(closed,['A-old']);
});

test('availability monitor hides an unavailable host, restores it, and releases its poll/listeners', async () => {
  const api = client(), values = [], listeners = new Map();
  let interval, cleared = false, reply = response({ ok: true, data: { enabled: true } });
  const target = { hidden: false, addEventListener: (name, fn) => listeners.set(name, fn), removeEventListener: name => listeners.delete(name) };
  const calls = [];
  const monitor = api.createAvailabilityMonitor({ request: async (url, options) => { calls.push({ url, options }); return reply; }, onChange: value => values.push(value), timers: { setInterval: (fn, ms) => { assert.equal(ms, 2000); interval = fn; return 7; }, clearInterval: id => { assert.equal(id, 7); cleared = true; } }, documentTarget: target, windowTarget: target });
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(values, [true]);
  reply = response({}, 404, 'text/plain'); await monitor.check();
  assert.deepEqual(values, [true, false]);
  reply = response({ ok: true, data: { enabled: true } }); await monitor.check();
  assert.deepEqual(values, [true, false, true]);
  assert.ok(calls.every(x => x.url === '/api/dsh-automemory/status' && x.options.credentials === 'same-origin'));
  target.hidden = true; const before = calls.length; await monitor.check(); assert.equal(calls.length, before);
  target.hidden = false; listeners.get('visibilitychange')(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.length, before + 1);
  monitor.dispose(); assert.equal(cleared, true); assert.equal(listeners.size, 0);
  interval(); await monitor.check(); assert.equal(calls.length, before + 1);
});

test('locale dictionaries have matching keys and no unresolved translated parameters', () => {
  assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort());
  for (const locale of ['zh', 'en']) assert.doesNotMatch(translator(locale)('includeSelected', { count: 3 }), /\{count\}/);
});

test('workspace selector follows native names, order and deletion without merging same-project aliases', () => {
  const api = client();
  const projects = [
    { id: 'memory-1', nativeWorkspaceId: 'n1', name: 'Old A', sessions: [{ id: 's1' }, { id: 's2' }] },
    { id: 'memory-1', nativeWorkspaceId: 'n2', name: 'Worktree B', sessions: [{ id: 's2' }] },
    { id: 'memory-old', nativeWorkspaceId: 'gone', name: 'Deleted', sessions: [] },
  ];
  const snapshot = [
    { workspaceId: 'n2', title: 'Renamed B', path: '/b', sessionIds: ['s2'] },
    { workspaceId: 'n1', title: 'Renamed A', path: '/a', sessionIds: ['s1'] },
    { workspaceId: 'new', title: 'Empty new workspace', path: '/new', sessionIds: [] },
  ];
  const result = plain(api.workspaceProjects(projects, snapshot));
  assert.deepEqual(result.map(p => p.key), ['n2', 'n1', 'new']);
  assert.deepEqual(result.map(p => p.name), ['Renamed B', 'Renamed A', 'Empty new workspace']);
  assert.deepEqual(result[1].sessions, [{ id: 's1' }]);
  assert.equal(result[2].canBrowse, false, 'Do not guess a memory identity before the host resolves it');
  assert.deepEqual(plain(api.workspaceProjects(projects, [])), []);
});

test('embedded manager opens a fresh scoped conversation and closes a late open after navigation away', async () => {
  const api = client(), calls = [], snapshots = [], timers = { setInterval: () => 1, clearInterval() {} };
  let finish;
  const channel = api.createManagerChannel({ timers, newId: () => 'visit-A', onChange: state => snapshots.push(state), request: async (action, params) => {
    calls.push({ action, params });
    if (action === 'manager-open') return new Promise(resolve => { finish = resolve; });
    return { id: params.conversationId, status: 'closed', messages: [] };
  } });
  const opened = channel.start(); channel.dispose();
  finish({ id: 'manager-A', status: 'ready', messages: [] }); await opened;
  assert.deepEqual(calls.map(x => x.action), ['manager-open', 'manager-close']);
  assert.equal(snapshots.length, 0, 'A late open cannot appear in another workspace');
  assert.equal(calls[1].params.conversationId, 'manager-A');
});

test('embedded conversation retains context while sending, polls only running work and rejects foreign replies', async () => {
  const api = client(), calls = [], snapshots = [];
  let tick, clears = 0, state = { id: 'M-A', status: 'ready', messages: [] }, sequence = 0;
  const channel = api.createManagerChannel({ newId: () => 'req-' + ++sequence, timers: { setInterval: fn => { tick = fn; return 5; }, clearInterval: () => clears++ }, onChange: value => snapshots.push(value), request: async (action, params) => {
    calls.push({ action, params });
    if (action === 'manager-send') state = { id: 'M-A', status: 'running', messages: [{ id: 'msg-1', role: 'user', text: params.text }] };
    if (action === 'manager-close') return { id: 'M-A', status: 'closed', messages: [] };
    return state;
  } });
  await channel.start(); tick(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.length, 1, 'An idle conversation needs no continual state polling');
  await channel.send('Resolve this discrepancy', { topicId: 'topic-1', issueId: 'issue-2' });
  const send = calls.find(call => call.action === 'manager-send');
  assert.deepEqual(plain(send.params), { topicId: 'topic-1', issueId: 'issue-2', conversationId: 'M-A', text: 'Resolve this discrepancy', requestId: 'req-2' });
  tick(); await new Promise(resolve => setImmediate(resolve)); assert.equal(calls.at(-1).action, 'manager-state');
  state = { id: 'M-B', status: 'ready', messages: [{ role: 'assistant', text: 'Another project' }] };
  await channel.refresh();
  assert.equal(snapshots.at(-1).id, 'M-A'); assert.equal(snapshots.at(-1).connectionError.code, 'sessionMismatch');
  assert.ok(!snapshots.some(item => item.id === 'M-B'));
  channel.dispose(); assert.equal(clears, 1);
});

test('global profile management uses its own conversation without a receiving native session', async () => {
  const calls = [];
  const api = client(async (url, options) => { calls.push({ url, options }); return response({ ok: true, data: { id: 'profile-conversation', scope: 'user', status: 'ready', messages: [] } }); });
  await api.apiRequest(null, 'manager-open', { scope: 'user', requestId: 'open-profile' });
  await api.apiRequest(null, 'manager-send', { scope: 'user', conversationId: 'profile-conversation', text: 'Prefer concise Chinese replies', requestId: 'profile-write' });
  const bodies = calls.map(call => JSON.parse(call.options.body));
  assert.ok(bodies.every(body => !('sessionId' in body) && !('workspaceId' in body)));
  assert.equal(bodies[1].scope, 'user'); assert.equal(bodies[1].conversationId, 'profile-conversation');
});

test('memory activity includes actual changes from all channels but not execution-only events', () => {
  const api = client();
  const changes = ['G1', 'G2', 'DREAMING', 'MEMORY_UI'].map(channel => ({ id: channel, channel, changed: true, status: 'committed', before: '', after: 'saved fact' }));
  const rows = [...changes, { id: 'running', status: 'accepted', changed: true, after: 'candidate' }, { id: 'overview', event_type: 'overview.organized', status: 'committed', changed: true }, { id: 'resolved', event_type: 'issue.resolved', status: 'committed', changed: true }, { id: 'toggle', status: 'committed', changed: true }, { id: 'no-change', status: 'committed', changed: false, after: '' }];
  assert.deepEqual(Array.from(api.visibleMemoryActivity(rows), row => row.id), ['G1', 'G2', 'DREAMING', 'MEMORY_UI', 'overview', 'resolved']);
});

test('history selection hides confirmed blanks and distinguishes selectable conversations from existing coverage', () => {
  const api = client(), t = translator('en');
  const sessions = [
    { id: 'blank', title: null, included: true },
    { id: 'metadata-blank', title: 'Placeholder', blank: true, included: false },
    { id: 'covered', title: null, included: true },
    { id: 'selectable', title: 'Old title', included: false },
    { id: 'nonblank', title: 'Keep this actual conversation', blank: true, included: false },
    { id: 'unknown', title: null, included: false },
    { id: 'session-12345678-1234-1234-1234-123456789abc', title: 'session-12345678-1234-1234-1234-123456789abc', included: false, updatedAt: '2026-11-01T00:00:00Z' },
  ];
  const native = { blank: { blank: true, displayTitle: 'New conversation' }, covered: { blank: false, title: 'Deployment decision', displayTitle: 'aurora', cwd: '/fixture/aurora' }, selectable: { blank: false, projectionValues: { title: 'Current title' }, displayTitle: 'aurora', cwd: '/fixture/aurora' }, nonblank: { blank: false }, unknown: { displayTitle: 'aurora', cwd: '/fixture/aurora' } };
  const result = plain(api.historySessionGroups(sessions, native, t));
  assert.deepEqual(result.covered.map(s => s.id), ['covered']);
  assert.equal(result.covered[0].title, 'Deployment decision');
  assert.deepEqual(result.selectable.map(s => s.id), ['selectable', 'nonblank', 'unknown', 'session-12345678-1234-1234-1234-123456789abc']);
  assert.equal(result.selectable[0].title, 'Current title');
  assert.equal(result.selectable[2].title, 'Untitled conversation', 'A cold cwd-basename fallback must not masquerade as an actual title or hide unknown history');
  assert.match(result.selectable[3].title, /^Untitled conversation · /);
  assert.doesNotMatch(result.selectable[3].title, /12345678|session-/);
  const filtered = plain(api.historySessionGroups(sessions, native, t, 'deployment'));
  assert.deepEqual(filtered.covered.map(s => s.id), ['covered']);
  assert.equal(filtered.selectable.length, 0);
  assert.equal(filtered.sessions.length, result.sessions.length, 'Filtering must not discard selected hidden candidates');
});

test('retained memory returns to its archive settings state including history selections and scroll', () => {
  const api = client();
  const home = { page: 'home', visit: 0, scrollTop: 90 };
  let settings = api.navigateMemoryPage(home, { type: 'settings', scrollTop: 90 });
  const state = { section: 'archive', projectKey: 'current-project', history: { 'current-project': { filter: 'deployment', selectedIds: ['old-A', 'old-B'] } } };
  settings = api.navigateMemoryPage(settings, { type: 'settings-state', value: state, scrollTop: 610 });
  const memory = api.navigateMemoryPage(settings, { type: 'workspace', key: 'retained:project', scrollTop: 610 });
  assert.equal(memory.page, 'workspace');
  const returned = api.navigateMemoryPage(memory, { type: 'back', scrollTop: 0 });
  assert.equal(returned.page, 'settings'); assert.equal(returned.scrollTop, 610);
  assert.deepEqual(plain(returned.settingsState), state);
  assert.equal(returned.returnTo.page, 'home'); assert.equal(returned.returnTo.scrollTop, 90);
  const reentered = api.navigateMemoryPage(returned, { type: 'workspace', key: 'retained:project', scrollTop: 610 });
  assert.ok(reentered.visit > memory.visit, 'Reentry must remount a fresh manager rather than restoring conversational context');
  const settingsButton = api.navigateMemoryPage(reentered, { type: 'settings', scrollTop: 0 });
  assert.equal(settingsButton.page, 'settings');
  assert.deepEqual(plain(settingsButton.settingsState), state);
  assert.equal(settingsButton.returnTo.page, 'home', 'The Settings button returns to its settings origin without nesting another copy');
});

test('settings opened from a current workspace returns to that workspace with a fresh management visit', () => {
  const api = client();
  const workspace = api.navigateMemoryPage({ page: 'home', visit: 0 }, { type: 'workspace', key: 'native-current' });
  const settings = api.navigateMemoryPage(workspace, { type: 'settings', scrollTop: 140 });
  const returned = api.navigateMemoryPage(settings, { type: 'back', scrollTop: 500 });
  assert.equal(returned.page, 'workspace'); assert.equal(returned.key, 'native-current'); assert.equal(returned.scrollTop, 140);
  assert.ok(returned.visit > workspace.visit); assert.equal(returned.returnTo.page, 'home');
});

test('late history inclusion removes only submitted selections without resetting newer filters or navigation', async () => {
  const api = client();
  let current = true, finish;
  let route = { page: 'settings', visit: 7, settingsState: { section: 'archive', projectKey: 'A', history: { A: { filter: 'before', selectedIds: ['sent'] }, B: { filter: 'other project', selectedIds: ['keep-B'] } } } };
  const onViewStateChange = update => {
    route = api.navigateMemoryPage(route, { type: 'settings-state', expectedVisit: 7, value: settings => ({ ...settings, history: { ...settings.history, A: update(settings.history.A) } }) });
  };
  const pending = api.includeHistorySelection({ sessionIds: ['sent'], act: async () => new Promise(resolve => { finish = resolve; }), isCurrent: () => current, onViewStateChange });
  route = api.navigateMemoryPage(route, { type: 'settings-state', expectedVisit: 7, value: settings => ({ ...settings, history: { ...settings.history, A: { filter: 'new filter while waiting', selectedIds: ['sent', 'new-choice'] } } }) });
  finish({ status: 'committed' }); await pending;
  assert.equal(route.settingsState.section, 'archive'); assert.equal(route.settingsState.projectKey, 'A');
  assert.equal(route.settingsState.history.A.filter, 'new filter while waiting');
  assert.deepEqual(plain(route.settingsState.history.A.selectedIds), ['new-choice']);
  assert.deepEqual(plain(route.settingsState.history.B), { filter: 'other project', selectedIds: ['keep-B'] });

  const departed = api.includeHistorySelection({ sessionIds: ['new-choice'], act: async () => new Promise(resolve => { finish = resolve; }), isCurrent: () => current, onViewStateChange });
  current = false;
  route = api.navigateMemoryPage(route, { type: 'workspace', key: 'retained:other' });
  const destination = plain(route);
  finish({ status: 'committed' }); await departed;
  assert.deepEqual(plain(route), destination, 'Unmounted picker must not update a different page');
  route = api.navigateMemoryPage(route, { type: 'back' });
  const reentered = plain(route);
  onViewStateChange(state => ({ ...state, filter: 'stale mutation' }));
  assert.deepEqual(plain(route), reentered, 'A callback from an older settings visit must not alter the new visit');
});

test('archive navigation captures scroll at the click and remains stable when a state updater is replayed', () => {
  const api = client();
  const route = { page: 'settings', visit: 4, scrollTop: 0, settingsState: { section: 'archive', projectKey: '', history: { aurora: { filter: 'scope', selectedIds: ['pending'] } } } };
  const element = { scrollTop: 110 };
  const update = api.captureMemoryNavigation({ type: 'workspace', key: 'retained:maple', settingsPatch: { projectKey: 'aurora' } }, element.scrollTop);
  element.scrollTop = 0; // React may execute/replay the queued updater after the DOM changes.
  const first = update(route), replay = update(route);
  assert.equal(first.returnTo.scrollTop, 110); assert.equal(replay.returnTo.scrollTop, 110);
  assert.equal(first.returnTo.settingsState.projectKey, 'aurora');
  assert.deepEqual(plain(first.returnTo.settingsState.history.aurora), { filter: 'scope', selectedIds: ['pending'] });
  const returned = api.navigateMemoryPage(replay, { type: 'back', scrollTop: 0 });
  assert.equal(returned.page, 'settings'); assert.equal(returned.scrollTop, 110);
});

test('verified backend blankness beats cold false while new nonblank evidence remains visible', () => {
  const api = client(), t = translator('en');
  const sessions = [
    { id: 'cold-empty', blankKnown: true, blank: true, title: null },
    { id: 'new-live', blankKnown: true, blank: true, title: 'New request' },
    { id: 'new-projection', blankKnown: true, blank: true, title: 'Finished request' },
    { id: 'backend-content', blankKnown: true, blank: false, title: 'Existing content' },
    { id: 'unknown-unreadable', blankKnown: false, title: 'Unknown history' },
  ];
  const native = {
    'cold-empty': { blank: false, running: false },
    'new-live': { blank: false, running: true, projectionValues: { sessionListMetadata: { blank: true } } },
    'new-projection': { blank: false, running: false, projectionValues: { sessionListMetadata: { blank: false } } },
    'backend-content': { blank: true, projectionValues: { sessionListMetadata: { blank: true } } },
    'unknown-unreadable': { blank: true, projectionValues: { sessionListMetadata: { blank: true } } },
  };
  const result = plain(api.historySessionGroups(sessions, native, t));
  assert.deepEqual(result.sessions.map(s => s.id), ['new-live', 'new-projection', 'backend-content', 'unknown-unreadable']);
  assert.equal(result.sessions[0].blank, false);
  assert.equal(result.sessions[1].blank, false);
  assert.equal(result.sessions[2].blank, false, 'A stale empty projection cannot hide verified content');
  assert.ok(!Object.hasOwn(result.sessions[3], 'blank'), 'Explicitly unknown backend state remains visible');
});

test('manager refresh and explicit resend are different actions and uncertain delivery reuses one idempotency key', async () => {
  const api = client(), calls = [], snapshots = []; let ids = 0, lost = true;
  const state = { id: 'manager-retry-test', status: 'ready', messages: [], retry: { mode: 'resend' } };
  const channel = api.createManagerChannel({ timers: { setInterval: () => 1, clearInterval() {} }, newId: () => 'key-' + ++ids, onChange: s => snapshots.push(s), request: async (action, params) => {
    calls.push({ action, params });
    if (action === 'manager-send' && lost) { lost = false; throw new Error('Network reply lost'); }
    return state;
  } });
  await channel.start(); await channel.refresh();
  assert.equal(calls.at(-1).action, 'manager-state');
  await assert.rejects(channel.send('保存约定'), /Network reply lost/);
  await channel.send('保存约定');
  const sends = calls.filter(c => c.action === 'manager-send'); assert.equal(sends[0].params.requestId, sends[1].params.requestId);
  await channel.retry(); assert.equal(calls.at(-1).action, 'manager-retry');
  assert.equal(api.managerRetryLabel('review'), 'reviewResult'); assert.equal(api.managerRetryLabel('resend'), 'resendRequest');
  channel.dispose();
});

test('refresh acknowledging an uncertain delivery does not turn the next same-content send into a duplicate', async () => {
  const api = client(), calls = []; let ids = 0, originalRequestId, lost = true;
  const channel = api.createManagerChannel({ timers: { setInterval: () => 1, clearInterval() {} }, newId: () => 'request-' + ++ids, onChange() {}, request: async (action, params) => {
    calls.push({ action, params });
    if (action === 'manager-send') { originalRequestId ||= params.requestId; if (lost) { lost = false; throw Error('Lost reply'); } }
    return { id: 'manager-ack', status: 'ready', messages: [], ...(originalRequestId ? { diagnostics: { requestId: 'manager-ack:' + originalRequestId } } : {}) };
  } });
  await channel.start(); await assert.rejects(channel.send('保存这条约定')); await channel.refresh(); await channel.send('保存这条约定');
  const sends = calls.filter(c => c.action === 'manager-send'); assert.equal(sends[0].params.requestId, sends[1].params.requestId);
  channel.dispose();
});
