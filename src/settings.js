import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
export const DEFAULT_SETTINGS = Object.freeze({
  models: { manager: { provider: 'deepseek-official', model: 'deepseek-flash' }, g2: null, dreamer: { provider: 'deepseek-official', model: 'deepseek-flash' }, reviewer: { provider: 'deepseek-official', model: 'deepseek-flash' } },
  dreamIntervalHours: 24, auditRetentionDays: 30,
  budget: { maxInputTokens: 131072, maxOutputTokens: 4096, maxSteps: 8, maxDailyTokens: 1000000 },
});
const invalid = message => Object.assign(new Error(message), { code: 'INVALID_SETTINGS' });
/** Budget estimate, never provider billing. Preserve the byte upper fallback
 * whenever the host cannot reliably measure the exact outgoing request. */
export function requestInputBudget(request) {
  const byteUpperTokens = Buffer.byteLength(JSON.stringify({ messages: request.messages, tools: request.tools || [] })) + 4096;
  const estimate = request.inputEstimate;
  const raw = typeof estimate?.rawEstimateTokens === 'number' && Number.isFinite(estimate.rawEstimateTokens) ? estimate.rawEstimateTokens : null;
  const padded = raw === null ? NaN : Math.ceil(raw * 1.25) + 4096;
  const sameRoute = typeof request.provider === 'string' && typeof request.model === 'string' && estimate?.provider === request.provider && estimate?.model === request.model;
  const reliable = sameRoute && estimate?.method === 'native-token-meter' && estimate.reliable === true && Number.isSafeInteger(raw) && raw > 0 && Number.isSafeInteger(padded);
  return { method: reliable ? 'native-token-meter' : 'utf8-byte-upper-fallback', rawEstimateTokens: raw, conservativeInputTokens: reliable ? padded : byteUpperTokens, byteUpperTokens, safetyMultiplier: reliable ? 1.25 : null, safetyAddTokens: 4096, estimateReliable: reliable, approximate: true, billingUsage: false };
}
export class SettingsStore {
  constructor(dataDir, { clock = Date.now, defaults = DEFAULT_SETTINGS } = {}) {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 }); this.clock = clock;
    this.db = new DatabaseSync(path.join(dataDir, 'settings.sqlite'));
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; PRAGMA synchronous=FULL;
      CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, at INTEGER NOT NULL, reservation INTEGER NOT NULL, actual INTEGER, usage TEXT, state TEXT NOT NULL);`);
    this.db.prepare('INSERT OR IGNORE INTO settings VALUES(1,?)').run(JSON.stringify(defaults));
  }
  get() { const value = JSON.parse(this.db.prepare('SELECT value FROM settings WHERE id=1').get().value); return { ...value, models: { ...DEFAULT_SETTINGS.models, ...value.models }, revision: value.revision ?? 0 }; }
  set(input) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const result = this.setLocked(input); this.db.exec('COMMIT'); return result; }
    catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  setLocked(input) {
    const current = this.get();
    if (input.revision !== undefined && input.revision !== current.revision) throw Object.assign(new Error('Settings changed in another host; reload before saving.'), { code: 'VERSION_CONFLICT' });
    const next = { ...current, ...input, revision: current.revision + 1, models: { ...current.models, ...input.models }, budget: { ...current.budget, ...input.budget } };
    for (const key of Object.keys(next)) if (!['models', 'budget', 'dreamIntervalHours', 'auditRetentionDays', 'revision'].includes(key)) throw invalid('Unknown setting: ' + key);
    for (const [key, min, max] of [['dreamIntervalHours', 24, 8760], ['auditRetentionDays', 1, 3650]]) if (!Number.isInteger(next[key]) || next[key] < min || next[key] > max) throw invalid(key + ' is outside its allowed range.');
    for (const [key, min, max] of [['maxInputTokens', 1024, 2000000], ['maxOutputTokens', 128, 32768], ['maxSteps', 1, 32], ['maxDailyTokens', 1024, 100000000]]) if (!Number.isInteger(next.budget[key]) || next.budget[key] < min || next.budget[key] > max) throw invalid(key + ' is outside its allowed range.');
    for (const key of Object.keys(next.budget)) if (!(key in DEFAULT_SETTINGS.budget)) throw invalid('Unknown budget field: ' + key);
    for (const key of Object.keys(next.models)) {
      if (!['g2', 'dreamer', 'reviewer', 'manager'].includes(key)) throw invalid('Unknown model role.');
      const value = next.models[key];
      if (value === null && key === 'g2') continue;
      if (!value || typeof value.provider !== 'string' || !value.provider.trim() || typeof value.model !== 'string' || !value.model.trim()) throw invalid('Model requires provider and model identifiers.');
      if (Object.keys(value).some(k => !['provider', 'model', 'reasoningEffort'].includes(k))) throw invalid('Unknown model field.');
    }
    this.db.prepare('UPDATE settings SET value=? WHERE id=1').run(JSON.stringify(next)); return next;
  }
  reserve(id, tokens) {
    if (!Number.isSafeInteger(tokens) || tokens < 0) throw invalid('Model reservation must be a nonnegative safe integer.');
    this.db.exec('BEGIN IMMEDIATE');
    try {
      if (this.db.prepare('SELECT 1 FROM calls WHERE id=?').get(id)) throw Object.assign(new Error('Model request identity already reserved'), { code: 'MODEL_REQUEST_REPLAY' });
      const since = this.clock() - 86400000;
      const used = this.db.prepare('SELECT COALESCE(SUM(COALESCE(actual,reservation)),0) AS tokens FROM calls WHERE at >= ?').get(since).tokens;
      if (used + tokens > this.get().budget.maxDailyTokens) throw Object.assign(new Error('Rolling 24-hour background token budget exhausted.'), { code: 'MODEL_BUDGET_EXCEEDED' });
      this.db.prepare('INSERT INTO calls VALUES(?,?,?,NULL,NULL,?)').run(id, this.clock(), tokens, 'reserved');
      this.db.exec('COMMIT');
    } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }
  settle(id, usage, actualTokens) {
    // Unknown usage retains its reservation instead of claiming a zero-cost call.
    const actual = Number.isFinite(actualTokens) && actualTokens >= 0 && Number.isSafeInteger(Math.ceil(actualTokens)) ? Math.ceil(actualTokens) : null;
    this.db.prepare('UPDATE calls SET actual=?,usage=?,state=? WHERE id=?').run(actual, JSON.stringify(usage ?? null), 'settled', id);
  }
  usage() { return this.db.prepare('SELECT id,at,reservation,actual,state FROM calls WHERE at>=? ORDER BY at DESC').all(this.clock() - 86400000); }
  close() { this.db.close(); }
}
