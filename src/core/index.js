import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync, openSync, closeSync, fsyncSync, writeFileSync, readFileSync, existsSync, unlinkSync, readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { MemoryError, requireValue, text, stable, digest, validateDraft, validateSources } from './validate.js';
import { renderMemory, renderIndex, renderIndexHint, INDEX_RENDER_VERSION } from './render.js';
import { sessionReference, insideEvidence } from './evidence.js';
export { MemoryError, renderMemory, renderIndex };

const DAY = 86400000;
const parse = value => value == null ? null : JSON.parse(value);
const nowIso = n => new Date(n).toISOString();
const version = n => `v${n}`;
const revision = n => `r${n}`;
const safeSeq = n => Number.isSafeInteger(n) && n >= -1;
const id = prefix => `${prefix}_${randomUUID()}`;
const sourceKey = source => stable({ source_kind: source.source_kind, locator: source.locator, version_hint: source.version_hint ?? null });
const CLEANUP_SCOPE = 'Plugin-managed formal memory, persisted turn bundles, staging, job snapshots/artifacts, generated background role sessions and audit copies. Excludes original user DSH sessions, project files, providers, external exports/backups and forensic media erasure.';

/** Deterministic project memory authority. All model and host adapters stay outside. */
export class MemoryStore {
  constructor({ dataDir, clock = Date.now, maxIndexBytes = 65536, retentionDays = 30, dreamIntervalMs = DAY } = {}) {
    text(dataDir, 'dataDir');
    this.dataDir = path.resolve(dataDir); this.clock = clock;
    this.maxIndexBytes = maxIndexBytes; this.retentionDays = retentionDays; this.setDreamIntervalMs(dreamIntervalMs);
    mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(this.dataDir, 'memory.sqlite'));
    chmodSync(path.join(this.dataDir, 'memory.sqlite'), 0o600);
    this.db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      INSERT OR IGNORE INTO schema_meta VALUES ('version','1');
      CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, root TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, revision INTEGER NOT NULL DEFAULT 0, epoch INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, dirty_seq INTEGER NOT NULL DEFAULT 0, dream_processed_seq INTEGER NOT NULL DEFAULT 0, last_dream_started INTEGER);
      CREATE TABLE IF NOT EXISTS memories (workspace_id TEXT NOT NULL REFERENCES workspaces(id), id TEXT NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL CHECK(status IN ('current','archived','retracted')), content TEXT NOT NULL, source_refs TEXT NOT NULL, reason TEXT NOT NULL, replacements TEXT NOT NULL DEFAULT '[]', title TEXT NOT NULL, category TEXT NOT NULL, group_name TEXT NOT NULL, index_hint TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(workspace_id,id));
      CREATE INDEX IF NOT EXISTS memory_index ON memories(workspace_id,status,category,group_name,id);
      CREATE TABLE IF NOT EXISTS tombstones (workspace_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL,deleted_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,id));
      CREATE TABLE IF NOT EXISTS receipts (workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,hash TEXT NOT NULL,receipt TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,request_id));
      CREATE TABLE IF NOT EXISTS sessions (workspace_id TEXT NOT NULL REFERENCES workspaces(id),id TEXT NOT NULL,managed_start INTEGER NOT NULL,g2_cursor INTEGER NOT NULL,dream_cursor INTEGER NOT NULL,head_seq INTEGER NOT NULL,last_index_hash TEXT,last_revision INTEGER NOT NULL DEFAULT -1,PRIMARY KEY(workspace_id,id));
      CREATE TABLE IF NOT EXISTS evidence_ranges (workspace_id TEXT NOT NULL,session_id TEXT NOT NULL,start_seq INTEGER NOT NULL,end_seq INTEGER NOT NULL,PRIMARY KEY(workspace_id,session_id,start_seq));
      CREATE TABLE IF NOT EXISTS evidence_observed (workspace_id TEXT NOT NULL,session_id TEXT NOT NULL,head_seq INTEGER NOT NULL,PRIMARY KEY(workspace_id,session_id));
      CREATE TABLE IF NOT EXISTS memory_provenance (workspace_id TEXT NOT NULL,memory_id TEXT NOT NULL,version INTEGER NOT NULL,change_source_refs TEXT NOT NULL,PRIMARY KEY(workspace_id,memory_id));
      CREATE TABLE IF NOT EXISTS core_write_gate (id INTEGER PRIMARY KEY CHECK(id=1),active INTEGER NOT NULL DEFAULT 0);
      INSERT OR IGNORE INTO core_write_gate VALUES (1,0);
      CREATE TABLE IF NOT EXISTS subscriptions (workspace_id TEXT NOT NULL,session_id TEXT NOT NULL,memory_id TEXT NOT NULL,version INTEGER NOT NULL,status TEXT NOT NULL,issue_signature TEXT NOT NULL DEFAULT '',PRIMARY KEY(workspace_id,session_id,memory_id));
      CREATE TABLE IF NOT EXISTS bundles (workspace_id TEXT NOT NULL,session_id TEXT NOT NULL,turn_id TEXT NOT NULL,bundle TEXT NOT NULL,observations TEXT NOT NULL,provided INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,session_id,turn_id));
      CREATE TABLE IF NOT EXISTS index_cache (workspace_id TEXT PRIMARY KEY,revision INTEGER NOT NULL,markdown TEXT NOT NULL,hash TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS issues (workspace_id TEXT NOT NULL,id TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL,proposal TEXT NOT NULL,request_id TEXT NOT NULL,issue_key TEXT NOT NULL,created_at INTEGER NOT NULL,resolved_at INTEGER,PRIMARY KEY(workspace_id,id),UNIQUE(workspace_id,request_id,issue_key));
      CREATE TABLE IF NOT EXISTS issue_memories (workspace_id TEXT NOT NULL,issue_id TEXT NOT NULL,memory_id TEXT NOT NULL,PRIMARY KEY(workspace_id,issue_id,memory_id));
      CREATE TABLE IF NOT EXISTS activity (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,channel TEXT NOT NULL,event_type TEXT NOT NULL,request_id TEXT,job_id TEXT,changed INTEGER NOT NULL DEFAULT 0,metadata TEXT NOT NULL,detail TEXT,created_at INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS activity_scope ON activity(workspace_id,created_at DESC);
      CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id),kind TEXT NOT NULL,request_id TEXT NOT NULL,request_hash TEXT NOT NULL,session_id TEXT,end_seq INTEGER,start_seq INTEGER,status TEXT NOT NULL,owner TEXT,token INTEGER NOT NULL DEFAULT 0,lease_until INTEGER,epoch INTEGER NOT NULL,snapshot TEXT,payload TEXT NOT NULL,result TEXT,error TEXT,manual INTEGER NOT NULL DEFAULT 0,dirty_seq INTEGER NOT NULL,created_at INTEGER NOT NULL,started_at INTEGER,finished_at INTEGER,UNIQUE(workspace_id,request_id));
      CREATE INDEX IF NOT EXISTS job_queue ON jobs(status,created_at);
      CREATE TABLE IF NOT EXISTS job_artifacts (job_id TEXT NOT NULL REFERENCES jobs(id),stage TEXT NOT NULL,value TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(job_id,stage));
      CREATE TABLE IF NOT EXISTS job_deferrals (job_id TEXT NOT NULL REFERENCES jobs(id),owner TEXT NOT NULL,detail TEXT NOT NULL,observed_at INTEGER NOT NULL,PRIMARY KEY(job_id,owner));
      CREATE TABLE IF NOT EXISTS overview_views (workspace_id TEXT PRIMARY KEY,source_hash TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS native_workspace_links (native_id TEXT PRIMARY KEY,memory_id TEXT NOT NULL,root TEXT NOT NULL,path TEXT NOT NULL,title TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS presence (workspace_id TEXT NOT NULL,owner TEXT NOT NULL,busy INTEGER NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(workspace_id,owner));
      CREATE TABLE IF NOT EXISTS cleanup_requests (workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,epoch INTEGER NOT NULL,external_pending INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(workspace_id,request_id));
      CREATE TABLE IF NOT EXISTS revoked_requests (workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,PRIMARY KEY(workspace_id,request_id));
      CREATE TABLE IF NOT EXISTS role_sessions (session_id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,job_id TEXT NOT NULL,role TEXT NOT NULL,epoch INTEGER NOT NULL,owner TEXT NOT NULL,owner_pid INTEGER,state TEXT NOT NULL,cleanup_pending INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,settled_at INTEGER,deleted_at INTEGER,cleanup_error TEXT,storage TEXT);
      CREATE INDEX IF NOT EXISTS role_cleanup ON role_sessions(workspace_id,cleanup_pending,state);
      CREATE TABLE IF NOT EXISTS runtime_cleanups (workspace_id TEXT NOT NULL,request_id TEXT NOT NULL,epoch INTEGER NOT NULL,complete INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(workspace_id,request_id));
    `);
    this._tx(() => {
      if (!this._all('PRAGMA table_info(workspaces)').some(x => x.name === 'automatic_dream')) this.db.exec('ALTER TABLE workspaces ADD COLUMN automatic_dream INTEGER NOT NULL DEFAULT 1');
      if (!this._all('PRAGMA table_info(cleanup_requests)').some(x => x.name === 'external_pending')) this.db.exec('ALTER TABLE cleanup_requests ADD COLUMN external_pending INTEGER NOT NULL DEFAULT 0');
      if (!this._all('PRAGMA table_info(sessions)').some(x => x.name === 'dream_cursor')) this.db.exec('ALTER TABLE sessions ADD COLUMN dream_cursor INTEGER; UPDATE sessions SET dream_cursor=managed_start WHERE dream_cursor IS NULL');
      if (!this._all('PRAGMA table_info(role_sessions)').some(x => x.name === 'storage')) this.db.exec('ALTER TABLE role_sessions ADD COLUMN storage TEXT');
      if (!this._get("SELECT 1 FROM schema_meta WHERE key='evidence_ranges_v1'")) {
        const counts = new Map();
        for (const session of this._all('SELECT * FROM sessions')) if (session.head_seq > session.managed_start) {
          this._allowEvidence(session.workspace_id, session.id, session.managed_start + 1, session.head_seq);
          counts.set(session.workspace_id, (counts.get(session.workspace_id) || 0) + 1);
        }
        for (const [workspaceId, count] of counts) this._event(workspaceId, 'SYSTEM', 'evidence.migrated', { metadata: { sessions: count, policy: 'preserve_preexisting_enrollment', historic_disabled_intervals_unknown: true } });
        this._run("INSERT INTO schema_meta VALUES ('evidence_ranges_v1','1')");
      }
      this.db.exec('INSERT OR IGNORE INTO evidence_observed SELECT workspace_id,id,head_seq FROM sessions');
      // Cross-version coordination, not an authentication mechanism. An old
      // process cannot mutate new invariants while pretending to support them.
      for (const table of ['memories', 'issues', 'jobs']) for (const event of ['INSERT', 'UPDATE']) this.db.exec(`CREATE TRIGGER IF NOT EXISTS gate_${table}_${event.toLowerCase()} BEFORE ${event} ON ${table} WHEN (SELECT active FROM core_write_gate WHERE id=1)<>2 BEGIN SELECT RAISE(ABORT,'AUTOMEMORY_RELOAD_REQUIRED: reload the older AutoMemory host before changing memory'); END`);
      this.db.exec("CREATE TRIGGER IF NOT EXISTS gate_workspace_enabled BEFORE UPDATE OF enabled ON workspaces WHEN (SELECT active FROM core_write_gate WHERE id=1)<>2 BEGIN SELECT RAISE(ABORT,'AUTOMEMORY_RELOAD_REQUIRED: reload the older AutoMemory host before changing memory'); END");
      // DELETE remains compatible for cleanup; the auxiliary provenance is
      // always removed by SQLite, including deletion by an older cleanup path.
      this.db.exec('CREATE TRIGGER IF NOT EXISTS delete_memory_provenance AFTER DELETE ON memories BEGIN DELETE FROM memory_provenance WHERE workspace_id=OLD.workspace_id AND memory_id=OLD.id; END');
      // Preserve pre-ledger role IDs before any artifact pruning or deletion.
      for (const a of this._all("SELECT a.value,a.created_at,j.* FROM job_artifacts a JOIN jobs j ON j.id=a.job_id WHERE a.stage LIKE '%-session'")) {
        const artifact = parse(a.value), sessionId = artifact?.sessionId;
        if (typeof sessionId !== 'string' || !/^automemory-(g2|dreamer|reviewer|manager)-[A-Za-z0-9_-]{1,128}$/.test(sessionId)) continue;
        const ownerPid = Number(/^host-(\d+)-/.exec(a.owner || '')?.[1]) || null;
        // The old onCreated artifact proves creation already finished. Any
        // still-live writer is guarded by the native persistence write lock.
        this._run('INSERT OR IGNORE INTO role_sessions(session_id,workspace_id,job_id,role,epoch,owner,owner_pid,state,created_at,settled_at,storage) VALUES (?,?,?,?,?,?,?,?,?,?,?)', sessionId, a.workspace_id, a.id, sessionId.split('-')[1].toUpperCase(), a.epoch, a.owner || 'legacy', ownerPid, 'settled', a.created_at, a.finished_at ?? a.created_at, artifact.storage ? stable(artifact.storage) : null);
      }
    });
    requireValue(this._get("SELECT value FROM schema_meta WHERE key='version'").value === '1', 'SCHEMA_UNSUPPORTED', 'Unsupported memory database schema');
    this.recoverCleanup();
  }
  close() { this.db.close(); }
  setDreamIntervalMs(value) { requireValue(Number.isFinite(value) && value >= DAY, 'INVALID_CONFIGURATION', 'Automatic Dreamer interval must be at least 24 hours'); this.dreamIntervalMs = value; }
  _get(sql, ...args) { return this.db.prepare(sql).get(...args); }
  _all(sql, ...args) { return this.db.prepare(sql).all(...args); }
  _run(sql, ...args) { return this.db.prepare(sql).run(...args); }
  _tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { this._run('UPDATE core_write_gate SET active=2 WHERE id=1'); const result = fn(); this._run('UPDATE core_write_gate SET active=0 WHERE id=1'); this.db.exec('COMMIT'); return result; }
    catch (error) { this.db.exec('ROLLBACK'); throw error; }
  }
  _workspace(workspaceId, enabled = true) {
    const row = this._get('SELECT * FROM workspaces WHERE id=?', workspaceId);
    requireValue(row, 'WORKSPACE_NOT_FOUND', 'Workspace is not registered');
    if (enabled) requireValue(row.enabled === 1, 'WORKSPACE_DISABLED', 'Project automatic memory is disabled');
    return row;
  }
  _bump(workspaceId) { this._run('UPDATE workspaces SET revision=revision+1 WHERE id=?', workspaceId); }
  _event(workspaceId, channel, eventType, { requestId = null, jobId = null, changed = false, metadata = {}, detail = null } = {}) {
    this._run('INSERT INTO activity VALUES (?,?,?,?,?,?,?,?,?,?)', id('A'), workspaceId, channel, eventType, requestId, jobId, Number(changed), stable(metadata), detail == null ? null : stable(detail), this.clock());
  }
  nativeWorkspace(nativeId) { return this._get('SELECT * FROM native_workspace_links WHERE native_id=?', nativeId); }
  nativeWorkspaceLinks() { return this._all('SELECT * FROM native_workspace_links'); }
  rememberNativeWorkspace({ nativeId, memoryId, root, path, title }) {
    this._run('INSERT INTO native_workspace_links(native_id,memory_id,root,path,title) VALUES (?,?,?,?,?) ON CONFLICT(native_id) DO UPDATE SET memory_id=excluded.memory_id,root=excluded.root,path=excluded.path,title=excluded.title WHERE memory_id<>excluded.memory_id OR root<>excluded.root OR path<>excluded.path OR title<>excluded.title', nativeId, memoryId, root, path, title);
  }
  registerWorkspace({ id: workspaceId, root }) {
    text(workspaceId, 'workspaceId'); text(root, 'root');
    return this._tx(() => {
      const existing = this._get('SELECT * FROM workspaces WHERE id=?', workspaceId);
      if (existing) requireValue(existing.root === path.resolve(root), 'WORKSPACE_IDENTITY_CONFLICT', 'Workspace identity already belongs to another root; use explicit migration');
      else this._run('INSERT INTO workspaces(id,root,created_at) VALUES (?,?,?)', workspaceId, path.resolve(root), this.clock());
      return this.getWorkspace(workspaceId);
    });
  }
  getWorkspace(workspaceId) { const x = this._workspace(workspaceId, false); return { ...x, enabled: !!x.enabled, workspace_revision: revision(x.revision) }; }
  listWorkspaces() { return this._all('SELECT * FROM workspaces ORDER BY root').map(x => ({ ...x, enabled: !!x.enabled, workspace_revision: revision(x.revision) })); }
  setWorkspaceEnabled(workspaceId, enabled) {
    requireValue(typeof enabled === 'boolean', 'INVALID_PROPOSAL', 'enabled must be boolean');
    return this._tx(() => {
      const ws = this._workspace(workspaceId, false);
      if (ws.enabled !== Number(enabled)) {
        this._run('UPDATE workspaces SET enabled=?,epoch=epoch+1,revision=revision+1 WHERE id=?', Number(enabled), workspaceId);
        if (!enabled) this._run("UPDATE jobs SET status='paused',owner=NULL,lease_until=NULL,token=token+1 WHERE workspace_id=? AND status IN ('queued','running')", workspaceId);
        else this._run("UPDATE jobs SET status='queued',epoch=(SELECT epoch FROM workspaces WHERE id=?),owner=NULL,lease_until=NULL WHERE workspace_id=? AND status='paused'", workspaceId, workspaceId);
        this._event(workspaceId, 'SYSTEM', 'workspace.enabled', { metadata: { enabled } });
      }
      return this.getWorkspace(workspaceId);
    });
  }
  setAutomaticDream(workspaceId, enabled) {
    requireValue(typeof enabled === 'boolean', 'INVALID_PROPOSAL', 'enabled must be boolean');
    return this._tx(() => {
      this._workspace(workspaceId, false);
      this._run('UPDATE workspaces SET automatic_dream=? WHERE id=?', Number(enabled), workspaceId);
      this._event(workspaceId, 'SYSTEM', 'workspace.automatic_dream', { metadata: { enabled } });
      return this.getWorkspace(workspaceId);
    });
  }
  registerSession({ workspaceId, sessionId, headSeq = -1, newSession = false }) {
    text(sessionId, 'sessionId'); requireValue(safeSeq(headSeq), 'INVALID_PROPOSAL', 'invalid head sequence');
    return this._tx(() => {
      const ws = this._workspace(workspaceId, false);
      const start = newSession && ws.enabled ? -1 : headSeq;
      this._run('INSERT OR IGNORE INTO sessions(workspace_id,id,managed_start,g2_cursor,dream_cursor,head_seq) VALUES (?,?,?,?,?,?)', workspaceId, sessionId, start, start, start, headSeq);
      this._run('INSERT OR IGNORE INTO evidence_observed VALUES (?,?,?)', workspaceId, sessionId, newSession && ws.enabled ? Math.max(-1, headSeq - 1) : headSeq);
      this._run('UPDATE sessions SET head_seq=MAX(head_seq,?) WHERE workspace_id=? AND id=?', headSeq, workspaceId, sessionId);
      return this._get('SELECT * FROM sessions WHERE workspace_id=? AND id=?', workspaceId, sessionId);
    });
  }
  updateSessionHead({ workspaceId, sessionId, headSeq, hasNewEvidence = true, eventOnly = false, observeOnly = false }) {
    requireValue(safeSeq(headSeq), 'INVALID_PROPOSAL', 'invalid head sequence');
    this._workspace(workspaceId, false);
    const before = this._session(workspaceId, sessionId);
    const observedBefore = this._get('SELECT head_seq FROM evidence_observed WHERE workspace_id=? AND session_id=?', workspaceId, sessionId)?.head_seq ?? before.head_seq;
    // A duplicate, older or out-of-order event can never be admitted (admission
    // requires passing the observed head) and can never advance either head,
    // regardless of the enable switch or managed start. Committing that empty
    // transaction would only contend the SQLite write lock that live
    // multi-host writers depend on, so skip it. These pre-lock reads are used
    // for this decision only; racing writers can only make the heads larger,
    // which makes the same skip decision more conservative, never less.
    if (headSeq <= before.head_seq && headSeq <= observedBefore) return before;
    return this._tx(() => {
      // Every admission decision is re-read under the write lock: another host
      // can flip the enable switch between the pre-lock reads and this BEGIN
      // IMMEDIATE, and an event observed while disabled must stay excluded
      // even though the pre-lock snapshot still saw the workspace enabled.
      const ws = this._workspace(workspaceId, false), s = this._session(workspaceId, sessionId);
      const observed = this._get('SELECT head_seq FROM evidence_observed WHERE workspace_id=? AND session_id=?', workspaceId, sessionId)?.head_seq ?? s.head_seq;
      let admitted = false;
      if (ws.enabled && !observeOnly && headSeq > s.managed_start && headSeq > observed) {
        // Exact event admission avoids filling gaps missed while another host
        // changed the switch. Bulk callers explicitly own the entire suffix.
        const start = eventOnly ? headSeq : Math.max(s.head_seq + 1, s.managed_start + 1);
        if (headSeq >= start) admitted = this._allowEvidence(workspaceId, sessionId, start, headSeq);
      }
      if (headSeq > s.head_seq) {
        this._run('UPDATE sessions SET head_seq=? WHERE workspace_id=? AND id=?', headSeq, workspaceId, sessionId);
      }
      this._run('INSERT INTO evidence_observed VALUES (?,?,?) ON CONFLICT(workspace_id,session_id) DO UPDATE SET head_seq=MAX(head_seq,excluded.head_seq)', workspaceId, sessionId, headSeq);
      if (admitted && hasNewEvidence) this._run('UPDATE workspaces SET dirty_seq=dirty_seq+1 WHERE id=?', workspaceId);
      return this._session(workspaceId, sessionId);
    });
  }
  _allowEvidence(workspaceId, sessionId, start, end) {
    if (end < start) return false;
    const rows = this._all('SELECT * FROM evidence_ranges WHERE workspace_id=? AND session_id=? AND end_seq>=? AND start_seq<=? ORDER BY start_seq', workspaceId, sessionId, start - 1, end + 1);
    const covered = rows.reduce((n, row) => n + Math.max(0, Math.min(end, row.end_seq) - Math.max(start, row.start_seq) + 1), 0);
    if (covered === end - start + 1) return false;
    for (const row of rows) { start = Math.min(start, row.start_seq); end = Math.max(end, row.end_seq); this._run('DELETE FROM evidence_ranges WHERE workspace_id=? AND session_id=? AND start_seq=?', workspaceId, sessionId, row.start_seq); }
    this._run('INSERT INTO evidence_ranges VALUES (?,?,?,?)', workspaceId, sessionId, start, end); return true;
  }
  allowedEvidenceRanges({ workspaceId, sessionId, startExclusive = -1, endInclusive }) {
    const session = this._session(workspaceId, sessionId), end = endInclusive ?? session.head_seq;
    requireValue(safeSeq(startExclusive) && safeSeq(end) && end <= session.head_seq, 'INVALID_PROPOSAL', 'Invalid evidence bounds');
    return this._all('SELECT start_seq,end_seq FROM evidence_ranges WHERE workspace_id=? AND session_id=? AND end_seq>? AND start_seq<=? ORDER BY start_seq', workspaceId, sessionId, startExclusive, end).map(row => ({ startExclusive: Math.max(row.start_seq - 1, startExclusive), endInclusive: Math.min(row.end_seq, end) }));
  }
  _session(workspaceId, sessionId) {
    const s = this._get('SELECT * FROM sessions WHERE workspace_id=? AND id=?', workspaceId, sessionId);
    requireValue(s, 'SESSION_NOT_MANAGED', 'Session is not registered for this project'); return s;
  }
  includeHistory({ workspaceId, sessionId, startExclusive = -1 }) {
    requireValue(safeSeq(startExclusive), 'INVALID_PROPOSAL', 'invalid history boundary');
    return this._tx(() => {
      this._workspace(workspaceId); const s = this._session(workspaceId, sessionId);
      requireValue(startExclusive <= s.head_seq, 'INVALID_PROPOSAL', 'History boundary is beyond session head');
      requireValue(!this._get("SELECT 1 FROM jobs WHERE workspace_id=? AND session_id=? AND status IN ('queued','running','paused')", workspaceId, sessionId), 'TASK_IN_PROGRESS', 'Wait for or cancel existing session audit before changing history scope');
      const start = Math.min(s.managed_start, startExclusive);
      const added = this._allowEvidence(workspaceId, sessionId, startExclusive + 1, s.head_seq);
      this._run('UPDATE sessions SET managed_start=? WHERE workspace_id=? AND id=?', start, workspaceId, sessionId);
      if (added) {
        this._run('UPDATE sessions SET g2_cursor=MIN(g2_cursor,?),dream_cursor=MIN(dream_cursor,?) WHERE workspace_id=? AND id=?', startExclusive, startExclusive, workspaceId, sessionId);
        this._run('UPDATE workspaces SET dirty_seq=dirty_seq+1 WHERE id=?', workspaceId);
        this._event(workspaceId, 'MEMORY_UI', 'evidence.history_included', { metadata: { session_id: sessionId, start_exclusive: startExclusive, end_inclusive: s.head_seq, origin: 'explicit_history_selection' } });
      }
      return this._session(workspaceId, sessionId);
    });
  }
  listSessions(workspaceId) {
    this._workspace(workspaceId, false);
    return this._all('SELECT * FROM sessions WHERE workspace_id=? ORDER BY id', workspaceId).map(session => ({ ...session, history_fully_included: session.head_seq < 0 || insideEvidence(this.allowedEvidenceRanges({ workspaceId, sessionId: session.id }), 0, session.head_seq) }));
  }
  setWorkspaceBusy({ workspaceId, owner, busy, leaseMs = 60000 }) {
    this._workspace(workspaceId, false); text(owner, 'owner');
    this._run('INSERT INTO presence VALUES (?,?,?,?) ON CONFLICT(workspace_id,owner) DO UPDATE SET busy=excluded.busy,expires_at=excluded.expires_at', workspaceId, owner, Number(!!busy), this.clock() + leaseMs);
  }
  _record(row) {
    if (!row) return null;
    const provenance = this._get('SELECT change_source_refs FROM memory_provenance WHERE workspace_id=? AND memory_id=? AND version=?', row.workspace_id, row.id, row.version);
    return { id: row.id, workspace_id: row.workspace_id, version: version(row.version), status: row.status, content: parse(row.content), source_refs: parse(row.source_refs), change_source_refs: parse(provenance?.change_source_refs) ?? [], status_reason: row.reason, replacement_refs: parse(row.replacements), created_at: nowIso(row.created_at), updated_at: nowIso(row.updated_at) };
  }
  _issueRefs(workspaceId, memoryId) {
    return this._all("SELECT i.id FROM issues i JOIN issue_memories m ON i.workspace_id=m.workspace_id AND i.id=m.issue_id WHERE m.workspace_id=? AND m.memory_id=? AND i.status='open' ORDER BY i.id", workspaceId, memoryId).map(x => x.id);
  }
  /** One grouped query for every open-issue reference in a workspace. Browse,
   * state reads and index rendering previously issued one join per memory row;
   * the UI polls these paths every 15 seconds. Ordering matches _issueRefs. */
  _openIssueRefs(workspaceId) {
    const grouped = new Map();
    for (const row of this._all("SELECT m.memory_id AS memory_id, i.id AS issue_id FROM issue_memories m JOIN issues i ON i.workspace_id=m.workspace_id AND i.id=m.issue_id WHERE m.workspace_id=? AND i.status='open' ORDER BY i.id", workspaceId)) {
      const list = grouped.get(row.memory_id);
      if (list) list.push(row.issue_id); else grouped.set(row.memory_id, [row.issue_id]);
    }
    return grouped;
  }
  _readOne(workspaceId, memoryId, includeNoncurrent) {
    const row = this._get('SELECT * FROM memories WHERE workspace_id=? AND id=?', workspaceId, memoryId);
    if (!row) {
      const dead = this._get('SELECT version FROM tombstones WHERE workspace_id=? AND id=?', workspaceId, memoryId);
      return { outcome: dead ? 'deleted' : 'not_found', memory_id: memoryId, message: dead ? 'Memory was deleted. Do not reuse previously supplied text.' : 'No memory in the current authorized workspace.', ...(dead ? { version: version(dead.version) } : {}) };
    }
    const issueRefs = this._issueRefs(workspaceId, memoryId);
    if (row.status !== 'current' && !includeNoncurrent) return { outcome: row.status, memory_id: row.id, version: version(row.version), message: `${row.status}: not a current memory. Request explicit historical access to read the body.`, replacement_refs: parse(row.replacements), issue_refs: issueRefs };
    const record = this._record(row);
    return { outcome: 'found', record, markdown: renderMemory(record, issueRefs), issue_refs: issueRefs };
  }
  read({ workspaceId, ids, includeNoncurrent = false, forManagement = false }) {
    requireValue(Array.isArray(ids) && ids.length <= 100 && ids.every(x => typeof x === 'string'), 'INVALID_PROPOSAL', 'ids must contain at most 100 IDs');
    return this._tx(() => { this._workspace(workspaceId, !forManagement); return ids.map(memoryId => this._readOne(workspaceId, memoryId, includeNoncurrent)); });
  }
  _observe(workspaceId, sessionId, observation) {
    const existing = this._get('SELECT * FROM subscriptions WHERE workspace_id=? AND session_id=? AND memory_id=?', workspaceId, sessionId, observation.id);
    if (existing && existing.version > observation.version) return;
    this._run('INSERT INTO subscriptions VALUES (?,?,?,?,?,?) ON CONFLICT(workspace_id,session_id,memory_id) DO UPDATE SET version=excluded.version,status=excluded.status,issue_signature=excluded.issue_signature', workspaceId, sessionId, observation.id, observation.version, observation.status, observation.issues || '');
  }
  markProvided({ workspaceId, sessionId, results }) {
    return this._tx(() => {
      this._session(workspaceId, sessionId);
      for (const result of results) {
        const memoryId = result.record?.id ?? result.memory_id;
        const suppliedVersion = result.record?.version ?? result.version;
        if (!suppliedVersion || !/^v\d+$/.test(suppliedVersion)) continue;
        requireValue(!result.record || result.record.workspace_id === workspaceId, 'PERMISSION_DENIED', 'Cannot subscribe to another workspace');
        this._observe(workspaceId, sessionId, { id: memoryId, version: Number(suppliedVersion.slice(1)), status: result.record?.status ?? result.outcome, issues: (result.issue_refs || []).join(',') });
      }
      this._recordReadProvided({ workspaceId, sessionId, role: 'main', results });
    });
  }
  _recordReadProvided({ workspaceId, sessionId, role, results }) {
    this._workspace(workspaceId, false); text(sessionId, 'sessionId'); text(role, 'role');
    requireValue(Array.isArray(results), 'INVALID_PROPOSAL', 'Read delivery results must be an array');
    const items = results.map(result => {
      requireValue(!result.record || result.record.workspace_id === workspaceId, 'PERMISSION_DENIED', 'Cannot record another workspace read');
      return { memory_id: result.record?.id ?? result.memory_id, version: result.record?.version ?? result.version ?? null, status: result.record?.status ?? result.outcome, body_provided: !!(result.record && typeof result.markdown === 'string') };
    });
    this._event(workspaceId, 'RECALL', 'memory.read', { metadata: { session_id: sessionId, role, items, count: items.length } });
  }
  recordReadProvided(input) { return this._tx(() => this._recordReadProvided(input)); }
  _entries(workspaceId, statuses = ['current'], category, group) {
    const clauses = ['workspace_id=?', `status IN (${statuses.map(() => '?').join(',')})`], args = [workspaceId, ...statuses];
    if (category) { clauses.push('category=?'); args.push(category); }
    if (group) { clauses.push('group_name=?'); args.push(group); }
    const openIssues = this._openIssueRefs(workspaceId);
    return this._all(`SELECT id,version,status,title,category,group_name,index_hint,content FROM memories WHERE ${clauses.join(' AND ')} ORDER BY category,group_name,id`, ...args).map(row => ({ id: row.id, version: version(row.version), status: row.status, title: row.title, category: row.category, group: row.group_name, index_hint: renderIndexHint(parse(row.content)), issue_refs: openIssues.get(row.id) || [] }));
  }
  browse({ workspaceId, category, statuses = ['current'], group, cursor, pageSize = 100, forManagement = false }) {
    requireValue(Array.isArray(statuses) && statuses.length && statuses.every(x => ['current', 'archived', 'retracted'].includes(x)), 'INVALID_PROPOSAL', 'invalid statuses');
    requireValue(Number.isInteger(pageSize) && pageSize >= 1 && pageSize <= 1000, 'INVALID_PROPOSAL', 'invalid page size');
    return this._tx(() => {
      const ws = this._workspace(workspaceId, !forManagement); let offset = 0;
      if (cursor) {
        let c; try { c = JSON.parse(Buffer.from(cursor, 'base64url').toString()); } catch { throw new MemoryError('INVALID_CURSOR', 'Invalid browse cursor'); }
        requireValue(c.workspaceId === workspaceId && c.revision === ws.revision && c.filter === digest({ category, statuses, group }), 'STALE_CURSOR', 'Browse snapshot changed; restart listing'); offset = c.offset;
        requireValue(Number.isSafeInteger(offset) && offset >= 0, 'INVALID_CURSOR', 'Invalid browse offset');
      }
      const all = this._entries(workspaceId, statuses, category, group), entries = all.slice(offset, offset + pageSize);
      return { workspace_id: workspaceId, snapshot_ref: revision(ws.revision), entries, next_cursor: offset + pageSize < all.length ? Buffer.from(JSON.stringify({ workspaceId, revision: ws.revision, filter: digest({ category, statuses, group }), offset: offset + pageSize })).toString('base64url') : null };
    });
  }
  prepareTurn({ workspaceId, sessionId, turnId }) {
    text(turnId, 'turnId');
    return this._tx(() => {
      const ws = this._workspace(workspaceId, false), session = this._session(workspaceId, sessionId);
      const old = this._get('SELECT bundle FROM bundles WHERE workspace_id=? AND session_id=? AND turn_id=?', workspaceId, sessionId, turnId);
      if (old) {
        const previous = parse(old.bundle);
        if (ws.enabled) return previous;
        return { state: 'unavailable', bundle_id: previous.bundle_id, workspace_id: workspaceId, session_id: sessionId, turn_id: turnId, error: { code: 'WORKSPACE_DISABLED', message: 'Project automatic memory is disabled' } };
      }
      const base = { bundle_id: id('B'), workspace_id: workspaceId, session_id: sessionId, turn_id: turnId };
      let bundle, observations = [];
      if (!ws.enabled) bundle = { ...base, state: 'unavailable', error: { code: 'WORKSPACE_DISABLED', message: 'Project automatic memory is disabled' } };
      else {
        let cache = this._get('SELECT * FROM index_cache WHERE workspace_id=? AND revision=?', workspaceId, ws.revision);
        if (!cache || cache.hash !== `${INDEX_RENDER_VERSION}:${digest(cache.markdown)}`) {
          const markdown = renderIndex(this._entries(workspaceId)); cache = { markdown, hash: `${INDEX_RENDER_VERSION}:${digest(markdown)}` };
          this._run('INSERT INTO index_cache VALUES (?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET revision=excluded.revision,markdown=excluded.markdown,hash=excluded.hash', workspaceId, ws.revision, markdown, cache.hash);
        }
        if (Buffer.byteLength(cache.markdown) > this.maxIndexBytes) bundle = { ...base, state: 'unavailable', error: { code: 'INDEX_CAPACITY', message: 'Full memory index exceeds configured capacity; no truncated index was supplied' } };
        else {
          const notifications = [];
          if (session.last_revision !== ws.revision) for (const sub of this._all('SELECT * FROM subscriptions WHERE workspace_id=? AND session_id=?', workspaceId, sessionId)) {
            const result = this._readOne(workspaceId, sub.memory_id, true), rec = result.record;
            const v = Number((rec?.version ?? result.version ?? version(sub.version)).slice(1));
            const status = rec?.status ?? result.outcome, issues = (result.issue_refs || []).join(',');
            if (v !== sub.version || status !== sub.status) {
              const replacements = rec?.replacement_refs || [];
              const kind = replacements.length ? 'replaced' : status === 'current' ? 'updated' : status;
              if (kind !== 'not_found') notifications.push({ kind, memory_id: sub.memory_id, from_version: version(sub.version), to_version: version(v), message: `${sub.memory_id}: ${kind}. ${kind === 'updated' ? 'The following current text replaces the previously provided version.' : 'Do not continue using the old version as current knowledge.'}`, ...(kind === 'updated' ? { content_markdown: result.markdown } : {}), ...(replacements.length ? { replacement_refs: replacements } : {}) });
              observations.push({ id: sub.memory_id, version: v, status, issues });
            }
            if (issues !== sub.issue_signature) {
              if (issues) notifications.push({ kind: 'needs_resolution', memory_id: sub.memory_id, issue_refs: result.issue_refs, message: `${sub.memory_id} has unresolved issues; do not treat disputed claims as unconditional facts.` });
              observations.push({ id: sub.memory_id, version: v, status, issues });
            }
          }
          bundle = { ...base, state: 'ready', snapshot_ref: revision(ws.revision), workspace_revision: revision(ws.revision), index_markdown: cache.markdown, index_hash: cache.hash, index_changed: session.last_index_hash !== null && session.last_index_hash !== cache.hash, notifications };
        }
      }
      this._run('INSERT INTO bundles(workspace_id,session_id,turn_id,bundle,observations,created_at) VALUES (?,?,?,?,?,?)', workspaceId, sessionId, turnId, stable(bundle), stable(observations), this.clock());
      this._event(workspaceId, 'RECALL', 'recall.bundle', { metadata: { session_id: sessionId, turn_id: turnId, bundle_id: bundle.bundle_id, state: bundle.state } });
      return bundle;
    });
  }
  markBundleProvided({ workspaceId, sessionId, turnId }) {
    return this._tx(() => {
      const row = this._get('SELECT * FROM bundles WHERE workspace_id=? AND session_id=? AND turn_id=?', workspaceId, sessionId, turnId);
      requireValue(row, 'NOT_FOUND', 'Turn bundle not found'); if (row.provided) return;
      const bundle = parse(row.bundle);
      if (bundle.state === 'ready') {
        for (const observation of parse(row.observations)) this._observe(workspaceId, sessionId, observation);
        const rev = Number(bundle.workspace_revision.slice(1)), session = this._session(workspaceId, sessionId);
        if (rev >= session.last_revision) this._run('UPDATE sessions SET last_index_hash=?,last_revision=? WHERE workspace_id=? AND id=?', bundle.index_hash, rev, workspaceId, sessionId);
      }
      this._run('UPDATE bundles SET provided=1 WHERE workspace_id=? AND session_id=? AND turn_id=?', workspaceId, sessionId, turnId);
    });
  }
  _stage(workspaceId, requestId, hash, draft) {
    requireValue(!this._get('SELECT 1 FROM revoked_requests WHERE workspace_id=? AND request_id=?', workspaceId, requestId), 'REQUEST_REVOKED', 'This staged request was invalidated by a user deletion');
    const dir = path.join(this.dataDir, 'staging', digest(workspaceId)); mkdirSync(dir, { recursive: true, mode: 0o700 });
    const filename = path.join(dir, `${digest(requestId)}.json`), body = stable({ requestId, hash, workspaceEpoch: this._workspace(workspaceId, false).epoch, draft });
    if (existsSync(filename)) requireValue(parse(readFileSync(filename, 'utf8')).hash === hash, 'IDEMPOTENCY_CONFLICT', 'Staged request identity has different content');
    else {
      let fd;
      try { fd = openSync(filename, 'wx', 0o600); writeFileSync(fd, body); fsyncSync(fd); }
      catch (error) { if (error.code !== 'EEXIST') throw error; requireValue(parse(readFileSync(filename, 'utf8')).hash === hash, 'IDEMPOTENCY_CONFLICT', 'Staged request identity has different content'); }
      finally { if (fd !== undefined) closeSync(fd); }
      const d = openSync(dir, 'r'); try { fsyncSync(d); } finally { closeSync(d); }
    }
    return filename;
  }
  _unstage(filename) { try { unlinkSync(filename); return true; } catch (e) { return e.code === 'ENOENT'; } }
  _context(context) {
    for (const key of ['workspaceId', 'requestId', 'channel']) text(context?.[key], key);
    requireValue(['G1', 'G2', 'DREAMING', 'MEMORY_UI'].includes(context.channel), 'PERMISSION_DENIED', 'Unknown submission channel');
  }
  submit(draft, context) {
    this._context(context);
    try { validateDraft(draft); } catch (error) { return this._rejection(context, error); }
    const hash = digest({ draft, channel: context.channel });
    const existing = this._get('SELECT hash,receipt FROM receipts WHERE workspace_id=? AND request_id=?', context.workspaceId, context.requestId);
    if (existing) {
      if (existing.hash !== hash) return this._rejection(context, new MemoryError('IDEMPOTENCY_CONFLICT', 'Request identity has different content'));
      const receipt = parse(existing.receipt);
      return ['pending', 'incomplete'].includes(receipt.cleanup_status) ? this._finishCleanup(context.workspaceId, context.requestId, receipt) : receipt;
    }
    let filename;
    try {
      const result = this._tx(() => { filename = this._stage(context.workspaceId, context.requestId, hash, draft); return this._submit(draft, context, hash); });
      this._unstage(filename);
      if (result.results.some(x => x.operation === 'DELETE' && x.outcome === 'applied')) return this._finishCleanup(context.workspaceId, context.requestId, result);
      return result;
    } catch (error) { if (filename) this._unstage(filename); if (error instanceof MemoryError) return this._rejection(context, error); throw error; }
  }
  _rejection(context, error) { return { request_id: context.requestId, workspace_id: context.workspaceId, status: 'rejected', results: [], errors: [{ code: error.code || 'INVALID_PROPOSAL', message: error.message, ...(error.operationKey ? { operation_key: error.operationKey } : {}) }] }; }
  _submit(draft, context, hash) {
    const { workspaceId, requestId, channel } = context;
    const existing = this._get('SELECT hash,receipt FROM receipts WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
    if (existing) return existing.hash === hash ? parse(existing.receipt) : this._rejection(context, new MemoryError('IDEMPOTENCY_CONFLICT', 'Request identity has different content'));
    this.db.exec('SAVEPOINT memory_change');
    let receipt;
    try {
      this._workspace(workspaceId, channel !== 'MEMORY_UI');
      requireValue(!this._get('SELECT 1 FROM revoked_requests WHERE workspace_id=? AND request_id=?', workspaceId, requestId), 'REQUEST_REVOKED', 'This staged request was invalidated by a user deletion');
      if (context.jobLease) {
        const job = this._assertLease(context.jobLease, workspaceId);
        this._validateJobSources(job, draft);
      }
      if (channel === 'DREAMING' && draft.operations.length) {
        requireValue(context.jobLease, 'REVIEW_UNAVAILABLE', 'Dreaming changes require a tracked job and review artifact');
        requireValue(this._get("SELECT 1 FROM job_artifacts WHERE job_id=? AND stage='review'", context.jobLease.id), 'REVIEW_UNAVAILABLE', 'One independent Reviewer result is required before Dreaming submission');
      }
      const locals = new Map(draft.operations.filter(x => x.op === 'CREATE').map(x => [x.local_key, id('M')]));
      // observed_version describes the actual read before this transaction.
      // Validate once before mutations, then link Issues to committed versions.
      for (const issue of draft.issues) for (const affected of issue.affected) {
        const row = this._get('SELECT version FROM memories WHERE workspace_id=? AND id=?', workspaceId, affected.memory_id);
        requireValue(row && version(row.version) === affected.observed_version, 'VERSION_CONFLICT', 'Issue refers to a stale or unavailable observed memory version');
        requireValue(!draft.operations.some(op => op.op === 'DELETE' && op.target_id === affected.memory_id), 'INVALID_PROPOSAL', 'An Issue cannot refer to a memory deleted by the same change set');
      }
      const results = [], changes = [];
      for (const op of draft.operations) {
        const memoryId = op.op === 'CREATE' ? locals.get(op.local_key) : op.target_id;
        const old = op.op === 'CREATE' ? null : this._get('SELECT * FROM memories WHERE workspace_id=? AND id=?', workspaceId, memoryId);
        if (op.op !== 'CREATE') {
          requireValue(old, 'NOT_FOUND', 'Target memory is not available in this workspace');
          requireValue(version(old.version) === op.expected_version, 'VERSION_CONFLICT', `Memory ${memoryId} changed; reread and re-evaluate the entire proposal`);
        }
        if (op.op === 'UPDATE') requireValue(old.status === 'current', 'NONCURRENT', 'UPDATE cannot reactivate an inactive memory; use RESTORE');
        if (op.op === 'RESTORE') requireValue(old.status !== 'current', 'INVALID_PROPOSAL', 'RESTORE requires an archived or retracted memory');
        if (op.op === 'DELETE') {
          requireValue(['G1', 'MEMORY_UI'].includes(channel) && context.deleteAuthorization?.requestRef && context.deleteAuthorization.ids?.includes(memoryId), 'DELETE_NOT_AUTHORIZED', 'A bound user deletion request and exact target authorization are required');
          this._run('DELETE FROM memories WHERE workspace_id=? AND id=?', workspaceId, memoryId);
          this._run('INSERT OR REPLACE INTO tombstones VALUES (?,?,?,?)', workspaceId, memoryId, old.version + 1, this.clock());
          results.push({ operation_key: op.operation_key, operation: op.op, memory_id: memoryId, before_version: version(old.version), after_version: null, outcome: 'applied' });
          changes.push({ memory_id: memoryId, operation: 'DELETE' });
          continue;
        }
        const status = op.op === 'ARCHIVE' ? 'archived' : op.op === 'RETRACT' ? 'retracted' : 'current';
        const content = op.content ?? parse(old.content), sourceMap = new Map((old ? parse(old.source_refs) : []).map(source => [sourceKey(source), source]));
        const removed = new Set();
        for (const removal of op.remove_source_refs || []) {
          const key = sourceKey(removal.source_ref);
          requireValue(sourceMap.has(key) && !removed.has(key), 'SOURCE_REMOVAL_CONFLICT', 'Explicit source removal must identify one existing source at the observed version');
          requireValue(!op.source_refs.some(source => sourceKey(source) === key), 'SOURCE_REMOVAL_CONFLICT', 'A source cannot be removed and supplied as new change evidence');
          removed.add(key); sourceMap.delete(key);
        }
        for (const source of op.source_refs) sourceMap.set(sourceKey(source), source);
        const sources = [...sourceMap.values()];
        requireValue(sources.length <= 256, 'SOURCE_CAPACITY', 'Accumulated provenance exceeds 256 sources; explicitly reconcile sources instead of truncating');
        const replacements = (op.replacement_refs || []).map(ref => locals.get(ref.replace(/^local:/, '')) ?? ref);
        for (const replacement of replacements) requireValue(replacement !== memoryId && (Array.from(locals.values()).includes(replacement) || this._get('SELECT 1 FROM memories WHERE workspace_id=? AND id=?', workspaceId, replacement)), 'INVALID_PROPOSAL', 'Replacement reference does not resolve in this workspace');
        const unchanged = old && old.status === status && old.content === stable(content) && old.source_refs === stable(sources) && old.replacements === stable(replacements) && (['UPDATE', 'RESTORE'].includes(op.op) || old.reason === op.reason);
        const v = old ? old.version + Number(!unchanged) : 1;
        if (!unchanged) {
          this._run(`INSERT INTO memories VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(workspace_id,id) DO UPDATE SET version=excluded.version,status=excluded.status,content=excluded.content,source_refs=excluded.source_refs,reason=excluded.reason,replacements=excluded.replacements,title=excluded.title,category=excluded.category,group_name=excluded.group_name,index_hint=excluded.index_hint,updated_at=excluded.updated_at`, workspaceId, memoryId, v, status, stable(content), stable(sources), op.reason, stable(replacements), content.title, content.category, content.group, content.index_hint, old?.created_at ?? this.clock(), this.clock());
          this._run('INSERT INTO memory_provenance VALUES (?,?,?,?) ON CONFLICT(workspace_id,memory_id) DO UPDATE SET version=excluded.version,change_source_refs=excluded.change_source_refs', workspaceId, memoryId, v, stable(op.source_refs));
          changes.push({ memory_id: memoryId, operation: op.op, before: old ? this._record(old) : null, after: this._record(this._get('SELECT * FROM memories WHERE workspace_id=? AND id=?', workspaceId, memoryId)), change_source_refs: op.source_refs, ...(op.remove_source_refs?.length ? { removed_source_refs: op.remove_source_refs } : {}) });
        }
        results.push({ operation_key: op.operation_key, operation: op.op, memory_id: memoryId, before_version: old ? version(old.version) : null, after_version: version(v), outcome: unchanged ? 'unchanged' : 'applied', ...(replacements.length ? { replacement_refs: replacements } : {}) });
      }
      const issueIds = this._insertIssues(workspaceId, requestId, draft.issues.map(issue => ({ ...issue, affected: issue.affected.map(ref => ({ ...ref, observed_version: version(this._get('SELECT version FROM memories WHERE workspace_id=? AND id=?', workspaceId, ref.memory_id).version) })) })));
      const changed = changes.length > 0 || issueIds.length > 0;
      const deleted = results.filter(x => x.operation === 'DELETE').map(x => x.memory_id);
      if (deleted.length) this._scrubDeleted(workspaceId, deleted, requestId, context.externalCleanupRequired === true);
      if (changed) this._bump(workspaceId);
      receipt = { request_id: requestId, workspace_id: workspaceId, workspace_revision: revision(this._workspace(workspaceId, false).revision), status: changed ? 'committed' : 'no_change', results, errors: [], ...(issueIds.length ? { issue_ids: issueIds } : {}), ...(deleted.length ? { cleanup_status: 'pending', scope_statement: CLEANUP_SCOPE } : {}) };
      this._event(workspaceId, channel, 'record.receipt', { requestId, jobId: context.jobLease?.id ?? null, changed: changes.length > 0, metadata: receipt, detail: changes.length && !deleted.length ? { changes } : null });
      this.db.exec('RELEASE memory_change');
    } catch (error) {
      this.db.exec('ROLLBACK TO memory_change; RELEASE memory_change');
      if (!(error instanceof MemoryError)) throw error;
      receipt = this._rejection(context, error);
      this._event(workspaceId, channel, 'record.rejected', { requestId, metadata: receipt });
    }
    this._run('INSERT INTO receipts VALUES (?,?,?,?,?)', workspaceId, requestId, hash, stable(receipt), this.clock());
    return receipt;
  }
  _insertIssues(workspaceId, requestId, proposals) {
    const ids = [];
    for (const proposal of proposals) {
      for (const affected of proposal.affected) {
        const row = this._get('SELECT version FROM memories WHERE workspace_id=? AND id=?', workspaceId, affected.memory_id);
        requireValue(row && version(row.version) === affected.observed_version, 'VERSION_CONFLICT', 'Issue refers to a stale or unavailable memory version');
      }
      const issueId = id('I');
      this._run('INSERT INTO issues(workspace_id,id,status,proposal,request_id,issue_key,created_at) VALUES (?,?,?,?,?,?,?)', workspaceId, issueId, 'open', stable(proposal), requestId, proposal.issue_key, this.clock());
      for (const affected of proposal.affected) this._run('INSERT INTO issue_memories VALUES (?,?,?)', workspaceId, issueId, affected.memory_id);
      ids.push(issueId);
    }
    return ids;
  }
  _validateJobSources(job, draft) {
    const payload = parse(job.payload);
    if (payload.evidencePolicy !== 1) return; // Previously queued jobs retain their documented legacy scope.
    const sources = draft.operations.flatMap(op => [...op.source_refs, ...(op.content?.payload?.references || [])]).concat(draft.issues.flatMap(issue => issue.source_refs));
    for (const source of sources) {
      const sessionRef = sessionReference(source.locator);
      if (source.source_kind === 'session_event' || sessionRef) {
        requireValue(source.source_kind === 'session_event' && sessionRef, 'SOURCE_SCOPE_MISMATCH', 'Use a supported session#event:N or session#events:N-M reference; unrecognized aliases cannot bypass evidence scope');
        const selected = (payload.evidenceRanges || []).find(range => range.sessionId === sessionRef.sessionId);
        requireValue(selected && insideEvidence(selected.contextRanges || selected.allowedRanges || [], sessionRef.start, sessionRef.end), 'SOURCE_SCOPE_MISMATCH', 'Session source is outside the frozen authorized evidence intervals');
      } else if (source.source_kind === 'memory_record') {
        const memory = this._get('SELECT version FROM memories WHERE workspace_id=? AND id=?', job.workspace_id, source.locator);
        requireValue(memory, 'SOURCE_SCOPE_MISMATCH', 'Memory source is unavailable in this workspace');
        if (/^v\d+$/.test(source.version_hint || '')) requireValue(source.version_hint === version(memory.version), 'VERSION_CONFLICT', 'Referenced memory changed; reread its current evidence');
      } else if (source.source_kind === 'project_file') {
        const locator = source.locator.split('#')[0], root = path.resolve(payload.currentRoot || this._workspace(job.workspace_id).root);
        let target; try { target = realpathSync.native(path.resolve(root, locator)); } catch { throw new MemoryError('SOURCE_SCOPE_MISMATCH', 'Project source does not identify an available project file'); }
        const blockedRoots = [this.dataDir, ...(payload.sourceBlockedRoots || [])].map(root => { try { return realpathSync.native(root); } catch { return path.resolve(root); } });
        const forbidden = target.split(path.sep).some(part => ['.dsh', 'dsh-home', '.credentials.yaml', '.credentials.yml'].includes(part.toLowerCase())) || blockedRoots.some(root => target === root || target.startsWith(root + path.sep));
        requireValue(!forbidden && statSync(target).isFile() && target.startsWith(realpathSync.native(root) + path.sep) && !/session[^\s]*(?:event|events)[:/#]/i.test(source.locator), 'SOURCE_SCOPE_MISMATCH', 'Project source must be an ordinary project path, not a disguised session reference');
      } else throw new MemoryError('SOURCE_SCOPE_MISMATCH', 'Background changes require authorized session events, existing project memory, or project-file evidence');
    }
  }
  listIssues({ workspaceId, status = 'open' }) { this._workspace(workspaceId, false); return this._all('SELECT * FROM issues WHERE workspace_id=? AND status=? ORDER BY created_at', workspaceId, status).map(x => ({ ...x, version: version(x.version), proposal: parse(x.proposal) })); }
  resolveIssue({ workspaceId, issueId, expectedVersion, requestId, context, draft, resolution }) {
    requireValue((draft != null) !== (resolution != null), 'INVALID_PROPOSAL', 'Supply exactly one of draft or resolution');
    const trusted = { ...context, workspaceId, requestId, channel: 'MEMORY_UI' }; this._context(trusted);
    text(issueId, 'issueId'); text(expectedVersion, 'expectedVersion');
    if (draft) {
      validateDraft(draft);
      // Clearing removes related Issues and their evidence copies. It must use
      // the dedicated submit/cleanup path, never recreate resolution details
      // or claim an Issue was resolved after that Issue has been deleted.
      requireValue(!draft.operations.some(operation => operation.op === 'DELETE'), 'DELETE_NOT_AUTHORIZED', 'Permanent deletion must use the dedicated memory clearing flow, not issue resolution');
    }
    else {
      requireValue(resolution && typeof resolution === 'object' && !Array.isArray(resolution) && Object.keys(resolution).every(key => ['reason', 'source_refs', 'expected_memories'].includes(key)), 'INVALID_PROPOSAL', 'Invalid current-memory resolution');
      text(resolution.reason, 'resolution.reason'); validateSources(resolution.source_refs);
      requireValue(Array.isArray(resolution.expected_memories) && resolution.expected_memories.length <= 100, 'INVALID_PROPOSAL', 'Resolution must list at most 100 affected memory versions');
      for (const item of resolution.expected_memories) {
        requireValue(item && typeof item === 'object' && !Array.isArray(item) && Object.keys(item).every(key => ['memory_id', 'expected_version'].includes(key)), 'INVALID_PROPOSAL', 'Invalid expected memory version');
        text(item.memory_id, 'memory_id'); text(item.expected_version, 'expected_version');
      }
      requireValue(new Set(resolution.expected_memories.map(item => item.memory_id)).size === resolution.expected_memories.length, 'INVALID_PROPOSAL', 'Duplicate expected memory');
      requireValue(Buffer.byteLength(stable(resolution)) <= 65536, 'INVALID_PROPOSAL', 'Resolution exceeds 64 KiB');
    }
    const hash = digest({ operation: 'resolveIssue', issueId, expectedVersion, draft: draft ?? null, resolution: resolution ?? null, channel: trusted.channel });
    return this._tx(() => {
      this._workspace(workspaceId, false);
      requireValue(!this._get('SELECT 1 FROM revoked_requests WHERE workspace_id=? AND request_id=?', workspaceId, requestId), 'REQUEST_REVOKED', 'This request was invalidated by a user deletion');
      // Replay before checking the now-resolved Issue, but bind the receipt to
      // this exact Issue and proposal so another Issue cannot reuse its write.
      const existing = this._get('SELECT hash,receipt FROM receipts WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      if (existing) return existing.hash === hash ? parse(existing.receipt) : this._rejection(trusted, new MemoryError('IDEMPOTENCY_CONFLICT', 'Request identity has different resolution content'));
      const issue = this._get('SELECT * FROM issues WHERE workspace_id=? AND id=?', workspaceId, issueId);
      requireValue(issue && issue.status === 'open' && version(issue.version) === expectedVersion, 'VERSION_CONFLICT', 'Issue has changed or is no longer open');
      const affectedMemories = parse(issue.proposal).affected;
      if (resolution) {
        const affectedIds = new Set(affectedMemories.map(item => item.memory_id));
        requireValue(resolution.expected_memories.length === affectedIds.size && resolution.expected_memories.every(item => affectedIds.has(item.memory_id)), 'VERSION_CONFLICT', 'Resolution must explicitly address exactly the current affected memories');
      }
      for (const affected of affectedMemories) {
        const current = this._get('SELECT version FROM memories WHERE workspace_id=? AND id=?', workspaceId, affected.memory_id);
        const expected = resolution ? resolution.expected_memories.find(item => item.memory_id === affected.memory_id) : draft.operations.find(item => item.target_id === affected.memory_id);
        requireValue(current && expected?.expected_version === version(current.version), 'VERSION_CONFLICT', 'Resolution must explicitly address current affected memories');
      }
      let receipt = draft ? this._submit(draft, trusted, hash) : { request_id: requestId, workspace_id: workspaceId, status: 'no_change', results: [], errors: [] };
      if (['committed', 'no_change'].includes(receipt.status)) {
        this._run("UPDATE issues SET status='resolved',version=version+1,resolved_at=? WHERE workspace_id=? AND id=?", this.clock(), workspaceId, issueId);
        this._bump(workspaceId);
        receipt = { ...receipt, memory_status: receipt.status, status: 'committed', workspace_revision: revision(this._workspace(workspaceId, false).revision), issue: { id: issueId, status: 'resolved', version: version(issue.version + 1) }, resolution: resolution ? 'confirmed_current' : 'applied_draft' };
        this._run('INSERT INTO receipts VALUES (?,?,?,?,?) ON CONFLICT(workspace_id,request_id) DO UPDATE SET receipt=excluded.receipt', workspaceId, requestId, hash, stable(receipt), this.clock());
        this._event(workspaceId, 'MEMORY_UI', 'issue.resolved', { requestId, metadata: { issue_id: issueId, issue_version: receipt.issue.version, resolution: receipt.resolution }, detail: { resolution: { reason: resolution?.reason ?? draft.explanation, source_refs: resolution?.source_refs ?? draft.operations.flatMap(op => op.source_refs), ...(resolution ? { expected_memories: resolution.expected_memories } : {}) } } });
      }
      return receipt;
    });
  }
  _scrubDeleted(workspaceId, deleted, requestId, externalCleanupRequired) {
    this._run('UPDATE workspaces SET epoch=epoch+1 WHERE id=?', workspaceId);
    const epoch = this._workspace(workspaceId, false).epoch;
    this._run('INSERT INTO cleanup_requests(workspace_id,request_id,epoch,external_pending) VALUES (?,?,?,?)', workspaceId, requestId, epoch, Number(externalCleanupRequired));
    const stagedDir = path.join(this.dataDir, 'staging', digest(workspaceId));
    if (existsSync(stagedDir)) for (const file of readdirSync(stagedDir)) if (file.endsWith('.json')) {
      try { const staged = parse(readFileSync(path.join(stagedDir, file), 'utf8')); if (typeof staged.requestId === 'string' && (staged.workspaceEpoch ?? -1) < epoch) this._run('INSERT OR IGNORE INTO revoked_requests VALUES (?,?)', workspaceId, staged.requestId); } catch { /* unreadable pending file is reported by cleanup */ }
    }
    this._run('DELETE FROM index_cache WHERE workspace_id=?', workspaceId);
    this._run('DELETE FROM overview_views WHERE workspace_id=?', workspaceId);
    this._run('UPDATE activity SET detail=NULL WHERE workspace_id=?', workspaceId);
    for (const memoryId of deleted) {
      const issues = this._all('SELECT issue_id FROM issue_memories WHERE workspace_id=? AND memory_id=?', workspaceId, memoryId);
      for (const issue of issues) { this._run('DELETE FROM issue_memories WHERE workspace_id=? AND issue_id=?', workspaceId, issue.issue_id); this._run('DELETE FROM issues WHERE workspace_id=? AND id=?', workspaceId, issue.issue_id); }
    }
    this._clearRuntimeContent(workspaceId);
  }
  _clearRuntimeContent(workspaceId) {
    this._run("UPDATE role_sessions SET cleanup_pending=1 WHERE workspace_id=? AND state<>'deleted'", workspaceId);
    for (const b of this._all('SELECT * FROM bundles WHERE workspace_id=?', workspaceId)) {
      const old = parse(b.bundle); const invalidated = { state: 'unavailable', bundle_id: old.bundle_id, workspace_id: workspaceId, session_id: b.session_id, turn_id: b.turn_id, error: { code: 'MEMORY_CONTENT_CLEARED', message: 'Stored turn memory was cleared by a user deletion request; resynchronize next turn.' } };
      this._run('UPDATE bundles SET bundle=?,observations=? WHERE workspace_id=? AND session_id=? AND turn_id=?', stable(invalidated), '[]', workspaceId, b.session_id, b.turn_id);
    }
    this._run('DELETE FROM job_artifacts WHERE job_id IN (SELECT id FROM jobs WHERE workspace_id=?)', workspaceId);
    this._run("UPDATE jobs SET snapshot=NULL,payload='{}',result=NULL,error=NULL,status=CASE WHEN status IN ('queued','running','paused') THEN 'cancelled' ELSE status END,token=token+1,owner=NULL,lease_until=NULL WHERE workspace_id=?", workspaceId);
  }
  scrubRuntimeCopies(workspaceId, { requestId } = {}) {
    return this._tx(() => {
      this._workspace(workspaceId, false);
      const previous = requestId && this._get('SELECT * FROM runtime_cleanups WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      if (previous?.complete) return { workspace_id: workspaceId, epoch: previous.epoch, cleanup_status: 'complete', local_cleanup_status: 'complete' };
      if (!previous) {
        this._run('UPDATE workspaces SET epoch=epoch+1 WHERE id=?', workspaceId);
        this._clearRuntimeContent(workspaceId);
        this._run('UPDATE activity SET detail=NULL WHERE workspace_id=?', workspaceId);
      }
      const epoch = previous?.epoch ?? this._workspace(workspaceId, false).epoch;
      if (requestId && !previous) this._run('INSERT INTO runtime_cleanups VALUES (?,?,?,0)', workspaceId, requestId, epoch);
      const dir = path.join(this.dataDir, 'staging', digest(workspaceId)); let complete = true;
      try { if (existsSync(dir)) for (const file of readdirSync(dir)) if (file.endsWith('.json')) {
        const filename = path.join(dir, file), staged = parse(readFileSync(filename, 'utf8'));
        if ((staged.workspaceEpoch ?? -1) >= epoch) continue;
        if (typeof staged.requestId === 'string') this._run('INSERT OR IGNORE INTO revoked_requests VALUES (?,?)', workspaceId, staged.requestId);
        complete = this._unstage(filename) && complete;
      } } catch { complete = false; }
      const localComplete = complete;
      complete = complete && !this._get("SELECT 1 FROM role_sessions WHERE workspace_id=? AND epoch<? AND state<>'deleted' LIMIT 1", workspaceId, epoch);
      this._event(workspaceId, 'SYSTEM', 'runtime.cleanup', { metadata: { epoch, cleanup_status: complete ? 'complete' : 'incomplete' } });
      return { workspace_id: workspaceId, epoch, cleanup_status: complete ? 'complete' : 'incomplete', local_cleanup_status: localComplete ? 'complete' : 'incomplete' };
    });
  }
  completeRuntimeCleanup({ workspaceId, requestId }) {
    return this._tx(() => {
      const row = this._get('SELECT * FROM runtime_cleanups WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      requireValue(row, 'NOT_FOUND', 'Runtime cleanup request not found');
      requireValue(!this._get("SELECT 1 FROM role_sessions WHERE workspace_id=? AND epoch<? AND state<>'deleted' LIMIT 1", workspaceId, row.epoch), 'CLEANUP_INCOMPLETE', 'Generated role sessions are still pending cleanup');
      this._run('UPDATE runtime_cleanups SET complete=1 WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      return { workspace_id: workspaceId, epoch: row.epoch, cleanup_status: 'complete' };
    });
  }
  _finishCleanup(workspaceId, requestId, receipt) {
    const next = this._tx(() => {
      // Staging writers use the same writer transaction, so cleanup cannot unlink an in-flight new write.
      const dir = path.join(this.dataDir, 'staging', digest(workspaceId)); let complete = true;
      const cleanup = this._get('SELECT epoch,external_pending FROM cleanup_requests WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      try { if (existsSync(dir)) for (const file of readdirSync(dir)) if (file.endsWith('.json')) {
        const filename = path.join(dir, file);
        const staged = parse(readFileSync(filename, 'utf8'));
        if ((staged.workspaceEpoch ?? -1) < (cleanup?.epoch ?? -1)) complete = this._unstage(filename) && complete;
      } } catch { complete = false; }
      complete = complete && !cleanup?.external_pending && !this._get("SELECT 1 FROM role_sessions WHERE workspace_id=? AND epoch<? AND state<>'deleted' LIMIT 1", workspaceId, cleanup?.epoch ?? -1);
      const result = { ...receipt, cleanup_status: complete ? 'complete' : 'incomplete', errors: complete ? [] : [{ code: 'CLEANUP_INCOMPLETE', message: 'Formal deletion committed; staged content, generated role sessions or host cache cleanup is still pending' }] };
      this._run('UPDATE receipts SET receipt=? WHERE workspace_id=? AND request_id=?', stable(result), workspaceId, requestId);
      this._event(workspaceId, 'MEMORY_UI', 'cleanup.status', { requestId, metadata: { cleanup_status: result.cleanup_status, scope_statement: CLEANUP_SCOPE } }); return result;
    });
    // Logical deletion is guaranteed; WAL checkpoint is best effort, not a forensic erasure claim.
    try { this.db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch {}
    return next;
  }
  recoverCleanup() {
    const pending = this._all('SELECT r.workspace_id,r.request_id,r.receipt FROM receipts r JOIN cleanup_requests c ON r.workspace_id=c.workspace_id AND r.request_id=c.request_id');
    return pending.map(row => ({ ...row, parsed: parse(row.receipt) })).filter(row => ['pending', 'incomplete'].includes(row.parsed.cleanup_status)).map(row => this._finishCleanup(row.workspace_id, row.request_id, row.parsed));
  }
  pendingCleanups() {
    return this._all('SELECT c.*,r.receipt FROM cleanup_requests c JOIN receipts r ON c.workspace_id=r.workspace_id AND c.request_id=r.request_id').map(row => ({ ...row, receipt: parse(row.receipt) })).filter(row => ['pending', 'incomplete'].includes(row.receipt.cleanup_status));
  }
  completeExternalCleanup({ workspaceId, requestId }) {
    const receipt = this._tx(() => {
      const pending = this._get('SELECT * FROM cleanup_requests WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      requireValue(pending, 'NOT_FOUND', 'Cleanup request not found');
      this._run('UPDATE cleanup_requests SET external_pending=0 WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      return parse(this._get('SELECT receipt FROM receipts WHERE workspace_id=? AND request_id=?', workspaceId, requestId).receipt);
    });
    return this._finishCleanup(workspaceId, requestId, receipt);
  }
  listActivity({ workspaceId, channel = 'DREAMING', limit = 100 }) {
    this._workspace(workspaceId, false); const n = Math.max(1, Math.min(1000, Number(limit) || 100));
    const rows = channel === 'ALL' ? this._all('SELECT * FROM activity WHERE workspace_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?', workspaceId, n) : this._all('SELECT * FROM activity WHERE workspace_id=? AND channel=? AND changed=1 ORDER BY created_at DESC,rowid DESC LIMIT ?', workspaceId, channel, n);
    return rows.map(x => ({ ...x, metadata: parse(x.metadata), detail: parse(x.detail) }));
  }
  exportSnapshot(workspaceId) {
    return this._tx(() => { const ws = this._workspace(workspaceId, false); return { schema_version: 1, workspace_id: workspaceId, workspace_revision: revision(ws.revision), exported_at: nowIso(this.clock()), records: this._all('SELECT * FROM memories WHERE workspace_id=? ORDER BY id', workspaceId).map(x => this._record(x)), issues: this.listIssues({ workspaceId }) }; });
  }
  pruneAudit() {
    this.recoverCleanup();
    const cutoff = this.clock() - this.retentionDays * DAY;
    return this._tx(() => {
      const roleSessions = this._run("UPDATE role_sessions SET cleanup_pending=1 WHERE state<>'deleted' AND job_id IN (SELECT id FROM jobs WHERE status IN ('completed','failed','cancelled') AND COALESCE(finished_at,created_at)<?)", cutoff).changes;
      const activity = this._run('UPDATE activity SET detail=NULL WHERE created_at<? AND detail IS NOT NULL', cutoff).changes;
      const artifacts = this._run("DELETE FROM job_artifacts WHERE job_id IN (SELECT id FROM jobs WHERE status IN ('completed','failed','cancelled') AND finished_at<?)", cutoff).changes;
      this._run("DELETE FROM job_deferrals WHERE job_id IN (SELECT id FROM jobs WHERE status IN ('completed','failed','cancelled'))");
      this._run("UPDATE jobs SET snapshot=NULL,payload='{}' WHERE status IN ('completed','failed','cancelled') AND finished_at<?", cutoff);
      for (const row of this._all('SELECT * FROM bundles WHERE created_at<?', cutoff)) {
        const old = parse(row.bundle);
        if (old.state !== 'ready') continue;
        const expired = { state: 'unavailable', bundle_id: old.bundle_id, workspace_id: row.workspace_id, session_id: row.session_id, turn_id: row.turn_id, error: { code: 'CONTEXT_EXPIRED', message: 'The stored historical turn bundle exceeded retention; resynchronize on a new turn.' } };
        this._run('UPDATE bundles SET bundle=?,observations=? WHERE workspace_id=? AND session_id=? AND turn_id=?', stable(expired), '[]', row.workspace_id, row.session_id, row.turn_id);
      }
      return { activity_details_removed: Number(activity), job_artifacts_removed: Number(artifacts), role_sessions_pending: Number(roleSessions) };
    });
  }
  enqueueJob({ workspaceId, kind, requestId, sessionId = null, endSeq = null, snapshot = null, payload = {}, manual = false }) {
    text(requestId, 'requestId');
    requireValue(['G2', 'DREAMING', 'BACKFILL'].includes(kind), 'INVALID_PROPOSAL', 'Invalid job kind');
    const input = { kind, sessionId, endSeq, snapshot, payload, manual };
    requireValue(Buffer.byteLength(stable(input)) <= 16 * 1024 * 1024, 'TASK_NOT_ACCEPTED', 'Job snapshot exceeds 16 MiB durable task budget');
    if (kind === 'G2') requireValue(snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length && sessionId && safeSeq(endSeq), 'TASK_NOT_ACCEPTED', 'G2 requires a frozen context snapshot, session and trusted upper boundary');
    return this._tx(() => {
      const ws = this._workspace(workspaceId);
      const hash = digest(input), existing = this._get('SELECT * FROM jobs WHERE workspace_id=? AND request_id=?', workspaceId, requestId);
      if (existing) { requireValue(existing.request_hash === hash, 'IDEMPOTENCY_CONFLICT', 'Job request identity has different input'); return this._jobReceipt(existing); }
      let startSeq = null;
      if (kind === 'G2') {
        const session = this._session(workspaceId, sessionId);
        requireValue(endSeq <= session.head_seq && endSeq > session.managed_start, 'TASK_NOT_ACCEPTED', 'G2 range is not inside the managed session prefix');
        startSeq = session.g2_cursor;
      }
      if (['DREAMING', 'BACKFILL'].includes(kind)) {
        const existingDream = this._get("SELECT * FROM jobs WHERE workspace_id=? AND kind IN ('DREAMING','BACKFILL') AND status IN ('queued','running','paused') ORDER BY created_at LIMIT 1", workspaceId);
        if (existingDream) return this._jobReceipt(existingDream);
        if (!manual) {
          requireValue(ws.dirty_seq > ws.dream_processed_seq, 'NO_NEW_EVIDENCE', 'No new managed evidence needs Dreaming');
          requireValue(this.clock() - (ws.last_dream_started ?? ws.created_at) >= this.dreamIntervalMs, 'DREAM_INTERVAL', 'Automatic Dreamer minimum interval has not elapsed');
        }
      }
      if (payload.evidencePolicy !== undefined) {
        requireValue(payload.evidencePolicy === 1 && Array.isArray(payload.evidenceRanges), 'INVALID_PROPOSAL', 'Unsupported evidence admission policy');
        const seen = new Set();
        for (const selected of payload.evidenceRanges) {
          requireValue(selected && typeof selected.sessionId === 'string' && !seen.has(selected.sessionId), 'INVALID_PROPOSAL', 'Evidence sessions must be unique'); seen.add(selected.sessionId);
          const session = this._session(workspaceId, selected.sessionId);
          requireValue(safeSeq(selected.startExclusive) && safeSeq(selected.endInclusive) && selected.startExclusive >= session.managed_start && selected.endInclusive <= session.head_seq && selected.endInclusive >= selected.startExclusive, 'INVALID_PROPOSAL', 'Invalid frozen evidence window');
          requireValue(Array.isArray(selected.allowedRanges) && Array.isArray(selected.contextRanges), 'INVALID_PROPOSAL', 'Frozen audit/context intervals are required');
          const eligible = this.allowedEvidenceRanges({ workspaceId, sessionId: selected.sessionId, endInclusive: selected.endInclusive });
          for (const range of [...selected.allowedRanges, ...selected.contextRanges]) requireValue(safeSeq(range.startExclusive) && safeSeq(range.endInclusive) && range.endInclusive > range.startExclusive && range.endInclusive <= selected.endInclusive && insideEvidence(eligible, range.startExclusive + 1, range.endInclusive), 'SOURCE_SCOPE_MISMATCH', 'Frozen evidence interval includes unselected or disabled content');
          for (const range of selected.allowedRanges) requireValue(range.startExclusive >= selected.startExclusive, 'SOURCE_SCOPE_MISMATCH', 'Audit interval begins before the frozen audit window');
          if (kind === 'G2') requireValue(selected.sessionId === sessionId && selected.endInclusive === endSeq, 'SOURCE_SCOPE_MISMATCH', 'G2 evidence must match its bound session and snapshot cut');
        }
        if (kind === 'G2') requireValue(seen.size === 1, 'SOURCE_SCOPE_MISMATCH', 'G2 requires one bound evidence session');
      }
      const jobId = id('J');
      this._run('INSERT INTO jobs(id,workspace_id,kind,request_id,request_hash,session_id,end_seq,start_seq,status,epoch,snapshot,payload,manual,dirty_seq,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', jobId, workspaceId, kind, requestId, hash, sessionId, endSeq, startSeq, 'queued', ws.epoch, snapshot == null ? null : stable(snapshot), stable(payload), Number(!!manual), ws.dirty_seq, this.clock());
      this._event(workspaceId, kind, 'job.accepted', { requestId, jobId, metadata: { session_id: sessionId, start_exclusive: startSeq, end_inclusive: endSeq, snapshot_hash: snapshot == null ? null : digest(snapshot) } });
      return this._jobReceipt(this._get('SELECT * FROM jobs WHERE id=?', jobId));
    });
  }
  _jobReceipt(row) {
    const status = row.status === 'queued' || row.status === 'paused' ? 'accepted' : row.status;
    return { job_id: row.id, status, ...(row.session_id !== null ? { window: { session_id: row.session_id, start_exclusive: row.start_seq, end_inclusive: row.end_seq } } : {}), ...(row.error ? { error: parse(row.error) } : {}), ...(row.result ? { result: parse(row.result) } : {}) };
  }
  _job(row) {
    if (!row) return null;
    const waiting = ['queued', 'running'].includes(row.status) ? this._get('SELECT * FROM job_deferrals WHERE job_id=? ORDER BY observed_at DESC,owner LIMIT 1', row.id) : null;
    return { ...row, snapshot: parse(row.snapshot), payload: parse(row.payload), result: parse(row.result), error: parse(row.error), ...(waiting ? { deferral: { ...parse(waiting.detail), hostId: waiting.owner, observedAt: waiting.observed_at } } : {}), manual: !!row.manual, lease: { id: row.id, owner: row.owner, token: row.token }, window: row.session_id !== null ? { session_id: row.session_id, start_exclusive: row.start_seq, end_inclusive: row.end_seq } : null };
  }
  getJob(jobId) { return this._job(this._get('SELECT * FROM jobs WHERE id=?', jobId)); }
  planRoleSession({ lease, sessionId, role, storage, ownerPid = process.pid }) {
    requireValue(/^automemory-(g2|dreamer|reviewer|manager)-[A-Za-z0-9_-]{1,128}$/.test(sessionId), 'INVALID_ROLE_SESSION', 'Only plugin generated role sessions can be registered');
    requireValue(Number.isSafeInteger(ownerPid) && ownerPid > 0, 'INVALID_ROLE_SESSION', 'A live role owner PID is required');
    requireValue(storage && typeof storage.name === 'string' && typeof storage.root === 'string' && path.isAbsolute(storage.root), 'ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Durable role storage identity is required before creating a role');
    return this._tx(() => {
      const job = this._assertLease(lease);
      requireValue(!this._get('SELECT 1 FROM runtime_cleanups WHERE workspace_id=? AND complete=0', job.workspace_id), 'CLEANUP_INCOMPLETE', 'Runtime cleanup is pending');
      const old = this._get('SELECT * FROM role_sessions WHERE session_id=?', sessionId);
      requireValue(!old || old.job_id === job.id && old.owner === lease.owner && old.epoch === job.epoch && old.state === 'planned' && old.storage === stable(storage), 'INVALID_ROLE_SESSION', 'Role session identity cannot be reused');
      this._run('INSERT OR IGNORE INTO role_sessions(session_id,workspace_id,job_id,role,epoch,owner,owner_pid,state,created_at,storage) VALUES (?,?,?,?,?,?,?,?,?,?)', sessionId, job.workspace_id, job.id, role, job.epoch, lease.owner, ownerPid, 'planned', this.clock(), stable(storage));
      return this._get('SELECT * FROM role_sessions WHERE session_id=?', sessionId);
    });
  }
  settleRoleSession({ sessionId, owner }) {
    return this._tx(() => {
      const row = this._get('SELECT * FROM role_sessions WHERE session_id=?', sessionId);
      requireValue(row && row.owner === owner, 'INVALID_ROLE_SESSION', 'Only the original owner may settle a role');
      this._run("UPDATE role_sessions SET state='settled',settled_at=? WHERE session_id=? AND state='planned'", this.clock(), sessionId);
      return this._get('SELECT * FROM role_sessions WHERE session_id=?', sessionId);
    });
  }
  listRoleSessions({ workspaceId, pendingOnly = false } = {}) {
    return this._all(`SELECT * FROM role_sessions WHERE 1=1${workspaceId ? ' AND workspace_id=?' : ''}${pendingOnly ? " AND cleanup_pending=1 AND state<>'deleted'" : ''} ORDER BY created_at,session_id`, ...(workspaceId ? [workspaceId] : [])).map(row => ({ ...row, storage: parse(row.storage) }));
  }
  markRoleSessionDeleted(sessionId) {
    return this._tx(() => {
      const row = this._get('SELECT * FROM role_sessions WHERE session_id=?', sessionId);
      requireValue(row && row.cleanup_pending === 1, 'INVALID_ROLE_SESSION', 'Role is not pending cleanup');
      this._run("UPDATE role_sessions SET state='deleted',cleanup_pending=0,deleted_at=?,cleanup_error=NULL WHERE session_id=?", this.clock(), sessionId);
    });
  }
  recordRoleCleanupFailure(sessionId, code) {
    this._run('UPDATE role_sessions SET cleanup_error=? WHERE session_id=? AND cleanup_pending=1', String(code || 'CLEANUP_INCOMPLETE').slice(0, 120), sessionId);
  }
  listJobs({ workspaceId, limit = 100 }) {
    this._workspace(workspaceId, false);
    return this._all('SELECT * FROM jobs WHERE workspace_id=? ORDER BY created_at DESC,rowid DESC LIMIT ?', workspaceId, Math.max(1, Math.min(1000, Number(limit) || 100))).map(row => {
      const x = this._job(row); delete x.snapshot; return x;
    });
  }
  listClaimCandidates() {
    return this._all("SELECT jobs.* FROM jobs JOIN workspaces w ON jobs.workspace_id=w.id WHERE w.enabled=1 AND (jobs.status='queued' OR (jobs.status='running' AND jobs.lease_until<=?)) ORDER BY jobs.created_at,jobs.rowid", this.clock()).map(row => this._job(row));
  }
  claimJob({ owner, leaseMs = 60000, workspaceId, automaticWorkspaceIds = null, kinds = ['G2', 'DREAMING', 'BACKFILL'], eligibility = null }) {
    text(owner, 'owner'); requireValue(Number.isFinite(leaseMs) && leaseMs > 0, 'INVALID_CONFIGURATION', 'Lease duration must be positive');
    requireValue(Array.isArray(kinds) && kinds.every(k => ['G2', 'DREAMING', 'BACKFILL'].includes(k)), 'INVALID_PROPOSAL', 'Invalid job kinds');
    requireValue(eligibility === null || typeof eligibility === 'function', 'INVALID_CONFIGURATION', 'Job eligibility must be a synchronous host capability check');
    return this._tx(() => {
      const now = this.clock();
      const candidates = this._all("SELECT jobs.*,jobs.rowid AS ordinal FROM jobs JOIN workspaces w ON jobs.workspace_id=w.id WHERE w.enabled=1 AND (jobs.status='queued' OR (jobs.status='running' AND jobs.lease_until<=?)) ORDER BY jobs.created_at,jobs.rowid", now);
      for (const row of candidates) {
        if ((workspaceId && row.workspace_id !== workspaceId) || !kinds.includes(row.kind)) continue;
        if (row.kind === 'DREAMING' && !row.manual && automaticWorkspaceIds && !automaticWorkspaceIds.has(row.workspace_id)) continue;
        if (this._get('SELECT 1 FROM runtime_cleanups WHERE workspace_id=? AND complete=0', row.workspace_id) || this._get('SELECT 1 FROM cleanup_requests WHERE workspace_id=? AND external_pending=1', row.workspace_id)) continue;
        const ws = this._workspace(row.workspace_id);
        if (row.kind === 'DREAMING' && !row.manual && !ws.automatic_dream) continue;
        if (this._get("SELECT 1 FROM role_sessions WHERE workspace_id=? AND epoch<? AND cleanup_pending=1 AND state<>'deleted'", row.workspace_id, ws.epoch)) continue;
        if (row.epoch !== ws.epoch) { this._run("UPDATE jobs SET status='cancelled',snapshot=NULL,payload='{}',finished_at=? WHERE id=?", now, row.id); continue; }
        if (eligibility) {
          // Host capabilities are checked under the same lock as ownership.
          // An incapable host must not consume a lease or Dreamer interval.
          const decision = eligibility(this._job(row));
          requireValue(decision && typeof decision.eligible === 'boolean', 'INVALID_CONFIGURATION', 'Job eligibility must synchronously return an eligible boolean');
          if (!decision.eligible) {
            const detail = { code: decision.code || 'MODEL_ROUTE_UNAVAILABLE', message: decision.message || 'Waiting for a host with the configured model route.', ...(decision.missingRoutes ? { missingRoutes: decision.missingRoutes } : {}) };
            requireValue(Buffer.byteLength(stable(detail)) <= 16384, 'INVALID_CONFIGURATION', 'Job deferral metadata exceeds its limit');
            this._run('INSERT INTO job_deferrals(job_id,owner,detail,observed_at) VALUES (?,?,?,?) ON CONFLICT(job_id,owner) DO UPDATE SET detail=excluded.detail,observed_at=excluded.observed_at', row.id, owner, stable(detail), now);
            continue;
          }
        }
        if (row.kind === 'G2') {
          const earlier = this._get("SELECT 1 FROM jobs WHERE workspace_id=? AND session_id=? AND kind='G2' AND rowid<? AND status IN ('queued','running','paused') LIMIT 1", row.workspace_id, row.session_id, row.ordinal);
          if (earlier) continue;
          const session = this._session(row.workspace_id, row.session_id);
          if (session.g2_cursor >= row.end_seq) {
            const result = { status: 'no_change', outcome: 'already_covered' };
            this._run("UPDATE jobs SET status='completed',result=?,finished_at=?,owner=NULL,lease_until=NULL WHERE id=?", stable(result), now, row.id); continue;
          }
          this._run('UPDATE jobs SET start_seq=? WHERE id=?', session.g2_cursor, row.id);
        }
        if (['DREAMING', 'BACKFILL'].includes(row.kind) && row.status !== 'running') {
          if (this._get("SELECT 1 FROM jobs WHERE workspace_id=? AND kind IN ('DREAMING','BACKFILL') AND id<>? AND status='running' AND lease_until>? LIMIT 1", row.workspace_id, row.id, now)) continue;
          if (this._get('SELECT 1 FROM presence WHERE workspace_id=? AND busy=1 AND expires_at>? LIMIT 1', row.workspace_id, now)) continue;
          if (this._get("SELECT 1 FROM jobs WHERE workspace_id=? AND kind='G2' AND status IN ('queued','running') LIMIT 1", row.workspace_id)) continue;
          if (!row.manual && row.started_at === null && (now - (ws.last_dream_started ?? ws.created_at) < this.dreamIntervalMs || ws.dirty_seq <= ws.dream_processed_seq)) continue;
          if (row.started_at === null) this._run('UPDATE workspaces SET last_dream_started=? WHERE id=?', now, row.workspace_id);
        }
        this._run('DELETE FROM job_deferrals WHERE job_id=?', row.id);
        this._run("UPDATE jobs SET status='running',owner=?,token=token+1,lease_until=?,started_at=COALESCE(started_at,?) WHERE id=?", owner, now + leaseMs, now, row.id);
        this._event(row.workspace_id, row.kind, 'job.claimed', { jobId: row.id, metadata: { owner, token: row.token + 1, recovered: row.status === 'running' } });
        return this.getJob(row.id);
      }
      return null;
    });
  }
  deferUndispatchedJob({ lease, stage, code, message, missingRoutes = [] }) {
    return this._tx(() => {
      const job = this._assertLease(lease);
      requireValue(['audit', 'candidate', 'review', 'final'].includes(stage), 'INVALID_PROPOSAL', 'A deferred model stage is required');
      const artifacts = this.getJobArtifacts(job.id), usage = artifacts[stage + '-usage'];
      requireValue(usage?.status === 'deferred' && Array.isArray(usage.requests) && usage.requests.length === 0 && Array.isArray(usage.usage) && usage.usage.length === 0 && !artifacts[stage + '-result'], 'MODEL_STAGE_INTERRUPTED', 'Only a proven undispatched stage may return to the queue');
      let attempt = 1;
      while (artifacts[`${stage}-deferred-${attempt}`]) attempt++;
      const saved = Object.fromEntries(['input-meta', 'session', 'usage'].flatMap(suffix => artifacts[`${stage}-${suffix}`] ? [[suffix, artifacts[`${stage}-${suffix}`]]] : []));
      this._run('INSERT INTO job_artifacts(job_id,stage,value,created_at) VALUES (?,?,?,?)', job.id, `${stage}-deferred-${attempt}`, stable(saved), this.clock());
      for (const suffix of ['input-meta', 'session', 'usage']) this._run('DELETE FROM job_artifacts WHERE job_id=? AND stage=?', job.id, `${stage}-${suffix}`);
      const detail = { code: code || 'HOST_MODEL_UNAVAILABLE', message: message || 'Waiting for a host with the configured model route.', missingRoutes };
      this._run('INSERT INTO job_deferrals(job_id,owner,detail,observed_at) VALUES (?,?,?,?) ON CONFLICT(job_id,owner) DO UPDATE SET detail=excluded.detail,observed_at=excluded.observed_at', job.id, lease.owner, stable(detail), this.clock());
      this._run("UPDATE jobs SET status='queued',owner=NULL,lease_until=NULL,error=NULL WHERE id=?", job.id);
      this._event(job.workspace_id, job.kind, 'job.deferred', { jobId: job.id, metadata: { stage, attempt, code: detail.code, model_requests: 0 } });
      return this.getJob(job.id);
    });
  }
  _assertLease(lease, workspaceId) {
    requireValue(lease && typeof lease.id === 'string', 'STALE_LEASE', 'Missing job lease');
    const row = this._get('SELECT * FROM jobs WHERE id=?', lease.id);
    requireValue(row && (!workspaceId || row.workspace_id === workspaceId) && row.status === 'running' && row.owner === lease.owner && row.token === lease.token && row.lease_until > this.clock(), 'STALE_LEASE', 'Job lease expired, was cancelled or belongs to another worker');
    const ws = this._workspace(row.workspace_id);
    requireValue(row.epoch === ws.epoch, 'STALE_LEASE', 'Workspace cleanup/disable invalidated the job');
    return row;
  }
  renewJob({ id: jobId, owner, token, leaseMs = 60000 }) {
    return this._tx(() => { this._assertLease({ id: jobId, owner, token }); this._run('UPDATE jobs SET lease_until=? WHERE id=?', this.clock() + leaseMs, jobId); return this.getJob(jobId); });
  }
  saveJobArtifact({ lease, stage, value }) {
    text(stage, 'stage'); requireValue(/^[a-z][a-z0-9_-]{0,63}$/.test(stage), 'INVALID_PROPOSAL', 'Invalid artifact stage');
    requireValue(Buffer.byteLength(stable(value)) <= 2 * 1024 * 1024, 'INVALID_PROPOSAL', 'Artifact exceeds 2 MiB');
    if (stage === 'review') requireValue(value && typeof value.candidate_id === 'string' && value.candidate_id.length > 0 && Array.isArray(value.findings) && Array.isArray(value.checked_sources) && Array.isArray(value.limitations), 'INVALID_PROPOSAL', 'Review artifact must contain an actual ReviewAdvice object');
    return this._tx(() => {
      this._assertLease(lease); const body = stable(value);
      const old = this._get('SELECT value FROM job_artifacts WHERE job_id=? AND stage=?', lease.id, stage);
      requireValue(!old || old.value === body, 'IDEMPOTENCY_CONFLICT', 'A saved stage is immutable; use a distinct stage for a different artifact');
      this._run('INSERT OR IGNORE INTO job_artifacts VALUES (?,?,?,?)', lease.id, stage, body, this.clock());
      return { job_id: lease.id, stage, hash: digest(body) };
    });
  }
  getJobArtifacts(jobId) { return Object.fromEntries(this._all('SELECT stage,value FROM job_artifacts WHERE job_id=?', jobId).map(row => [row.stage, parse(row.value)])); }
  completeJob({ lease, draft }) {
    validateDraft(draft);
    const before = this._get('SELECT * FROM jobs WHERE id=?', lease.id);
    requireValue(before, 'NOT_FOUND', 'Job not found');
    const context = { workspaceId: before.workspace_id, requestId: `job-result:${before.id}`, channel: before.kind === 'G2' ? 'G2' : 'DREAMING', sessionId: before.session_id, jobLease: lease };
    const hash = digest({ draft, channel: context.channel });
    if (before.status === 'completed' && before.token === lease.token && before.result) {
      const receipt = this._get('SELECT hash FROM receipts WHERE workspace_id=? AND request_id=?', context.workspaceId, context.requestId);
      requireValue(receipt?.hash === hash, 'IDEMPOTENCY_CONFLICT', 'Completed job result identity has different content');
      return parse(before.result);
    }
    let filename;
    try {
      return this._tx(() => {
        const row = this._assertLease(lease);
        filename = this._stage(context.workspaceId, context.requestId, hash, draft);
        if (draft.audit_completion !== 'complete') {
          const result = { status: 'failed', error: { code: 'AUDIT_PARTIAL', message: draft.explanation || 'Required audit evidence was incomplete' } };
          this._run("UPDATE jobs SET status='failed',error=?,result=?,owner=NULL,lease_until=NULL,finished_at=? WHERE id=?", stable(result.error), stable(result), this.clock(), row.id);
          this._event(row.workspace_id, row.kind, 'job.failed', { jobId: row.id, metadata: { code: 'AUDIT_PARTIAL' } }); return result;
        }
        if (row.kind === 'G2') {
          const session = this._session(row.workspace_id, row.session_id);
          requireValue(session.g2_cursor === row.start_seq, 'COVERAGE_CONFLICT', 'The audit coverage cursor changed; re-evaluate before committing');
        }
        const receipt = this._submit(draft, context, hash);
        const succeeded = ['committed', 'no_change'].includes(receipt.status);
        if (succeeded) {
          if (row.kind === 'G2') this._run('UPDATE sessions SET g2_cursor=? WHERE workspace_id=? AND id=?', row.end_seq, row.workspace_id, row.session_id);
          if (['DREAMING', 'BACKFILL'].includes(row.kind)) {
            for (const range of parse(row.payload).evidenceRanges || []) {
              const session = this._session(row.workspace_id, range.sessionId);
              requireValue(safeSeq(range.startExclusive) && safeSeq(range.endInclusive) && range.endInclusive <= session.head_seq, 'COVERAGE_CONFLICT', 'Dreamer range is outside the registered session');
              // A later history-scope expansion can create an earlier gap; do not jump over it.
              if (range.startExclusive <= session.dream_cursor) this._run('UPDATE sessions SET dream_cursor=MAX(dream_cursor,?) WHERE workspace_id=? AND id=?', range.endInclusive, row.workspace_id, range.sessionId);
            }
            this._run('UPDATE workspaces SET dream_processed_seq=MAX(dream_processed_seq,?) WHERE id=?', row.dirty_seq, row.workspace_id);
          }
          this._run("UPDATE jobs SET status='completed',result=?,owner=NULL,lease_until=NULL,finished_at=? WHERE id=?", stable(receipt), this.clock(), row.id);
          this._event(row.workspace_id, row.kind, 'coverage.completed', { jobId: row.id, requestId: context.requestId, metadata: { window: row.session_id === null ? null : { start_exclusive: row.start_seq, end_inclusive: row.end_seq }, issues_recorded: draft.issues.length > 0 } });
        } else {
          this._run("UPDATE jobs SET status='failed',result=?,error=?,owner=NULL,lease_until=NULL,finished_at=? WHERE id=?", stable(receipt), stable(receipt.errors[0] || { code: 'SUBMIT_FAILED', message: 'Submission failed' }), this.clock(), row.id);
        }
        return receipt;
      });
    } finally { if (filename) this._unstage(filename); }
  }
  failJob({ lease, code, message, retryable = false }) {
    text(code, 'code'); text(message, 'message');
    return this._tx(() => {
      const row = this._assertLease(lease);
      // No automatic model rerun: a caller may resume a crash lease, but a settled failure is terminal.
      this._run("UPDATE jobs SET status='failed',error=?,owner=NULL,lease_until=NULL,finished_at=? WHERE id=?", stable({ code, message, retryable }), this.clock(), row.id);
      this._event(row.workspace_id, row.kind, 'job.failed', { jobId: row.id, metadata: { code, retryable } }); return this._jobReceipt(this._get('SELECT * FROM jobs WHERE id=?', row.id));
    });
  }
  cancelJob({ workspaceId, jobId }) {
    return this._tx(() => {
      this._workspace(workspaceId, false); const row = this._get('SELECT * FROM jobs WHERE workspace_id=? AND id=?', workspaceId, jobId);
      requireValue(row, 'NOT_FOUND', 'Job not found in this workspace');
      if (['queued', 'running', 'paused'].includes(row.status)) this._run("UPDATE jobs SET status='cancelled',owner=NULL,lease_until=NULL,token=token+1,finished_at=? WHERE id=?", this.clock(), jobId);
      return this._jobReceipt(this._get('SELECT * FROM jobs WHERE id=?', jobId));
    });
  }
}
