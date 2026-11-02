import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync, fsyncSync, lstatSync } from 'node:fs';
import path from 'node:path';

const hash = text => createHash('sha256').update(text).digest('hex');
function fail(code, message) { const error = new Error(message); error.code = code; throw error; }

/** USER.md remains authoritative; SQLite holds only journals and bounded audit/receipts. */
export class UserProfileStore {
  constructor({ dshHome, dataDir, clock = Date.now, maxBytes = 32768, retentionDays = 30 }) {
    this.file = path.join(dshHome, 'USER.md');
    this.clock = clock; this.maxBytes = maxBytes; this.retentionDays = retentionDays;
    mkdirSync(dshHome, { recursive: true }); mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    this.db = new DatabaseSync(path.join(dataDir, 'user-profile.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA secure_delete=ON;
      CREATE TABLE IF NOT EXISTS profile_receipts(request_id TEXT PRIMARY KEY, fingerprint TEXT NOT NULL, receipt TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_journal(singleton INTEGER PRIMARY KEY CHECK(singleton=1), payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_activity(id TEXT PRIMARY KEY, at INTEGER NOT NULL, payload TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS profile_settings(singleton INTEGER PRIMARY KEY CHECK(singleton=1), enabled INTEGER NOT NULL DEFAULT 1, auto_write INTEGER NOT NULL DEFAULT 1);
      INSERT OR IGNORE INTO profile_settings(singleton) VALUES(1);`);
    this.transaction(() => {
      const columns = this.db.prepare('PRAGMA table_info(profile_settings)').all().map(x => x.name);
      if (!columns.includes('clear_epoch')) this.db.exec('ALTER TABLE profile_settings ADD COLUMN clear_epoch INTEGER NOT NULL DEFAULT 0');
      if (!columns.includes('cleanup_request')) this.db.exec('ALTER TABLE profile_settings ADD COLUMN cleanup_request TEXT');
    });
    this.recover();
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.db.exec('COMMIT'); return r; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  read() {
    let text = '';
    try {
      if (lstatSync(this.file).isSymbolicLink()) fail('PROFILE_SYMLINK', 'USER.md must be a regular file.');
      text = readFileSync(this.file, 'utf8');
    } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (Buffer.byteLength(text) > this.maxBytes) fail('PROFILE_CAPACITY', 'USER.md exceeds the configured full-injection limit.');
    return { text, hash: hash(text), ...this.settings() };
  }
  settings() {
    const row = this.db.prepare('SELECT enabled,auto_write,clear_epoch,cleanup_request FROM profile_settings WHERE singleton=1').get();
    return { enabled: !!row.enabled, autoWrite: !!row.auto_write, clearEpoch: row.clear_epoch, cleanupRequest: row.cleanup_request };
  }
  configure({ enabled, autoWrite }) {
    if (enabled !== undefined && typeof enabled !== 'boolean' || autoWrite !== undefined && typeof autoWrite !== 'boolean') fail('INVALID_SETTINGS', 'Profile switches must be boolean.');
    return this.transaction(() => {
      const previous = this.settings();
      this.db.prepare('UPDATE profile_settings SET enabled=?, auto_write=? WHERE singleton=1').run(Number(enabled ?? previous.enabled), Number(autoWrite ?? previous.autoWrite));
      return this.settings();
    });
  }
  atomicWrite(text) {
    const temporary = `${this.file}.automemory-${randomUUID()}.tmp`;
    try {
      const fd = openSync(temporary, 'wx', 0o600);
      try { writeFileSync(fd, text, 'utf8'); fsyncSync(fd); } finally { closeSync(fd); }
      renameSync(temporary, this.file);
      const directory = openSync(path.dirname(this.file), 'r');
      try { fsyncSync(directory); } finally { closeSync(directory); }
    } finally { try { unlinkSync(temporary); } catch (e) { if (e.code !== 'ENOENT') throw e; } }
  }
  finish(journal, state) {
    if (journal.clear && (state === 'committed' || state === 'no_change')) {
      // Revoke historical request effects but retain hashes/IDs to prevent replay resurrection.
      for (const row of this.db.prepare('SELECT request_id FROM profile_receipts').all()) this.db.prepare('UPDATE profile_receipts SET receipt=? WHERE request_id=?').run(JSON.stringify({ request_id: row.request_id, status: 'rejected', error: 'REQUEST_REVOKED_BY_CLEAR' }), row.request_id);
      this.db.exec('DELETE FROM profile_activity; DELETE FROM profile_journal;');
      this.db.prepare('UPDATE profile_settings SET clear_epoch=clear_epoch+1,cleanup_request=? WHERE singleton=1').run(journal.externalCleanupRequired ? journal.requestId : null);
      const receipt = { request_id: journal.requestId, status: 'committed', cleanup_status: journal.externalCleanupRequired ? 'incomplete' : 'complete', scope_statement: 'USER.md, plugin-controlled profile audit content, snapshots and plugin-generated background role sessions; original user DSH sessions, provider records, external backups and physical-media erasure excluded.' };
      this.db.prepare('INSERT OR REPLACE INTO profile_receipts VALUES(?,?,?)').run(journal.requestId, journal.fingerprint, JSON.stringify(receipt));
      return receipt;
    }
    const receipt = { request_id: journal.requestId, status: state, before_hash: journal.beforeHash, after_hash: state === 'committed' ? journal.afterHash : journal.beforeHash, reason: journal.reason, source_refs: journal.sources, at: this.clock(), ...(journal.clear ? { cleanup_status: 'incomplete' } : {}) };
    if (state === 'committed') this.db.prepare('INSERT OR IGNORE INTO profile_activity VALUES(?,?,?)').run(journal.requestId, receipt.at, JSON.stringify({ ...receipt, before: journal.before, after: journal.text, origin: journal.origin }));
    this.db.prepare('INSERT OR REPLACE INTO profile_receipts VALUES(?,?,?)').run(journal.requestId, journal.fingerprint, JSON.stringify(receipt));
    this.db.exec('DELETE FROM profile_journal WHERE singleton=1');
    return receipt;
  }
  recover() {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT payload FROM profile_journal WHERE singleton=1').get();
      if (!row) return;
      const journal = JSON.parse(row.payload), current = this.read();
      if (current.hash === journal.afterHash) return this.finish(journal, 'committed');
      if (current.hash === journal.beforeHash && journal.ownerPid && this.clock() - journal.startedAt < 30000) {
        let alive = true; try { process.kill(journal.ownerPid, 0); } catch (e) { alive = e.code !== 'ESRCH'; }
        if (alive) return { request_id: journal.requestId, status: 'accepted' };
      }
      // A file replacement that never occurred is not replayed over a later human edit.
      return this.finish(journal, 'failed');
    });
  }
  update(args) { return this.change(args, false); }
  change({ text, expectedHash, reason, sources = [], requestId, origin = 'automatic', externalCleanupRequired = false }, clear) {
    if (typeof text !== 'string' || !requestId || !expectedHash || !reason || !Array.isArray(sources)) fail('INVALID_PROPOSAL', 'Profile update requires text, expectedHash, reason, sources and a trusted request id.');
    if (Buffer.byteLength(text) > this.maxBytes) fail('PROFILE_CAPACITY', 'USER.md exceeds the configured size.');
    const fingerprint = hash(JSON.stringify({ text, expectedHash, reason, sources, origin, clear, externalCleanupRequired }));
    this.recover();
    const staged = this.transaction(() => {
      const settings = this.settings();
      if (origin === 'automatic' && (!settings.enabled || !settings.autoWrite)) fail('PROFILE_DISABLED', 'Global profile maintenance is disabled.');
      const old = this.db.prepare('SELECT fingerprint, receipt FROM profile_receipts WHERE request_id=?').get(requestId);
      if (old) { if (old.fingerprint !== fingerprint) fail('IDEMPOTENCY_CONFLICT', 'Request id already refers to a different change.'); return { receipt: JSON.parse(old.receipt) }; }
      if (settings.cleanupRequest) fail('PROFILE_BUSY', 'A prior global clearing request is still cleaning runtime copies.');
      if (this.db.prepare('SELECT 1 FROM profile_journal').get()) fail('PROFILE_BUSY', 'A profile update requires recovery before another write.');
      const current = this.read();
      if (current.hash !== expectedHash) fail('VERSION_CONFLICT', 'USER.md changed; reread before editing.');
      const journal = { requestId, fingerprint, text, before: current.text, beforeHash: current.hash, afterHash: hash(text), reason, sources, origin, clear, externalCleanupRequired, ownerPid: process.pid, startedAt: this.clock() };
      if (journal.beforeHash === journal.afterHash) return { receipt: this.finish(journal, 'no_change') };
      this.db.prepare('INSERT INTO profile_journal VALUES(1,?)').run(JSON.stringify(journal));
      return { journal };
    });
    if (staged.receipt) return staged.receipt;
    return this.transaction(() => {
      const row = this.db.prepare('SELECT payload FROM profile_journal WHERE singleton=1').get();
      if (!row) { const receipt = this.db.prepare('SELECT receipt FROM profile_receipts WHERE request_id=?').get(requestId); return JSON.parse(receipt.receipt); }
      const journal = JSON.parse(row.payload);
      if (journal.requestId !== requestId) fail('PROFILE_BUSY', 'Profile ownership changed.');
      const settings = this.settings();
      if (origin === 'automatic' && (!settings.enabled || !settings.autoWrite)) return this.finish(journal, 'rejected');
      if (this.read().hash !== expectedHash) { this.finish(journal, 'failed'); return { request_id: requestId, status: 'rejected', error: 'VERSION_CONFLICT' }; }
      this.atomicWrite(text);
      return this.finish(journal, 'committed');
    });
  }
  activity({ limit = 100 } = {}) {
    const cutoff = this.clock() - this.retentionDays * 86400000;
    this.transaction(() => {
      this.db.prepare('DELETE FROM profile_activity WHERE at < ?').run(cutoff);
      for (const row of this.db.prepare("SELECT request_id,receipt FROM profile_receipts WHERE json_extract(receipt,'$.at') < ? AND (json_type(receipt,'$.reason') IS NOT NULL OR json_type(receipt,'$.source_refs') IS NOT NULL)").all(cutoff)) {
        const receipt = JSON.parse(row.receipt); delete receipt.reason; delete receipt.source_refs;
        this.db.prepare('UPDATE profile_receipts SET receipt=? WHERE request_id=?').run(JSON.stringify(receipt), row.request_id);
      }
    });
    return this.db.prepare('SELECT payload FROM profile_activity ORDER BY at DESC LIMIT ?').all(Math.min(500, Math.max(1, limit))).map(x => JSON.parse(x.payload));
  }
  clear({ expectedHash, requestId, authorized = false, externalCleanupRequired = false }) {
    if (!authorized) fail('DELETE_NOT_AUTHORIZED', 'Explicit user clearing authorization required.');
    return this.change({ text: '', expectedHash, requestId, reason: 'User requested global profile clearing', origin: 'user', externalCleanupRequired }, true);
  }
  completeExternalCleanup(requestId, cleanup = () => {}) {
    return this.transaction(() => {
      const row = this.db.prepare('SELECT receipt FROM profile_receipts WHERE request_id=?').get(requestId);
      if (!row) fail('NOT_FOUND', 'Clearing receipt is missing.');
      const receipt = JSON.parse(row.receipt);
      if (receipt.cleanup_status === 'complete') return receipt;
      if (this.settings().cleanupRequest !== requestId && receipt.cleanup_status !== 'complete') fail('VERSION_CONFLICT', 'A different global clear is pending.');
      // Serialize the final synchronous cleanup across hosts. No model/network operation is allowed here.
      cleanup();
      receipt.cleanup_status = 'complete';
      this.db.prepare('UPDATE profile_receipts SET receipt=? WHERE request_id=?').run(JSON.stringify(receipt), requestId);
      this.db.prepare('UPDATE profile_settings SET cleanup_request=NULL WHERE singleton=1 AND cleanup_request=?').run(requestId);
      return receipt;
    });
  }
  close() { this.db.close(); }
}
