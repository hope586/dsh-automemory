import { randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, rmSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { MemoryStore } from './core/index.js';
import { UserProfileStore } from './user-profile.js';
import { SettingsStore, requestInputBudget } from './settings.js';
import { workspaceIdentity } from './identity.js';
import { nativeWorkspacesFor } from './workspaces.js';
import { rolePrompt } from './prompts.js';
import { validateOutput, contractSchema, normalizeSources } from './validation.js';
import { createHostAdapter, isMemoryAgent } from './host/index.js';
import { digest } from './core/validate.js';
import { projectEvidence } from './core/evidence-projection.js';

const failure = (code, message) => Object.assign(new Error(message), { code });
const textOf = message => message?.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
const sha = digest;
export class MemoryController {
  constructor(ctx, { dshHome, dataDir, toolFactory, maxIndexBytes = 65536, maxUserProfileBytes = 32768 }) {
    this.ctx = ctx; this.dshHome = dshHome; this.dataDir = dataDir; this.toolFactory = toolFactory;
    this.owner = `host-${process.pid}-${randomUUID()}`; this.startedAt = Date.now();
    this.store = new MemoryStore({ dataDir, maxIndexBytes }); this.profile = new UserProfileStore({ dshHome, dataDir, maxBytes: maxUserProfileBytes }); this.settings = new SettingsStore(dataDir);
    this.host = createHostAdapter(ctx); this.sessions = new Map(); this.callSeqs = new Map(); this.pendingReads = new Map(); this.turnProfiles = new Map(); this.errors = []; this.active = null; this.closed = false; this.activeJob = null; this.jobAbort = null; this.tickPromise = null; this.closePromise = null;
    this.timer = setInterval(() => { void this.tick().catch(e => this.report(e)); }, 5000); this.timer.unref?.();
  }
  report(error, scope = {}) {
    const entry = { at: Date.now(), code: error?.code || 'AUTOMEMORY_ERROR', message: String(error?.message || error), ...scope };
    const prior = this.errors.find(e => e.code === entry.code && e.message === entry.message && e.workspaceId === entry.workspaceId && e.sessionId === entry.sessionId && e.jobId === entry.jobId);
    if (prior) { prior.at = entry.at; return; }
    this.errors.push(entry); if (this.errors.length > 50) this.errors.shift();
  }
  bind(session) {
    if (this.closed) throw failure('CONTROLLER_CLOSED', 'AutoMemory is shutting down.');
    if (isMemoryAgent({ id: session.id })) throw failure('BACKGROUND_SCOPE', 'Background agents cannot acquire a new project scope.');
    const cached = this.sessions.get(session.id);
    if (cached?.cwd === session.header.cwd) return cached;
    const workspace = workspaceIdentity(session.header.cwd);
    const stored = this.store.registerWorkspace({ id: workspace.id, root: workspace.root });
    this.store.registerSession({ workspaceId: workspace.id, sessionId: session.id, headSeq: session.seq - 1, newSession: session.header.createdAt >= this.startedAt });
    const binding = { ...workspace, enabled: stored.enabled, cwd: session.header.cwd, sessionId: session.id, busy: this.ctx.agents.get(session.id)?.status === 'running' };
    this.sessions.set(session.id, binding); return binding;
  }
  async binding(sessionId) {
    const live = this.ctx.agents.get(sessionId)?.session || this.ctx.sessions.get(sessionId);
    if (live) return this.bind(live);
    const read = await this.host.readSession(sessionId);
    return this.bind({ id: sessionId, header: read.header, seq: read.cursor + 1 });
  }
  async prepareTurn({ agent, sessionId, turnId }) {
    const workspace = this.bind(agent.session);
    const enabled = this.store.getWorkspace(workspace.id).enabled;
    const bundle = enabled ? this.store.prepareTurn({ workspaceId: workspace.id, sessionId, turnId }) : null;
    this.syncProfileEpoch();
    let user = this.turnProfiles.get(turnId);
    if (!user) { user = this.profile.read(); this.turnProfiles.set(turnId, user); if (this.turnProfiles.size > 128) this.turnProfiles.delete(this.turnProfiles.keys().next().value); }
    const parts = [], revisions = [];
    if (user.enabled) parts.push(`<global-user-profile version="${user.hash}">\n${user.text || '(No global user profile saved.)'}\n</global-user-profile>\nThis is the current USER.md; it supersedes older USER.md snapshots. Project facts remain project-scoped.`);
    if (!enabled) parts.push('Project AutoMemory is disabled. Do not read or automatically write project memory.');
    else if (bundle.state !== 'ready') parts.push(`Project memory is unavailable: ${JSON.stringify(bundle.error)}. This does not mean the library is empty.`);
    else {
      parts.push(`<project-memory-index workspace="${workspace.id}" turn="${turnId}" revision="${bundle.workspace_revision}">\n${bundle.index_markdown}\n</project-memory-index>`);
      if (bundle.index_changed) parts.push('The project memory index has changed since the last supplied index.');
      for (const notice of bundle.notifications) revisions.push(JSON.stringify(notice));
      parts.push('Read relevant IDs with memory_read; do not infer the full content from an index title.');
    }
    return { bundle_id: bundle?.bundle_id || `user:${turnId}:${user.hash}`, indexText: parts.join('\n\n'), revisionsText: revisions.join('\n\n'), provided: [{ workspaceId: workspace.id, sessionId, turnId, projectBundle: !!bundle }] };
  }
  onProvided(info) {
    if (this.closed) return;
    for (const p of info.provided || []) if (p.projectBundle) this.store.markBundleProvided({ workspaceId: p.workspaceId, sessionId: p.sessionId, turnId: p.turnId });
  }
  onSessionEvent({ session, event }) {
    if (this.closed) return;
    if (event.type === 'tool/call') this.callSeqs.set(`${session.id}:${event.data.callId}`, event.seq);
    let ownTool = false;
    if (event.type === 'tool/result' && event.surfaceOp) {
      const linked = (event.sourceEventSeqs || []).find(seq => this.pendingReads.has(`${session.id}:event:${seq}`));
      const seq = linked ?? this.callSeqs.get(`${session.id}:${event.data?.message?.source?.callId}`);
      const key = `${session.id}:event:${seq}`, pending = this.pendingReads.get(key);
      if (pending) {
        ownTool = true; this.pendingReads.delete(key);
        if (!event.data.message.isError && pending.results?.every(r => r.outcome !== 'found' || textOf(event.data.message).includes(r.markdown))) {
          const args = { workspaceId: pending.workspaceId, sessionId: session.id, results: pending.results };
          if (isMemoryAgent({ id: session.id })) this.store.recordReadProvided({ ...args, role: session.id.split('-')[1] });
          else this.store.markProvided(args);
        }
      }
    }
    if (isMemoryAgent({ id: session.id })) return;
    let workspace;
    try { workspace = this.bind(session); }
    catch (error) {
      // A retained/blank native session may outlive its directory. Its routine
      // bookkeeping must not stop unrelated projects or poison global state.
      if (['ENOENT', 'ENOTDIR', 'WORKSPACE_UNAVAILABLE'].includes(error.code)) { this.sessions.delete(session.id); return; }
      throw error;
    }
    if (event.type === 'turn/start') workspace.busy = true;
    if (event.type === 'turn/end') workspace.busy = false;
    if (event.type === 'turn/start' || event.type === 'turn/end') this.refreshPresence();
    if (event.type === 'user/message' && event.data?.source?.kind === 'user') workspace.lastUser = { seq: event.seq, text: textOf(event.data), id: event.data.id };
    // Observe every event so an off/on gap never becomes an implicit suffix.
    // Only work events count as new evidence; admission checks current shared
    // enabled state inside the same SQLite transaction, not cached binding.
    const hasNewEvidence = event.type === 'user/message' && event.data?.source?.kind === 'user' || event.type === 'assistant/message' && !(event.data.message.content || []).every(b => b.type === 'tool-call' && /^(memory_|user_profile_)/.test(b.name)) || event.type === 'tool/result' && !ownTool;
    this.store.updateSessionHead({ workspaceId: workspace.id, sessionId: session.id, headSeq: event.seq, hasNewEvidence: !!hasNewEvidence, eventOnly: true });
  }
  /** Native sessions are disposed long before the host process ends. Without
   * this hook their bindings, tool-call sequences, undelivered read markers
   * (which retain memory bodies) and turn profile snapshots accumulate for the
   * whole host lifetime. Disposal is terminal for that session identity: no
   * tool of the same call can still be executing afterwards. */
  onSessionDisposed(session) {
    if (this.closed || typeof session?.id !== 'string') return;
    this.sessions.delete(session.id);
    const prefix = session.id + ':';
    for (const key of this.callSeqs.keys()) if (key.startsWith(prefix)) this.callSeqs.delete(key);
    for (const key of this.pendingReads.keys()) if (key.startsWith(prefix)) this.pendingReads.delete(key);
    for (const key of this.turnProfiles.keys()) if (key.startsWith(prefix)) this.turnProfiles.delete(key);
  }
  requestIdentity(exec) {
    const seq = this.callSeqs.get(`${exec.agent.id}:${exec.callId}`);
    if (!Number.isSafeInteger(seq)) throw failure('TOOL_CONTEXT_UNAVAILABLE', 'A durable tool-call event is required to bind a memory operation.');
    return `${exec.agent.id}:event:${seq}`;
  }
  refreshPresence() {
    // Reload may attach after turn/start. Recover current foreground liveness
    // through the public registry before claiming any project idle work.
    const archived = new Set(this.ctx.get('workspaceRegistry')?.archivedSessionIds || []);
    for (const id of archived) this.sessions.delete(id);
    for (const agent of this.ctx.agents.list()) if (!isMemoryAgent(agent) && !archived.has(agent.id)) {
      try { this.bind(agent.session); }
      catch (error) {
        this.sessions.delete(agent.id);
        if (!['ENOENT', 'ENOTDIR', 'WORKSPACE_UNAVAILABLE'].includes(error.code)) this.report(error, { sessionId: agent.id });
      }
    }
    const grouped = new Map();
    for (const s of this.sessions.values()) {
      s.busy = this.ctx.agents.get(s.sessionId)?.status === 'running';
      grouped.set(s.id, (grouped.get(s.id) || false) || s.busy);
    }
    for (const [workspaceId, busy] of grouped) this.store.setWorkspaceBusy({ workspaceId, owner: this.owner, busy, leaseMs: 30000 });
  }
  readForAgent(args, exec, fixedWorkspace) {
    const w = fixedWorkspace || this.bind(exec.agent.session);
    const results = this.store.read({ workspaceId: w.id, ids: args.ids, includeNoncurrent: args.include_noncurrent === true });
    this.pendingReads.set(this.requestIdentity(exec), { workspaceId: w.id, results });
    return results;
  }
  async submitForAgent(draft, exec) {
    validateOutput('DraftResult', draft);
    draft = normalizeSources(draft);
    const w = this.bind(exec.agent.session), deletions = draft.operations.filter(o => o.op === 'DELETE');
    let deleteAuthorization;
    if (deletions.length) {
      const user = w.lastUser;
      if (!user || !/(删除|清除|忘记|delete|forget|erase|remove)/i.test(user.text) || /(不要|别|禁止|do not|don't|never).{0,8}(删除|清除|忘记|delete|forget|erase|remove)/i.test(user.text)) throw failure('DELETE_NOT_AUTHORIZED', 'The current real user message does not request memory clearing.');
      const approval = this.ctx.get('approval');
      if (!approval) throw failure('DELETE_NOT_AUTHORIZED', 'Native deletion approval is unavailable.');
      const ids = deletions.map(o => o.target_id);
      const decision = await approval.request({ agent: exec.agent, toolName: exec.name, callId: exec.callId, reason: `Clear project memories ${ids.join(', ')}. User request: ${user.text.slice(0, 1000)}. This clears plugin-managed content and audit copies; original DSH logs and external exports remain.`, signal: exec.signal });
      if (decision !== 'allowed-once') throw failure('DELETE_NOT_AUTHORIZED', 'Native approval did not authorize clearing.');
      deleteAuthorization = { requestRef: `${exec.agent.id}#event:${user.seq}`, ids };
    }
    if (deletions.length && this.activeJob?.workspace_id === w.id) { this.jobAbort?.abort(failure('CLEANUP_CANCELLED', 'User clearing cancels old audit input.')); await this.active; }
    const requestId = this.requestIdentity(exec);
    const receipt = this.store.submit(draft, { workspaceId: w.id, sessionId: exec.agent.id, requestId, channel: 'G1', actor: 'main-agent', initiatedBy: 'agent', ...(deleteAuthorization ? { deleteAuthorization, externalCleanupRequired: true } : {}) });
    if (deletions.length && receipt.status === 'committed') {
      try {
        const cleanup = this.store.pendingCleanups().find(x => x.workspace_id === w.id && x.request_id === requestId);
        this.cleanupWorkspace(w.id, cleanup?.epoch); await this.cleanupRoleSessions(w.id);
        return this.store.completeExternalCleanup({ workspaceId: w.id, requestId });
      }
      catch (e) { this.report(e); return { ...receipt, cleanup_status: 'incomplete' }; }
    }
    return receipt;
  }
  async scheduleG2(args, exec) {
    const w = this.bind(exec.agent.session);
    const managed = this.store.listSessions(w.id).find(s => s.id === exec.agent.id);
    const snapshot = await this.host.captureG2(exec.agent, { startExclusive: managed.g2_cursor, signal: exec.signal });
    this.store.updateSessionHead({ workspaceId: w.id, sessionId: exec.agent.id, headSeq: snapshot.endInclusive, hasNewEvidence: false, observeOnly: true });
    const evidence = this.freezeEvidence(w.id, managed, managed.g2_cursor, snapshot.endInclusive);
    return this.store.enqueueJob({ workspaceId: w.id, kind: 'G2', requestId: this.requestIdentity(exec), sessionId: exec.agent.id, endSeq: snapshot.endInclusive, snapshot, payload: { reason: args.reason, ...(args.focus ? { focus: args.focus } : {}), currentRoot: w.currentRoot, models: this.settings.get().models, contractVersion: 'r2.1', evidencePolicy: 1, sourceBlockedRoots: [this.dshHome, this.dataDir], evidenceRanges: [evidence] } });
  }
  freezeEvidence(workspaceId, session, startExclusive, endInclusive) {
    const bounds = { workspaceId, sessionId: session.id, endInclusive };
    return { sessionId: session.id, startExclusive, endInclusive, managedStart: session.managed_start, allowedRanges: this.store.allowedEvidenceRanges({ ...bounds, startExclusive }), contextRanges: this.store.allowedEvidenceRanges({ ...bounds, startExclusive: session.managed_start }) };
  }
  automaticWorkspaceIds() {
    const native = nativeWorkspacesFor(this);
    return native ? new Set(native.filter(w => w.id).map(w => w.id)) : null;
  }
  assertAutomaticWorkspace(job) {
    if (job.kind !== 'DREAMING' || job.manual) return;
    const ids = this.automaticWorkspaceIds();
    if (this.store.getWorkspace(job.workspace_id).automatic_dream === false || ids && !ids.has(job.workspace_id)) {
      this.store.cancelJob({ workspaceId: job.workspace_id, jobId: job.id });
      throw failure('WORKSPACE_REMOVED', 'Workspace removed; automatic consolidation is paused. Existing memories are retained.');
    }
  }
  commitJob(job, draft) {
    this.assertAutomaticWorkspace(job);
    return this.store.completeJob({ lease: job.lease, draft });
  }
  async requestDream(workspace, manual = true) {
    const state = this.store.getWorkspace(workspace.id);
    if (!manual) {
      const ids = this.automaticWorkspaceIds();
      if (state.automatic_dream === false || ids && !ids.has(workspace.id)) return { status: 'deferred', reason: 'WORKSPACE_REMOVED' };
      const pending = this.store.listJobs({ workspaceId: workspace.id, limit: 1000 }).find(j => j.kind === 'DREAMING' && ['queued', 'running', 'paused'].includes(j.status));
      if (pending) return { status: 'accepted', job_id: pending.id };
    }
    const evidenceRanges = this.store.listSessions(workspace.id).map(s => this.freezeEvidence(workspace.id, s, s.dream_cursor ?? s.managed_start, s.head_seq)).filter(range => range.allowedRanges.length);
    if (!manual && !evidenceRanges.length) return { status: 'deferred', reason: 'NO_NEW_EVIDENCE' };
    return this.store.enqueueJob({ workspaceId: workspace.id, kind: 'DREAMING', requestId: manual ? `manual:${randomUUID()}` : `auto:${state.dirty_seq}:${state.last_dream_started ?? state.created_at}`, manual, payload: { currentRoot: workspace.currentRoot || workspace.root, evidencePolicy: 1, sourceBlockedRoots: [this.dshHome, this.dataDir], evidenceRanges, models: this.settings.get().models, contractVersion: 'r2.1' } });
  }
  jobModelRoutes(job) {
    const artifacts = this.store.getJobArtifacts(job.id), models = job.payload.models || this.settings.get().models;
    if (artifacts.final) return [];
    if (job.kind === 'G2') return [{ role: 'G2', route: models.g2 || job.snapshot?.route }];
    if (artifacts.candidate?.output?.operations?.length === 0) return [];
    return [{ role: 'DREAMER', route: models.dreamer }, ...(!artifacts.review ? [{ role: 'REVIEWER', route: models.reviewer }] : [])];
  }
  modelRouteKey(route) { return JSON.stringify([route?.provider ?? null, route?.model ?? null, route?.reasoningEffort ?? null]); }
  async modelCapabilityChecks() {
    const routes = new Map();
    for (const job of this.store.listClaimCandidates()) for (const item of this.jobModelRoutes(job)) routes.set(this.modelRouteKey(item.route), item.route);
    const checks = new Map();
    await Promise.all([...routes].map(async ([key, route]) => {
      try { checks.set(key, await this.host.checkModelRoute(route, { signal: AbortSignal.timeout(5000) })); }
      catch { checks.set(key, { available: false, code: 'HOST_MODEL_UNAVAILABLE', causeCode: 'CAPABILITY_CHECK_UNAVAILABLE', message: 'This host could not establish the configured model route.' }); }
    }));
    return checks;
  }
  jobEligibility(job, checks) {
    // Recheck provider registration synchronously under the claim transaction;
    // an asynchronous model metadata check does not grant a durable capability.
    let providers;
    try { providers = new Set(this.ctx.llm.listProviders().map(provider => provider.id)); }
    catch { providers = new Set(); }
    const missingRoutes = this.jobModelRoutes(job).flatMap(({ role, route }) => {
      const check = checks.get(this.modelRouteKey(route));
      if (check?.available && providers.has(route?.provider)) return [];
      return [{ role, provider: route?.provider || null, model: route?.model || null, causeCode: !providers.has(route?.provider) ? 'NO_ADAPTER' : check?.causeCode || 'CAPABILITY_CHECK_PENDING' }];
    });
    return missingRoutes.length ? { eligible: false, code: 'HOST_MODEL_UNAVAILABLE', message: `Waiting for a host with the configured model routes. This host cannot currently execute ${missingRoutes.map(item => `${item.role}: ${item.provider || '(unset)'}/${item.model || '(unset)'}`).join(', ')}. Open or configure a compatible host; no model call has been made by this host.`, missingRoutes } : { eligible: true };
  }
  tick() {
    if (this.closed) return Promise.resolve();
    if (this.tickPromise) return this.tickPromise;
    // A timer or manual wake can arrive while another tick awaits cleanup or
    // scheduling. Coalesce the entire tick, not only the running model phase.
    const pending = Promise.resolve().then(() => this.tickOnce());
    const tracked = pending.finally(() => { if (this.tickPromise === tracked) this.tickPromise = null; });
    this.tickPromise = tracked;
    return tracked;
  }
  async tickOnce() {
    if (this.closed) return;
    this.refreshPresence();
    this.syncProfileEpoch();
    const pendingGlobal = this.profile.settings().cleanupRequest;
    if (pendingGlobal) await this.cleanupGlobal(pendingGlobal);
    if (this.closed) return;
    for (const cleanup of this.store.pendingCleanups?.() || []) {
      try {
        this.cleanupWorkspace(cleanup.workspace_id, cleanup.epoch); await this.cleanupRoleSessions(cleanup.workspace_id);
        this.store.completeExternalCleanup({ workspaceId: cleanup.workspace_id, requestId: cleanup.request_id });
      } catch (e) { this.report(e); }
    }
    const config = this.settings.get(); this.store.setDreamIntervalMs(config.dreamIntervalHours * 3600000);
    this.store.retentionDays = config.auditRetentionDays; this.profile.retentionDays = config.auditRetentionDays;
    if (!this.lastPrune || Date.now() - this.lastPrune >= 3600000) { this.store.pruneAudit(); this.profile.activity({ limit: 1 }); try { this.sweepAllJobEvidence(); } catch (error) { this.report(error); } this.lastPrune = Date.now(); }
    try { await this.cleanupRoleSessions(); } catch (error) { this.report(error); }
    if (this.closed) return;
    if (this.activeJob) {
      try { this.assertAutomaticWorkspace(this.activeJob); } catch (e) { this.jobAbort?.abort(e); }
    }
    if (this.active) return;
    const automaticWorkspaceIds = this.automaticWorkspaceIds();
    for (const w of this.store.listWorkspaces()) if ((!automaticWorkspaceIds || automaticWorkspaceIds.has(w.id)) && w.enabled && w.automatic_dream !== false && w.dirty_seq > w.dream_processed_seq && Date.now() - (w.last_dream_started ?? w.created_at) >= config.dreamIntervalHours * 3600000) {
      if (this.closed) return;
      try { await this.requestDream(w, false); } catch (e) { if (e.code !== 'IDEMPOTENCY_CONFLICT') this.report(e); }
    }
    if (this.closed || this.active) return;
    const checks = await this.modelCapabilityChecks();
    if (this.closed || this.active) return;
    const job = this.store.claimJob({ owner: this.owner, leaseMs: 60000, automaticWorkspaceIds, eligibility: candidate => this.jobEligibility(candidate, checks) });
    if (!job) return;
    this.activeJob = job; this.jobAbort = new AbortController();
    this.active = this.executeJob(job).catch(error => {
      if (error.deferred === true) {
        try { this.store.deferUndispatchedJob({ lease: job.lease, stage: error.stage, code: error.code, message: error.message }); } catch (e) { this.report(e, { workspaceId: job.workspace_id, jobId: job.id }); }
        return;
      }
      this.report(error, { workspaceId: job.workspace_id, jobId: job.id }); try { this.store.failJob({ lease: job.lease, code: error.code || 'AUDIT_FAILED', message: error.message, retryable: false }); } catch (e) { this.report(e); }
    }).finally(() => {
      // The job has settled (completed, failed terminal, cancelled or returned
      // to the queue) before this finally runs, so the terminal check inside
      // decides correctly; a deferred or re-claimed job keeps its evidence.
      try { this.sweepJobEvidence(job.id); } catch (e) { this.report(e, { workspaceId: job.workspace_id, jobId: job.id }); }
      this.active = null; this.activeJob = null; this.jobAbort = null;
    });
  }
  async evidence(job, workspace) {
    const dir = this.evidenceDirectory(job);
    this.store.renewJob({ ...job.lease, leaseMs: 60000 });
    const paths = [];
    const observations = new Map();
    for (const fragment of this.evidenceFragments(job)) {
      let session = observations.get(fragment.sessionId);
      if (!session) { session = await this.host.readSession(fragment.sessionId); observations.set(fragment.sessionId, session); }
      // A clear/cancellation/lease replacement can finish while storage awaits.
      // Validate again before creating files, so an obsolete worker cannot
      // recreate cleared evidence or interfere with a replacement worker.
      if (this.closed || this.jobAbort?.signal.aborted) throw failure('AUDIT_CANCELLED', 'The audit is no longer active.');
      this.store.renewJob({ ...job.lease, leaseMs: 60000 });
      const identity = workspaceIdentity(session.header.cwd);
      if (identity.id !== workspace.id) throw failure('SOURCE_SCOPE_MISMATCH', 'Selected history belongs to another project.');
      if (session.cursor < fragment.endInclusive) throw failure('SOURCE_UNAVAILABLE', 'The frozen evidence range is no longer available.');
      const events = session.events.filter(e => e.seq > fragment.startExclusive && e.seq <= fragment.endInclusive);
      const file = path.join(dir, fragment.filename);
      const projection = projectEvidence({ sessionId: session.id || fragment.sessionId, events, fragment });
      if (!projection.header.projection.contentComplete) throw failure('EVIDENCE_CONTENT_INCOMPLETE', `Source conversation content could not be projected completely (${fragment.sessionId}; events ${[...new Set(projection.header.projection.contentGaps.map(gap => gap.seq))].join(',')}). No audit can commit or advance coverage from this incomplete evidence.`);
      mkdirSync(dir, { recursive: true, mode: 0o700 });
      writeFileSync(file, projection.jsonl, { mode: 0o600 }); paths.push(file);
    }
    return paths;
  }
  evidenceFragments(job) {
    const selected = job.payload.evidenceRanges || (job.kind === 'G2' ? [{ sessionId: job.session_id, startExclusive: job.window.start_exclusive, endInclusive: job.window.end_inclusive, managedStart: this.store.listSessions(job.workspace_id).find(s => s.id === job.session_id)?.managed_start ?? -1 }] : []);
    const fragments = [];
    for (const selection of selected) {
      const start = job.kind === 'G2' ? job.window.start_exclusive : selection.startExclusive;
      const end = selection.endInclusive;
      const bounds = { workspaceId: job.workspace_id, sessionId: selection.sessionId, endInclusive: end };
      const audit = selection.allowedRanges ?? this.store.allowedEvidenceRanges({ ...bounds, startExclusive: start });
      const context = selection.contextRanges ?? this.store.allowedEvidenceRanges({ ...bounds, startExclusive: selection.managedStart ?? start });
      for (const [purpose, ranges, lower, upper] of [['audit', audit, start, end], ['context', context, selection.managedStart ?? -1, start]]) {
        for (const range of ranges) {
          const from = Math.max(lower, range.startExclusive), through = Math.min(upper, range.endInclusive);
          if (through <= from) continue;
          fragments.push({ sessionId: selection.sessionId, startExclusive: from, endInclusive: through, purpose: purpose === 'context' ? 'Earlier authorized context only; do not independently extract facts outside the audit window.' : 'Authorized audit evidence', filename: `${sha(selection.sessionId).slice(0, 24)}-${purpose}-${from + 1}-${through}.jsonl` });
        }
      }
    }
    return fragments;
  }
  evidenceDirectory(job) {
    // The lease fencing token is part of the filesystem ownership boundary.
    // Old executeJob finally blocks can only remove their own attempt.
    return path.join(this.dataDir, 'job-evidence', job.id, `${sha(job.lease?.owner || this.owner).slice(0, 16)}-${job.lease?.token ?? 0}`);
  }
  cleanupEvidence(job) { rmSync(this.evidenceDirectory(job), { recursive: true, force: true }); }
  /** Evidence files are staged per lease attempt. A crashed worker or an
   * expired-lease replacement leaves its attempt directory behind with no
   * finally block to remove it, and full conversation projections can be
   * large, so finished jobs remove their whole root once no attempt can still
   * be writing. A terminal job can never be claimed again, so no live worker
   * owns that root; a still-running job keeps every attempt directory. */
  sweepJobEvidence(jobId) {
    const root = path.join(this.dataDir, 'job-evidence', jobId);
    if (!existsSync(root)) return;
    const job = this.store.getJob(jobId);
    if (job && !['completed', 'failed', 'cancelled'].includes(job.status)) return;
    rmSync(root, { recursive: true, force: true });
  }
  sweepAllJobEvidence() {
    const root = path.join(this.dataDir, 'job-evidence');
    if (!existsSync(root)) return;
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      this.sweepJobEvidence(entry.name);
    }
  }
  sourceAliases(job) {
    const root = path.join(this.dataDir, 'job-evidence', job.id);
    const directories = new Set([root, this.evidenceDirectory(job)]);
    for (const artifact of Object.values(this.store.getJobArtifacts(job.id))) for (const file of artifact?.evidencePaths || []) {
      if (typeof file === 'string' && file.startsWith(root + path.sep)) directories.add(path.dirname(file));
    }
    return [...directories].flatMap(dir => this.evidenceFragments(job).map(fragment => ({ path: path.join(dir, fragment.filename), locator: `${fragment.sessionId}#events:${fragment.startExclusive + 1}-${fragment.endInclusive}`, version: `frozen-through-event:${fragment.endInclusive}` })));
  }
  async run(job, stage, role, { snapshot, prompt, evidencePaths, model, workspace }) {
    const config = this.settings.get(), requestIds = new Map(); let plannedSessionId, plannedStorage;
    const savedArtifacts = this.store.getJobArtifacts(job.id), priorUsage = savedArtifacts[stage + '-usage'];
    // A crash can occur after the proven zero-call result was persisted but
    // before the queue transition. Preserve that evidence and finish deferral
    // instead of treating its intentionally incomplete role as an unknown call.
    if (priorUsage?.status === 'deferred' && Array.isArray(priorUsage.requests) && priorUsage.requests.length === 0 && Array.isArray(priorUsage.usage) && priorUsage.usage.length === 0 && !savedArtifacts[stage + '-result']) throw Object.assign(failure(priorUsage.error?.code || 'HOST_MODEL_UNAVAILABLE', priorUsage.error?.message || 'Waiting for a host with the configured model route.'), { deferred: true, stage });
    const recorded = savedArtifacts[stage + '-session'];
    if (recorded) {
      const persisted = await this.host.readSession(recorded.sessionId);
      const lastTurnEnd = [...persisted.events].reverse().find(e => e.type === 'turn/end');
      const lastAssistant = [...persisted.events].reverse().find(e => e.type === 'assistant/message');
      if (lastTurnEnd?.data.reason?.kind !== 'completed' || !lastAssistant || lastAssistant.seq > lastTurnEnd.seq) throw failure('MODEL_STAGE_INTERRUPTED', 'A previously dispatched model stage did not durably finish. Its outcome remains visible; it will not be silently re-run.');
      const output = JSON.parse(textOf(lastAssistant.data.message).trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1'));
      // Candidate continuation needs a valid frozen context; absent one is a visible failure.
      const saved = this.store.getJobArtifacts(job.id)[stage + '-result'];
      if (!saved?.snapshot && role !== 'REVIEWER' && stage !== 'audit' && stage !== 'final') throw failure('MODEL_STAGE_INTERRUPTED', 'The candidate snapshot was not durably saved; defer to a later consolidation.');
      return saved || { status: 'completed', output, sessionId: recorded.sessionId, usage: [], requests: [] };
    }
    if (this.store.getJobArtifacts(job.id)[stage + '-input-meta']) throw failure('MODEL_STAGE_INTERRUPTED', 'A previous model dispatch did not finish its durable session marker; it will not be silently retried.');
    prompt += `\nCurrent readable evidence files for this attempt: ${JSON.stringify(evidencePaths || [])}. Prefer these paths over any older temporary paths appearing in restored context. Each JSONL is a conversation-evidence-v1 projection with untruncated user/assistant/tool text and original event locators; check its contentComplete/contentGaps and incomplete-delivery labels. Repeated system/request/usage metadata and known automatic context injections are omitted with hashes; those omission records are not factual evidence. The original G2 inherited context is unchanged. If needed content is unavailable or a read page is truncated, continue reading or report partial; do not assume omission metadata proves a fact.`;
    if (job.payload.evidencePolicy === 1) prompt += `\nEvidence admission policy: ${JSON.stringify(job.payload.evidenceRanges)}. allowedRanges restrict eligibility within the current audit window ${JSON.stringify(job.window)}; they do not authorize re-auditing previously covered events. contextRanges may support checking existing facts. Disabled/unselected intervals are not eligible for automatic extraction, even if visible in the intact G2 inherited context. Cite session sources exactly as sessionId#event:N or sessionId#events:N-M; ranges may not cross an excluded gap. Existing memory may be cited by memory_record ID/version. Do not turn a visible but ineligible statement into a new memory by changing its source type. If required eligible evidence is unavailable, return partial; an honest unknown or selective no-change is valid.`;
    this.store.saveJobArtifact({ lease: job.lease, stage: stage + '-input-meta', value: { evidencePaths: evidencePaths || [], promptVersion: 'automemory/0.3.4-evidence-v1', promptHash: sha(prompt), schemaVersion: 'r2.1', schemaHash: sha(contractSchema(role === 'REVIEWER' ? 'ReviewAdvice' : 'DraftResult')), role, model, window: job.window } });
    const result = await this.host.runRole({ role, snapshot, prompt, evidencePaths, model, workspace, blockedRoots: [this.dshHome, this.dataDir], protectedDirectoryNames: [path.basename(this.dshHome)], tools: this.toolFactory(workspace), maxSteps: config.budget.maxSteps, maxTokens: config.budget.maxOutputTokens, timeoutMs: 240000, signal: this.jobAbort?.signal,
      onSessionPlanned: ({ sessionId, storage }) => {
        if (this.profile.settings().cleanupRequest) throw failure('CLEANUP_INCOMPLETE', 'Global profile cleanup is pending.');
        this.store.planRoleSession({ lease: job.lease, sessionId, role, storage });
        plannedSessionId = sessionId; plannedStorage = storage;
      },
      onSessionSettled: ({ sessionId }) => { if (sessionId === plannedSessionId) this.store.settleRoleSession({ sessionId, owner: job.lease.owner }); },
      onCreated: ({ sessionId }) => this.store.saveJobArtifact({ lease: job.lease, stage: stage + '-session', value: { sessionId, storage: plannedStorage } }),
      onRequest: request => {
        this.assertAutomaticWorkspace(job);
        if (this.profile.settings().cleanupRequest) throw failure('CLEANUP_INCOMPLETE', 'Global profile cleanup is pending.');
        this.store.renewJob({ ...job.lease, leaseMs: 60000 });
        const budget = requestInputBudget(request);
        const limitExceeded = budget.conservativeInputTokens > config.budget.maxInputTokens;
        this.store.saveJobArtifact({ lease: job.lease, stage: `${stage}-budget-${request.index}`, value: { ...budget, maxInputTokens: config.budget.maxInputTokens, maxOutputTokens: config.budget.maxOutputTokens, limitExceeded, requestIndex: request.index, provider: request.provider, model: request.model, contextHash: request.contextHash } });
        if (limitExceeded) throw failure('MODEL_INPUT_BUDGET', `The full context exceeds the conservative input estimate limit (${budget.conservativeInputTokens} > ${config.budget.maxInputTokens}; ${budget.method}). No content was truncated. The estimate is not provider billing.`);
        const id = `${job.id}:${stage}:${request.sessionId}:${request.index}`;
        this.settings.reserve(id, budget.conservativeInputTokens + config.budget.maxOutputTokens); requestIds.set(request.index, id);
      },
      onUsage: usage => {
        this.settings.settle(requestIds.get(usage.request), usage, typeof usage.totalTokens === 'number' ? usage.totalTokens : null);
      },
    });
    this.store.saveJobArtifact({ lease: job.lease, stage: stage + '-usage', value: { status: result.status, usage: result.usage, requests: result.requests, ...(result.requestChecks ? { requestChecks: result.requestChecks } : {}), ...(result.error ? { error: result.error } : {}) } });
    if (result.status === 'deferred' && Array.isArray(result.requests) && result.requests.length === 0 && Array.isArray(result.usage) && result.usage.length === 0) throw Object.assign(failure(result.error?.code || 'HOST_MODEL_UNAVAILABLE', result.error?.message || 'Waiting for a host with the configured model route.'), { deferred: true, stage });
    if (result.status !== 'completed') throw failure(result.error?.code || 'MODEL_RUN_FAILED', result.error?.message || 'Model role did not complete.');
    this.store.saveJobArtifact({ lease: job.lease, stage: stage + '-result', value: result });
    return result;
  }
  async executeJob(job) {
    const heartbeat = setInterval(() => { try { this.store.renewJob({ ...job.lease, leaseMs: 60000 }); } catch (e) { this.jobAbort?.abort(e); this.report(e); } }, 15000); heartbeat.unref?.();
    const current = this.store.getWorkspace(job.workspace_id), workspace = { id: current.id, root: job.payload.currentRoot || current.root };
    const artifacts = this.store.getJobArtifacts(job.id), config = this.settings.get();
    const models = job.payload.models || config.models;
    let evidencePaths = [];
    try {
      this.assertAutomaticWorkspace(job);
      if (artifacts.final) return this.commitJob(job, validateOutput('DraftResult', artifacts.final));
      if (job.kind === 'G2') {
        evidencePaths = await this.evidence(job, workspace);
        const result = await this.run(job, 'audit', 'G2', { workspace, snapshot: job.snapshot, evidencePaths, model: models.g2 || job.snapshot.route, prompt: rolePrompt('G2', { task: job.payload, workspace, window: job.window, evidence: evidencePaths, schema: contractSchema('DraftResult') }) });
        const final = normalizeSources(validateOutput('DraftResult', result.output), this.sourceAliases(job));
        this.store.saveJobArtifact({ lease: job.lease, stage: 'final', value: final });
        return this.commitJob(job, final);
      }
      evidencePaths = await this.evidence(job, workspace);
      const index = this.store.browse({ workspaceId: workspace.id, pageSize: 1000 });
      let candidate = artifacts.candidate;
      if (!candidate) {
        candidate = await this.run(job, 'candidate', 'DREAMER', { workspace, evidencePaths, model: models.dreamer, prompt: rolePrompt('DREAMING', { task: { instruction: 'Audit selected project evidence, maintain current memory, and produce a candidate.', index }, workspace, evidence: evidencePaths, schema: contractSchema('DraftResult') }) });
        candidate = { ...candidate, output: normalizeSources(validateOutput('DraftResult', candidate.output), this.sourceAliases(job)) };
        this.store.saveJobArtifact({ lease: job.lease, stage: 'candidate', value: candidate });
      }
      if (!candidate.output.operations.length) return this.commitJob(job, candidate.output);
      const candidateId = sha(candidate.output);
      let review = artifacts.review;
      if (!review) {
        const reviewed = await this.run(job, 'review', 'REVIEWER', { workspace, evidencePaths, model: models.reviewer, prompt: rolePrompt('REVIEWER', { workspace, evidence: evidencePaths, candidate: { candidate_id: candidateId, ...candidate.output }, schema: contractSchema('ReviewAdvice') }) });
        review = normalizeSources(validateOutput('ReviewAdvice', reviewed.output), this.sourceAliases(job));
        if (review.candidate_id !== candidateId) throw failure('REVIEW_CANDIDATE_MISMATCH', 'Reviewer returned a different candidate identity.');
        this.store.saveJobArtifact({ lease: job.lease, stage: 'review', value: review });
      }
      if (!candidate.snapshot) throw failure('DREAMER_CONTEXT_UNAVAILABLE', 'Cannot restore the Dreamer context for its final revision.');
      // This is a continuation of the complete candidate context. Its policy,
      // schema, evidence and candidate output are already inherited; repeating
      // them would consume the final-stage budget without adding information.
      const continuation = `Continue your completed Dreamer candidate in the full inherited context. Its policy, DraftResult output contract, source evidence and candidate output are already present. Revise that candidate using the one completed independent review below. candidate_id is the host identifier for that candidate. Return only the final DraftResult JSON under the inherited contract. Do not restart candidate generation or request another review. If required inherited content or evidence is unavailable, report partial rather than inventing it.\n${JSON.stringify({ candidate_id: candidateId, review_advice: review })}`;
      const finalRun = await this.run(job, 'final', 'DREAMER', { workspace, snapshot: candidate.snapshot, evidencePaths, model: models.dreamer, prompt: continuation });
      const final = normalizeSources(validateOutput('DraftResult', finalRun.output), this.sourceAliases(job));
      this.store.saveJobArtifact({ lease: job.lease, stage: 'final', value: final });
      return this.commitJob(job, final);
    } finally { clearInterval(heartbeat); this.cleanupEvidence(job); }
  }
  close() {
    if (this.closePromise) return this.closePromise;
    this.closed = true; clearInterval(this.timer);
    this.closePromise = Promise.resolve().then(async () => {
      this.jobAbort?.abort(failure('CONTROLLER_CLOSED', 'AutoMemory is shutting down.'));
      // Keep databases open until both an in-flight tick and its active role
      // have unwound; no new claim is permitted after closed becomes true.
      if (this.tickPromise) { try { await this.tickPromise; } catch (error) { this.report(error); } }
      if (this.active) await this.active;
      await this.management?.dispose();
      await this.host.close();
      for (const w of this.store.listWorkspaces()) this.store.setWorkspaceBusy({ workspaceId: w.id, owner: this.owner, busy: false });
      this.pendingReads.clear(); this.turnProfiles.clear(); this.callSeqs.clear(); this.sessions.clear();
      this.store.close(); this.profile.close(); this.settings.close();
    });
    return this.closePromise;
  }
  cleanupWorkspace(workspaceId, beforeEpoch = Infinity) {
    this.management?.clearWorkspace(workspaceId);
    const root = path.join(this.dataDir, 'job-evidence');
    if (existsSync(root)) for (const entry of readdirSync(root, { withFileTypes: true })) {
      const job = this.store.getJob(entry.name);
      if (job?.workspace_id === workspaceId && job.epoch < beforeEpoch) rmSync(path.join(root, entry.name), { recursive: true, force: true });
    }
    for (const [key, value] of this.pendingReads) if (value.workspaceId === workspaceId) this.pendingReads.delete(key);
  }
  async cleanupRoleSessions(workspaceId) {
    let incomplete = false;
    await this.management?.cleanupNativeSessions(workspaceId);
    for (const row of this.store.listRoleSessions({ workspaceId, pendingOnly: true })) {
      try {
        // A seed may not exist yet. A live creator must acknowledge disposal
        // before absence can mean deletion; lease expiry alone is insufficient.
        if (row.state === 'planned') {
          let live = true;
          if (row.owner_pid) try { process.kill(row.owner_pid, 0); } catch (error) { if (error.code === 'ESRCH') live = false; }
          if (live) throw failure('ROLE_SESSION_BUSY', 'A role creator has not yet finished releasing its session.');
        }
        const result = await this.host.deleteRoleSession(row.session_id, { storage: row.storage });
        if (!['deleted', 'absent'].includes(result?.status)) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'The host did not confirm role-session removal.');
        this.store.markRoleSessionDeleted(row.session_id);
      } catch (error) {
        incomplete = true; this.store.recordRoleCleanupFailure(row.session_id, error.code); this.report(error);
      }
    }
    if (incomplete) throw failure('CLEANUP_INCOMPLETE', 'Generated background role sessions could not all be cleared; cleanup will retry.');
  }
  syncProfileEpoch() {
    const epoch = this.profile.settings().clearEpoch;
    if (this.profileEpoch !== epoch) { this.turnProfiles.clear(); this.profileEpoch = epoch; }
  }
  async cleanupGlobal(requestId) {
    if (this.profile.settings().cleanupRequest !== requestId) return this.profile.completeExternalCleanup(requestId);
    this.management?.clearGlobal();
    await this.management?.cleanupNativeSessions();
    this.jobAbort?.abort(failure('CLEANUP_CANCELLED', 'Global profile clearing cancels old audit context.'));
    if (this.active) await this.active;
    // Native persistence cleanup is asynchronous. Durable per-request markers
    // make retries safe even when a different host finishes the same clear.
    for (const w of this.store.listWorkspaces()) {
      if (this.profile.settings().cleanupRequest !== requestId) return this.profile.completeExternalCleanup(requestId);
      const cleaned = this.store.scrubRuntimeCopies(w.id, { requestId });
      if ((cleaned.local_cleanup_status ?? cleaned.cleanup_status) !== 'complete') throw failure('CLEANUP_INCOMPLETE', 'Project runtime copies could not all be cleared.');
      this.cleanupWorkspace(w.id, cleaned.epoch);
      await this.cleanupRoleSessions(w.id);
      this.store.completeRuntimeCleanup({ workspaceId: w.id, requestId });
    }
    return this.profile.completeExternalCleanup(requestId, () => { this.turnProfiles.clear(); this.pendingReads.clear(); });
  }
}
