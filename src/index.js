import path from 'node:path';
import os from 'node:os';
import { randomUUID } from 'node:crypto';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { MemoryController } from './controller.js';
import { installTurnMemory, isMemoryAgent } from './host/index.js';
import { MAIN_PROMPT } from './prompts.js';
import { workspaceIdentity } from './identity.js';
import { nativeWorkspacesFor } from './workspaces.js';
import { getOverview, updateOverview } from './overview.js';
import { MemoryManagementService } from './management.js';
import { contractSchema, normalizeSources, toolJsonObject, toolSourceRefs } from './validation.js';
import { renderMemory } from './core/index.js';

export const name = 'dsh-automemory';
export const inject = ['agents', 'sessions', 'sessionQuery', 'tools', 'systemPrompt', 'llm'];
const version = typeof __DAM_VERSION__ === 'string' ? __DAM_VERSION__ : '0.1.0';
const buildId = typeof __DAM_BUILD__ === 'string' ? __DAM_BUILD__ : 'source';
const result = (value, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff' } });
const error = (code, message) => Object.assign(new Error(message), { code });
const jsonOutput = { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] };
const requiredText = description => ({ type: 'string', required: true, description });
const objectOrEncodedJson = { oneOf: [{ type: 'object', additionalProperties: true }, { type: 'string' }] };
const draftParameter = { ...objectOrEncodedJson, required: true, description: 'DraftResult object matching memory_schema. One JSON-encoded object is also accepted; do not double-encode it.' };
export function createMemoryTools(controller, fixedWorkspace) {
  const bind = exec => fixedWorkspace || controller.bind(exec.agent.session);
  return [
    defineTool({ name: 'memory_read', description: 'Read project memory Markdown by exact ID. This does not access another project. Noncurrent records are explicitly labelled.', parallelSafe: true,
      parameters: { ids: { type: 'array', required: true, items: { type: 'string' } }, include_noncurrent: { type: 'boolean' } },
      output: { schema: { type: 'json' }, render: (_args, values) => [{ type: 'text', text: values.map(v => v.markdown || JSON.stringify(v)).join('\n\n') }] },
      execute: (args, exec) => controller.readForAgent(args, exec, fixedWorkspace) }),
    defineTool({ name: 'memory_browse', description: 'List project memories by exact category/status/group, with a revision-bound cursor. No semantic search.', parallelSafe: true,
      parameters: { category: { type: 'string' }, statuses: { type: 'array', items: { type: 'string' } }, group: { type: 'string' }, cursor: { type: 'string' }, page_size: { type: 'integer' } }, output: jsonOutput,
      execute: (args, exec) => controller.store.browse({ workspaceId: bind(exec).id, category: args.category, statuses: args.statuses, group: args.group, cursor: args.cursor, pageSize: args.page_size }) }),
  ];
}
function mainTools(controller) {
  return [
    ...createMemoryTools(controller),
    defineTool({ name: 'memory_schema', description: 'Get the exact DraftResult write contract and trusted current-user source location before composing a memory change. This does not read evidence files.', parallelSafe: true, parameters: {}, output: jsonOutput,
      execute: (_args, exec) => { const w = controller.bind(exec.agent.session); return { schema: contractSchema('DraftResult'), context: { session_id: exec.agent.id, workspace_id: w.id, latest_user_source: w.lastUser ? { source_kind: 'session_event', locator: `${exec.agent.id}#event:${w.lastUser.seq}` } : null } }; } }),
    defineTool({ name: 'memory_submit', description: 'Submit an explicit DraftResult: {audit_completion,explanation,operations,issues}. CREATE/UPDATE/ARCHIVE/RETRACT/RESTORE use the documented memory contract. DELETE requires a real current user clearing request and native approval. Identity, project and channel are host-bound. Only a committed receipt means saved.', parameters: { draft: draftParameter }, output: jsonOutput, execute: (args, exec) => controller.submitForAgent(toolJsonObject(args.draft, 'draft'), exec) }),
    defineTool({ name: 'memory_audit', description: 'Asynchronously audit the completed stage using the exact current conversation context. Call only at a meaningful stage boundary or at user request. accepted means durably queued; continue without polling. No timers or turn-count triggering.', parameters: { reason: requiredText('Why this stage deserves an audit'), focus: { type: 'string' } }, output: jsonOutput, execute: (args, exec) => controller.scheduleG2(args, exec) }),
    defineTool({ name: 'memory_issues', description: 'List unresolved project memory questions and their versions. Resolve only with current evidence or actual user input.', parameters: {}, output: jsonOutput, execute: (_args, exec) => controller.store.listIssues({ workspaceId: controller.bind(exec.agent.session).id }) }),
    defineTool({ name: 'memory_resolve', description: 'Atomically apply a resolution and close an issue using fresh expected versions. No closure on failed commit.', parameters: { issue_id: requiredText('Issue ID'), expected_version: requiredText('Exact issue version returned by memory_issues, for example v1.'), draft: draftParameter }, output: jsonOutput,
      execute: (args, exec) => { const w = controller.bind(exec.agent.session), draft = toolJsonObject(args.draft, 'draft'); if (draft.operations?.some(x => x.op === 'DELETE')) throw error('DELETE_NOT_AUTHORIZED', 'Use memory_submit for authorized clearing before resolving the issue.'); return controller.store.resolveIssue({ workspaceId: w.id, issueId: args.issue_id, expectedVersion: args.expected_version, requestId: controller.requestIdentity(exec), context: { workspaceId: w.id, channel: 'MEMORY_UI', sessionId: exec.agent.id, actor: 'main-agent' }, draft: normalizeSources(draft) }); } }),
    defineTool({ name: 'user_profile_read', description: 'Read the shared USER.md and its exact version hash. This stores cross-project personal preferences, not project facts.', parallelSafe: true, parameters: {}, output: jsonOutput, execute: () => controller.profile.read() }),
    defineTool({ name: 'user_profile_update', description: 'Update shared USER.md from a freshly read hash. Only store genuinely project-independent user facts and preferences. Project constraints stay in project memory. The host records a receipt, diff and sources; never edit USER.md by filesystem tools.', parameters: { text: requiredText('Complete updated USER.md content'), expected_hash: requiredText('Hash returned by user_profile_read'), reason: requiredText('Evidence and why the change is globally applicable'), source_refs: { type: 'array', items: objectOrEncodedJson, required: true, description: 'SourceRef objects; a single JSON-encoded object per item is accepted.' } }, output: jsonOutput,
      execute: (args, exec) => { const user = controller.bind(exec.agent.session).lastUser; const explicit = user && /(USER\.md|全局.*(档案|偏好|记忆)|global.*profile)/i.test(user.text) && /(管理|修改|更新|记住|更正|update|change|remember|correct)/i.test(user.text); return controller.profile.update({ text: args.text, expectedHash: args.expected_hash, reason: args.reason, sources: toolSourceRefs(args.source_refs), requestId: controller.requestIdentity(exec), origin: explicit ? 'user' : 'automatic' }); } }),
    defineTool({ name: 'user_profile_clear', description: 'Clear USER.md, retained profile diffs and plugin-generated audit copies, including background role sessions, only after an explicit real user clearing request and native approval. Original user DSH history, provider records and external backups remain outside this scope.', parameters: { expected_hash: requiredText('Current USER.md hash') }, output: jsonOutput,
      execute: async (args, exec) => {
        const w = controller.bind(exec.agent.session), user = w.lastUser;
        if (!user || !/(删除|清除|忘记|delete|forget|erase|remove)/i.test(user.text) || /(不要|别|禁止|do not|don't|never).{0,8}(删除|清除|忘记|delete|forget|erase|remove)/i.test(user.text)) throw error('DELETE_NOT_AUTHORIZED', 'Current user request does not authorize clearing.');
        const approval = controller.ctx.get('approval');
        const decision = await approval?.request({ agent: exec.agent, toolName: exec.name, callId: exec.callId, reason: `Clear global USER.md, retained profile diffs and plugin-generated audit copies, including background role sessions. Original user DSH sessions and external backups remain. Actual user request: ${user.text.slice(0, 1000)}`, signal: exec.signal });
        if (decision !== 'allowed-once') throw error('DELETE_NOT_AUTHORIZED', 'Native approval did not authorize global clearing.');
        const requestId = controller.requestIdentity(exec);
        const receipt = controller.profile.clear({ expectedHash: args.expected_hash, requestId, authorized: true, externalCleanupRequired: true });
        if (receipt.status !== 'committed') return receipt;
        try { return await controller.cleanupGlobal(requestId); } catch (e) { controller.report(e); return { ...receipt, cleanup_status: 'incomplete' }; }
      } }),
  ];
}
export function apply(ctx, config = {}) {
  const dshHome = path.resolve(config.dshHome || process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
  const dataDir = path.resolve(config.dataDir || path.join(dshHome, 'automemory'));
  let controller;
  controller = new MemoryController(ctx, { dshHome, dataDir, maxIndexBytes: config.maxIndexBytes, maxUserProfileBytes: config.maxUserProfileBytes, toolFactory: workspace => createMemoryTools(controller, workspace) });
  controller.management = new MemoryManagementService(controller, { getOverview: id => getOverview(controller.store, id), updateOverview: (id, input) => updateOverview(controller.store, { ...input, workspaceId: id }) });
  ctx.effect(() => () => controller.close());
  for (const tool of mainTools(controller)) ctx.tools.register(tool);
  ctx.systemPrompt.section({ name: 'automemory:main', order: 18000, interpolate: false, text: MAIN_PROMPT });
  const stop = installTurnMemory(ctx, { prepareTurn: info => controller.prepareTurn(info), onProvided: info => controller.onProvided(info), onSessionEvent: info => controller.onSessionEvent(info), onError: e => controller.report(e) });
  ctx.effect(() => stop);
  // The same native disposal signal that retires turn-memory bookkeeping also
  // releases this controller's per-session maps; both share the ctx event bus.
  ctx.effect(() => ctx.on('session/disposed', session => controller.onSessionDisposed(session)));
  if (ctx.inject) ctx.inject(['connection'], c => mountApi(c, controller));
  return controller;
}

function profileState(controller) {
  const profile = controller.profile.read();
  return { ...profile, content: profile.text, version: profile.hash, changes: controller.profile.activity().map(x => ({ ...x, id: x.request_id, time: x.at })) };
}
const MODEL_ROUTES_TTL_MS = 30000;
const MODEL_ROUTES_FETCH_TIMEOUT_MS = 5000;
/** The legacy `models` field stays in /global and /state responses for API
 * compatibility, but it no longer drives the settings selector (the native
 * catalog does). Enumerating every provider catalog is potentially network
 * I/O, and the memory page polls these endpoints every 15 seconds plus focus
 * wakeups, so serve the field from a short per-controller cache and fetch
 * provider catalogs in parallel instead of sequentially. Unavailable catalogs
 * never fabricated routes; they are cached as empty for the same window so a
 * degraded provider cannot stretch every state read. A changed provider list
 * invalidates immediately. Each catalog listing is bounded by the same timeout
 * contract as host capability checks, so one hung provider cannot hang state
 * reads forever; the losing underlying call is simply not awaited further. An
 * in-flight enumeration is shared by concurrent readers, and a stale
 * completion never overwrites a newer provider list's cache entry. */
async function modelRoutes(controller) {
  const providers = controller.ctx.llm.listProviders();
  const key = providers.map(provider => provider.id).join('\n');
  const cached = controller._modelRoutesCache;
  if (cached?.key === key) {
    if (Date.now() - cached.at < MODEL_ROUTES_TTL_MS) return cached.models;
    if (cached.pending) return cached.pending;
  }
  const timeoutMs = controller._modelRoutesFetchTimeoutMs ?? MODEL_ROUTES_FETCH_TIMEOUT_MS;
  const pending = Promise.all(providers.map(async provider => {
    let timer;
    const bounded = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('Model catalog listing timed out.')), timeoutMs); });
    try {
      const listing = await Promise.race([controller.ctx.llm.listModels(provider.id), bounded]);
      return listing.map(m => ({ provider: provider.id, model: m.id, label: m.name }));
    } catch { return []; /* Unavailable catalogs do not fabricate routes. */ }
    finally { clearTimeout(timer); }
  })).then(models => {
    const value = models.flat();
    // The provider list can change while this enumeration is in flight. A
    // newer enumeration owns the cache slot now; this completion must not
    // clobber it with an older key's result.
    if (controller._modelRoutesCache?.pending === pending) controller._modelRoutesCache = { key, at: Date.now(), models: value, pending: null };
    return value;
  });
  controller._modelRoutesCache = { key, at: cached?.key === key ? cached.at : 0, models: cached?.key === key ? cached.models : [], pending };
  return pending;
}
export async function globalStateFor(controller) {
  return { version, build: buildId, sessionId: null, userProfile: profileState(controller), settings: controller.settings.get(), models: await modelRoutes(controller), usage: controller.settings.usage(), capabilities: { settings: true, userProfileToggle: true, manage: true, managementRequiresSession: false } };
}
export async function catalogFor(controller) {
  const native = nativeWorkspacesFor(controller);
  const projects = new Map(controller.store.listWorkspaces().map(w => [w.id, { id: w.id, name: path.basename(w.root), root: w.root, enabled: w.enabled, registered: true, canBrowse: true, sessions: [] }]));
  const nativeManagement = !!controller.ctx.get('sessionController');
  for (const item of await controller.host.listSessions({})) {
    const sessionId = item.id || item.sessionId, cwd = item.cwd || item.header?.cwd;
    if (typeof sessionId !== 'string' || !cwd || isMemoryAgent({ id: sessionId })) continue;
    let identity; try { identity = workspaceIdentity(cwd); } catch { continue; }
    let project = projects.get(identity.id);
    if (!project) {
      project = { id: identity.id, name: identity.name, root: identity.root, enabled: true, registered: false, canBrowse: true, sessions: [] };
      projects.set(identity.id, project);
    }
    if (project.sessions.some(session => session.id === sessionId)) continue;
    const live = !!controller.ctx.agents.get(sessionId);
    project.sessions.push({ id: sessionId, title: item.title || item.header?.title || sessionId, updatedAt: item.updatedAt || item.createdAt || item.header?.createdAt, live, canManage: nativeManagement || live });
  }
  for (const project of projects.values()) project.sessions.sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0) || a.id.localeCompare(b.id));
  if (native) {
    const activeIds = new Set(native.map(w => w.id));
    const current = native.map(w => {
      const stored = projects.get(w.id);
      return { ...w, enabled: stored?.enabled ?? true, registered: stored?.registered ?? false,
        sessions: (stored?.sessions || []).filter(s => w.sessionIds.includes(s.id)) };
    });
    const links = controller.store.nativeWorkspaceLinks();
    const retainedProjects = [...projects.values()].filter(w => w.registered && !activeIds.has(w.id)).map(w => ({
      ...w, key: 'retained:' + w.id, detached: true, name: links.find(x => x.memory_id === w.id)?.title || w.name,
      automaticConsolidationPaused: true,
    }));
    return { version, build: buildId, projects: current, retainedProjects, nativeWorkspaces: true, selectedSessionId: null };
  }
  return { version, build: buildId, projects: [...projects.values()].sort((a, b) => a.root.localeCompare(b.root)).map(p => ({ ...p, key: p.id })), retainedProjects: [], nativeWorkspaces: false, selectedSessionId: null };
}
function identifier(value, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > 512) throw error('INVALID_ACTION', `Valid ${field} required.`);
  return value;
}
async function projectFor(controller, { sessionId, workspaceId } = {}) {
  if (sessionId != null) {
    identifier(sessionId, 'sessionId');
    if (isMemoryAgent({ id: sessionId })) throw error('SOURCE_SCOPE_MISMATCH', 'Background role sessions cannot be selected for project management.');
    const workspace = await controller.binding(sessionId);
    if (workspaceId != null && identifier(workspaceId, 'workspaceId') !== workspace.id) throw error('SOURCE_SCOPE_MISMATCH', 'Selected session does not belong to the requested project.');
    return workspace;
  }
  identifier(workspaceId, 'workspaceId');
  const stored = controller.store.listWorkspaces().find(w => w.id === workspaceId);
  if (stored) return { ...stored, name: path.basename(stored.root) };
  const known = (await catalogFor(controller)).projects.find(w => w.id === workspaceId);
  if (!known) throw error('PROJECT_NOT_FOUND', 'This project is not in the host memory or session catalog.');
  const registered = controller.store.registerWorkspace({ id: known.id, root: known.root });
  return { ...registered, name: known.name };
}
const historyMetadataCaches = new WeakMap();
const HISTORY_METADATA_MAX_BYTES = 64 * 1024;
/** Recover small cold-session presentation facts without starting an Agent.
 * Native list blank:false without a metadata projection is an unknown fallback.
 * Keep unknown/large logs visible rather than inferring emptiness from a title. */
export async function historyMetadataFor(controller, item, summary, budget = { reads: 0, checks: 0, bytes: 0, signal: AbortSignal.timeout(2000) }) {
  const id = item.id || item.sessionId, projected = summary?.projections?.values;
  const known = (blank, title, source) => ({ blankKnown: true, blank, title, blankSource: source });
  if (projected?.sessionListMetadata?.blank === false) return known(false, projected.title, 'native-projection');
  if (summary?.projections?.kind === 'sequenced' && typeof projected?.sessionListMetadata?.blank === 'boolean') return known(projected.sessionListMetadata.blank, projected.title, 'native-projection');
  const live = controller.ctx.sessions.get(id);
  if (live?.seq === 0) return known(true, projected?.title, 'live-empty');
  const persistence = controller.ctx.get('sessionPersistence');
  const query = controller.ctx.get('sessionQuery');
  if (!persistence || !query?.observeSession) return { blankKnown: false };
  try {
    const signal = budget.signal;
    let snapshot = item;
    if (item.revision == null || !Number.isFinite(item.sizeBytes)) {
      if (signal.aborted || budget.checks >= 16) return { blankKnown: false };
      budget.checks++; snapshot = await persistence.stat(id, { signal });
    }
    if (!snapshot || !Number.isFinite(snapshot.sizeBytes) || snapshot.sizeBytes > HISTORY_METADATA_MAX_BYTES || snapshot.sizeBytes < 0 || snapshot.revision == null) return { blankKnown: false };
    let cache = historyMetadataCaches.get(controller);
    if (!cache) { cache = new Map(); historyMetadataCaches.set(controller, cache); }
    const previous = cache.get(id);
    if (previous?.revision === snapshot.revision && previous.persistence === persistence) return previous.value;
    if (signal.aborted || budget.reads >= 8 || budget.bytes + snapshot.sizeBytes > 256 * 1024) return { blankKnown: false };
    budget.reads++; budget.bytes += snapshot.sizeBytes;
    // The host query validates the persistence revision and caches its own
    // parsed log; this extra cache retains only tiny presentation facts.
    const observation = await query.observeSession(id, { projectionMode: 'all', signal });
    try {
      const values = observation.projections?.values;
      const metadata = values?.sessionListMetadata;
      const blank = typeof metadata?.blank === 'boolean' ? metadata.blank : !observation.events.some(e => ['turn/start', 'user/message', 'assistant/message'].includes(e.type));
      const title = values?.title ?? observation.events.findLast(e => e.type === 'session/title')?.data?.title;
      const value = known(blank, title, 'bounded-log');
      if (observation.revision != null) {
        cache.delete(id); cache.set(id, { revision: observation.revision, persistence, value });
        if (cache.size > 256) cache.delete(cache.keys().next().value);
      }
      return value;
    } finally { observation[Symbol.dispose](); }
  } catch { return { blankKnown: false }; }
}
export async function stateFor(controller, target) {
  const input = typeof target === 'string' ? { sessionId: target } : target;
  if (!input || typeof input !== 'object') throw error('INVALID_ACTION', 'Select a known project or session.');
  const native = nativeWorkspacesFor(controller);
  const w = await projectFor(controller, input), ws = controller.store.getWorkspace(w.id), sessionId = input?.sessionId ?? null;
  const page = controller.store.browse({ workspaceId: w.id, statuses: ['current', 'archived', 'retracted'], pageSize: 1000, forManagement: true });
  const registered = controller.store.listSessions(w.id);
  const visible = [];
  // Reuse native list metadata; never infer a blank conversation from its UUID
  // or from the memory enrollment cursor. This does not resume an Agent.
  const nativeSessionController = controller.ctx.get('sessionController');
  let summaries = new Map();
  if (typeof nativeSessionController?.list === 'function') {
    try { const value = await nativeSessionController.list({}, AbortSignal.timeout(5000)); summaries = new Map((value.items || []).map(item => [item.sessionId, item])); }
    catch { /* Optional presentation hints may be unavailable; the client also has native list metadata. */ }
  }
  const historyBudget = { reads: 0, checks: 0, bytes: 0, signal: AbortSignal.timeout(2000) };
  for (const item of await controller.host.listSessions({})) {
    const id = item.id || item.sessionId, cwd = item.cwd || item.header?.cwd;
    if (!cwd || isMemoryAgent({ id })) continue;
    try { if (workspaceIdentity(cwd).id !== w.id) continue; } catch { continue; }
    const known = registered.find(s => s.id === id);
    const summary = summaries.get(id);
    const metadata = await historyMetadataFor(controller, item, summary, historyBudget);
    const identifierTitle = value => /^(?:session-)?[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
    const title = [metadata.title, summary?.projections?.values?.title, item.title, item.header?.title]
      .filter(value => typeof value === 'string').map(value => value.trim())
      .find(value => value && value !== id && !identifierTitle(value)) || null;
    visible.push({ id, title,
      blankKnown: metadata.blankKnown, ...(metadata.blankKnown ? { blank: metadata.blank, blankSource: metadata.blankSource } : {}),
      updatedAt: summary?.updatedAt || item.updatedAt || item.createdAt,
      included: known?.history_fully_included === true });
  }
  const models = await modelRoutes(controller);
  const activity = controller.store.listActivity({ workspaceId: w.id, channel: 'ALL', limit: 1000 }).filter(a => a.changed || a.event_type === 'issue.resolved').flatMap(a => {
    const changes = a.detail?.changes;
    const review = a.job_id ? controller.store.getJobArtifacts(a.job_id).review : undefined;
    if (!changes?.length) return [{ ...a, time: a.created_at, status: 'committed', changed: true, summary: a.event_type, unavailable: true }];
    return changes.map((change, index) => ({ id: `${a.id}:${index}`, channel: a.channel, time: a.created_at, status: 'committed', changed: true, summary: change.after?.content?.title || change.before?.content?.title || change.operation, reason: change.reason || change.after?.status_reason, before: change.before ? renderMemory(change.before) : '', after: change.after ? renderMemory(change.after) : '', source_refs: change.after?.source_refs || change.before?.source_refs || [], ...(review ? { review } : {}) }));
  });
  const issues = controller.store.listIssues({ workspaceId: w.id }).map(issue => ({ ...issue.proposal, ...issue }));
  const jobs = controller.store.listJobs({ workspaceId: w.id }).map(job => {
    const artifacts = controller.store.getJobArtifacts(job.id);
    const stages = Object.entries(artifacts).filter(([name]) => name.endsWith('-usage')).map(([, value]) => value);
    const entries = stages.flatMap(stage => stage.usage || []), calls = stages.reduce((n, stage) => n + (stage.requests?.length || 0), 0);
    const sum = key => entries.length === calls && calls > 0 && entries.every(x => Number.isFinite(x[key]) && x[key] >= 0) ? entries.reduce((n, x) => n + x[key], 0) : null;
    return { ...job, usage: { calls, totalTokens: sum('totalTokens'), cacheReadTokens: sum('cacheReadTokens'), cost: null } };
  });
  return { version, build: buildId, sessionId, workspace: { ...ws, automaticDream: !!ws.automatic_dream, name: w.name, detached: !!native && !native.some(n => n.id === w.id), automaticConsolidationPaused: !ws.enabled || !ws.automatic_dream || (!!native && !native.some(n => n.id === w.id)) }, overview: getOverview(controller.store, w.id), memories: page.entries, memoriesMore: !!page.next_cursor, issues, activity, jobs, sessions: visible,
    userProfile: profileState(controller), settings: controller.settings.get(), models, usage: controller.settings.usage(), capabilities: { manage: true, dream: ws.enabled, settings: true, includeSessions: ws.enabled, managementRequiresSession: false } };
}
export async function actionFor(controller, input) {
  if (!input || typeof input.action !== 'string') throw error('INVALID_ACTION', 'action required.');
  const requestId = `ui:${randomUUID()}`;
  // These are global non-semantic controls; opening a conversation is not a prerequisite.
  if (input.action === 'user-profile-toggle') return { request_id: requestId, status: 'committed', profile: controller.profile.configure({ enabled: input.enabled, autoWrite: input.autoWrite }) };
  if (input.action === 'settings-save') {
    const settings = controller.settings.set(input.settings || {}); controller.profile.retentionDays = settings.auditRetentionDays; controller.store.retentionDays = settings.auditRetentionDays; controller.store.setDreamIntervalMs(settings.dreamIntervalHours * 3600000);
    return { request_id: requestId, status: 'committed', settings };
  }
  if (input.action === 'manager-open') {
    const scope = input.scope === 'user' ? 'user' : 'project';
    let workspace = scope === 'project' ? await projectFor(controller, { workspaceId: input.workspaceId }) : undefined;
    if (scope === 'project' && input.nativeWorkspaceId != null) {
      const native = nativeWorkspacesFor(controller)?.find(w => w.nativeWorkspaceId === input.nativeWorkspaceId);
      if (!native || native.id !== workspace.id) throw error('SOURCE_SCOPE_MISMATCH', 'Selected workspace is no longer associated with this memory project.');
      workspace = { ...workspace, path: native.path, currentRoot: native.path, name: native.name };
    }
    return controller.management.open({ workspace, scope });
  }
  if (input.action === 'manager-state') return controller.management.get({ conversationId: input.conversationId });
  if (input.action === 'manager-send') return controller.management.send({ conversationId: input.conversationId, text: input.text, topicId: input.topicId, memoryId: input.memoryId, issueId: input.issueId, requestId: input.requestId });
  if (input.action === 'manager-retry') return controller.management.retry({ conversationId: input.conversationId, requestId: input.requestId });
  if (input.action === 'manager-confirm') return controller.management.confirm({ conversationId: input.conversationId, confirmationId: input.confirmationId, approved: input.approved });
  if (input.action === 'manager-close') return controller.management.leave({ conversationId: input.conversationId });
  if (input.action === 'manage') {
    identifier(input.sessionId, 'sessionId');
    if (input.workspaceId != null || input.expectedWorkspaceId != null || input.confirmedSessionId != null) {
      if (identifier(input.confirmedSessionId, 'confirmedSessionId') !== input.sessionId) throw error('TARGET_SESSION_UNCONFIRMED', 'Confirm the exact target conversation before sending a management request.');
      identifier(input.expectedWorkspaceId, 'expectedWorkspaceId');
    }
  }
  const w = await projectFor(controller, input);
  if (input.expectedWorkspaceId != null && input.expectedWorkspaceId !== w.id) throw error('SOURCE_SCOPE_MISMATCH', 'The selected conversation belongs to a different project.');
  switch (input.action) {
    case 'read': return { items: controller.store.read({ workspaceId: w.id, ids: input.ids, includeNoncurrent: input.include_noncurrent === true, forManagement: true }) };
    case 'project-toggle': { const workspace = controller.store.setWorkspaceEnabled(w.id, input.enabled); if (!input.enabled && controller.activeJob?.workspace_id === w.id) controller.jobAbort?.abort(error('WORKSPACE_DISABLED', 'User disabled project memory.')); return { request_id: requestId, status: 'committed', workspace }; }
    case 'project-dream-toggle': {
      const workspace = controller.store.setAutomaticDream(w.id, input.enabled);
      if (!input.enabled && controller.activeJob?.workspace_id === w.id && controller.activeJob.kind === 'DREAMING' && !controller.activeJob.manual) controller.jobAbort?.abort(error('AUTOMATIC_DREAM_DISABLED', 'Automatic consolidation was disabled.'));
      return { request_id: requestId, status: 'committed', workspace };
    }
    case 'dream': return controller.requestDream(w, true);
    case 'include-sessions': {
      if (!Array.isArray(input.sessionIds) || input.sessionIds.length > 100) throw error('INVALID_ACTION', 'Select up to 100 sessions at a time.');
      const selected = [];
      for (const id of input.sessionIds) {
        const s = await controller.host.readSession(id);
        if (isMemoryAgent({ id }) || workspaceIdentity(s.header.cwd).id !== w.id) throw error('SOURCE_SCOPE_MISMATCH', 'Selected session is outside this project.');
        selected.push(s);
      }
      for (const s of selected) { controller.store.registerSession({ workspaceId: w.id, sessionId: s.sessionId, headSeq: s.cursor, newSession: false }); controller.store.includeHistory({ workspaceId: w.id, sessionId: s.sessionId, startExclusive: -1 }); }
      return { request_id: requestId, status: 'committed', message: 'Selected history is now managed and will be processed by the next eligible Dreaming run.', sessionIds: input.sessionIds };
    }
    case 'manage': {
      if (typeof input.text !== 'string' || !input.text.trim() || input.text.length > 16000) throw error('INVALID_ACTION', 'Enter a memory management request of at most 16000 characters.');
      const agent = controller.ctx.agents.get(input.sessionId);
      const native = controller.ctx.get('sessionController');
      if (!agent && !native) throw error('SESSION_NOT_LIVE', 'The native session controller is unavailable; open this session before sending a management request.');
      const scope = input.scope === 'user' ? '全局 USER.md' : '当前项目记忆';
      const references = [input.memoryId ? `记忆 ID: ${input.memoryId}` : '', input.issueId ? `待裁决问题 ID: ${input.issueId}` : ''].filter(Boolean).join('\n');
      const message = { id: randomUUID(), role: 'user', source: { kind: 'user', rpcId: requestId }, content: [{ type: 'text', text: `请管理${scope}。\n${references}\n${input.text}\n请先读取当前版本，通过记忆工具处理，并根据真实回执报告结果。` }] };
      if (native) await native.prompt({ sessionId: input.sessionId, requestId, content: message.content, mode: 'queue' }, AbortSignal.timeout(30000));
      else { agent.followup(message); await controller.ctx.sessions.flush(agent.session); }
      return { request_id: requestId, status: 'accepted', sessionId: input.sessionId, workspaceId: w.id, scope: input.scope === 'user' ? 'user' : 'project', message: 'Request sent to the explicitly selected native conversation; the eventual tool receipt will state whether it committed.' };
    }
    default: throw error('INVALID_ACTION', 'Unsupported action.');
  }
}
export function trustedOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    // DSH's Node bridge normalizes Request.url to dsh.internal; Host retains the actual browser authority.
    const authority = request.headers.get('host') || new URL(request.url).host;
    return new URL(origin).host === authority;
  } catch { return false; }
}
export { normalizeSources };
function mountApi(ctx, controller) {
  ctx.effect(() => ctx.connection.fetch.register({ path: '/api/dsh-automemory/status', methods: ['GET'], requestBody: 'buffered', fetch: async request => {
    if (!trustedOrigin(request)) return result({ ok: false, error: { code: 'ORIGIN_MISMATCH', message: 'Cross-origin memory access refused.' } }, 403);
    return result({ ok: true, data: { enabled: true } });
  } }), 'automemory:status');
  for (const operation of ['state', 'global', 'catalog', 'action']) ctx.effect(() => ctx.connection.fetch.register({ path: `/api/dsh-automemory/${operation}`, methods: [operation === 'action' ? 'POST' : 'GET'], requestBody: 'buffered', fetch: async request => {
    try {
      if (!trustedOrigin(request)) return result({ ok: false, error: { code: 'ORIGIN_MISMATCH', message: 'Cross-origin memory access refused.' } }, 403);
      if (operation === 'global') return result({ ok: true, data: await globalStateFor(controller) });
      if (operation === 'catalog') return result({ ok: true, data: await catalogFor(controller) });
      if (operation === 'state') {
        const params = new URL(request.url).searchParams;
        return result({ ok: true, data: await stateFor(controller, { sessionId: params.get('sessionId'), workspaceId: params.get('workspaceId') }) });
      }
      const body = await request.text(); if (Buffer.byteLength(body) > 128 * 1024) throw error('INVALID_ACTION', 'Request exceeds size limit.');
      return result({ ok: true, data: await actionFor(controller, JSON.parse(body)) });
    } catch (e) { controller.report(e); return result({ ok: false, error: { code: e.code || 'REQUEST_FAILED', message: e.message || 'Memory operation failed.' } }, /AUTH|DENIED|ORIGIN/.test(e.code) ? 403 : /CONFLICT|BUSY|PROGRESS/.test(e.code) ? 409 : 400); }
  } }), `automemory:${operation}`);
}
