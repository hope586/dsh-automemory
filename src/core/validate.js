import { createHash } from 'node:crypto';

export class MemoryError extends Error {
  constructor(code, message, operationKey) { super(message); this.name = 'MemoryError'; this.code = code; this.operationKey = operationKey; }
}
export function requireValue(condition, code, message) { if (!condition) throw new MemoryError(code, message); }
export function stable(value) {
  const ancestors = new Set();
  function encode(input, arrayItem = false) {
    if (input === undefined) {
      requireValue(arrayItem, 'INVALID_JSON', 'Top-level undefined is not a JSON value');
      return 'null';
    }
    if (input === null || typeof input === 'boolean' || typeof input === 'string') return JSON.stringify(input);
    if (typeof input === 'number') { requireValue(Number.isFinite(input), 'INVALID_JSON', 'Non-finite numbers are not accepted'); return JSON.stringify(input); }
    requireValue(typeof input === 'object', 'INVALID_JSON', 'Functions, symbols and BigInt are not JSON values');
    requireValue(!ancestors.has(input), 'INVALID_JSON', 'Cyclic values are not JSON values');
    ancestors.add(input);
    let encoded;
    if (Array.isArray(input)) encoded = '[' + Array.from({ length: input.length }, (_, i) => encode(input[i], true)).join(',') + ']';
    else {
      requireValue(Object.getPrototypeOf(input) === Object.prototype || Object.getPrototypeOf(input) === null, 'INVALID_JSON', 'Only plain JSON objects are accepted');
      encoded = '{' + Object.keys(input).sort().filter(k => input[k] !== undefined).map(k => JSON.stringify(k) + ':' + encode(input[k])).join(',') + '}';
    }
    ancestors.delete(input); return encoded;
  }
  return encode(value);
}
export const digest = value => createHash('sha256').update(typeof value === 'string' ? value : stable(value)).digest('hex');
export function text(value, field, empty = false) {
  requireValue(typeof value === 'string' && (empty || value.trim().length > 0), 'INVALID_PROPOSAL', `${field} must be a ${empty ? '' : 'nonempty '}string`);
}
function shape(value, allowed, required, label) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype, 'INVALID_PROPOSAL', `${label} must be a plain object`);
  requireValue(Object.keys(value).every(k => allowed.includes(k)) && required.every(k => Object.hasOwn(value, k)), 'INVALID_PROPOSAL', `${label} has missing or unsupported fields`);
}
function strings(value, label) { requireValue(Array.isArray(value), 'INVALID_PROPOSAL', `${label} must be an array`); value.forEach(v => text(v, label)); }
export function validateSources(value) {
  requireValue(Array.isArray(value) && value.length > 0, 'INVALID_PROPOSAL', 'source_refs must contain evidence references');
  requireValue(value.length <= 256, 'SOURCE_CAPACITY', 'At most 256 references are permitted; explicitly reconcile sources instead of truncating');
  for (const source of value) {
    shape(source, ['source_kind', 'locator', 'version_hint', 'observed_at'], ['source_kind', 'locator'], 'SourceRef');
    requireValue(['session_event', 'project_file', 'memory_record', 'audit_artifact'].includes(source.source_kind), 'INVALID_PROPOSAL', 'unsupported source_kind');
    text(source.locator, 'locator');
    if (source.version_hint !== undefined) text(source.version_hint, 'version_hint');
    if (source.observed_at !== undefined) requireValue(typeof source.observed_at === 'string' && Number.isFinite(Date.parse(source.observed_at)), 'INVALID_PROPOSAL', 'invalid observed_at');
  }
}
export function validateContent(value) {
  shape(value, ['title', 'category', 'index_hint', 'group', 'conditions', 'payload', 'format_reason'], ['title', 'category', 'index_hint', 'group', 'conditions', 'payload'], 'MemoryContent');
  for (const key of ['title', 'index_hint', 'group']) text(value[key], key);
  text(value.conditions, 'conditions', true);
  requireValue(['stable', 'active'].includes(value.category), 'INVALID_PROPOSAL', 'invalid category');
  const p = value.payload;
  if (p?.kind === 'markdown') {
    shape(p, ['kind', 'text'], ['kind', 'text'], 'MarkdownPayload'); text(p.text, 'payload.text');
    if (value.category === 'active') text(value.format_reason, 'format_reason');
  } else {
    requireValue(value.category === 'active' && p?.kind === 'task', 'INVALID_PROPOSAL', 'stable requires markdown; active requires task or explained markdown');
    shape(p, ['kind', 'goal', 'progress', 'blockers', 'next_actions', 'references'], ['kind', 'goal'], 'TaskPayload'); text(p.goal, 'goal');
    for (const key of ['progress', 'blockers', 'next_actions']) if (p[key] !== undefined) strings(p[key], key);
    if (p.references !== undefined) { requireValue(Array.isArray(p.references), 'INVALID_PROPOSAL', 'references must be an array'); if (p.references.length) validateSources(p.references); }
  }
  if (value.format_reason !== undefined) text(value.format_reason, 'format_reason');
  requireValue(Buffer.byteLength(stable(value)) <= 65536, 'INVALID_PROPOSAL', 'memory content exceeds 64 KiB');
}
export function validateDraft(draft) {
  shape(draft, ['audit_completion', 'explanation', 'operations', 'issues', 'review_responses'], ['audit_completion', 'explanation', 'operations', 'issues'], 'DraftResult');
  requireValue(['complete', 'partial'].includes(draft.audit_completion), 'INVALID_PROPOSAL', 'invalid audit_completion'); text(draft.explanation, 'explanation', true);
  requireValue(Array.isArray(draft.operations) && draft.operations.length <= 100 && Array.isArray(draft.issues) && draft.issues.length <= 100, 'INVALID_PROPOSAL', 'maximum 100 operations/issues per draft');
  requireValue(Buffer.byteLength(stable(draft)) <= 1024 * 1024, 'INVALID_PROPOSAL', 'draft exceeds 1 MiB');
  const keys = new Set(), targets = new Set(), locals = new Set();
  for (const op of draft.operations) {
    const kind = op?.op;
    requireValue(['CREATE', 'UPDATE', 'RESTORE', 'ARCHIVE', 'RETRACT', 'DELETE'].includes(kind), 'INVALID_PROPOSAL', 'invalid operation');
    const fields = ['op', 'operation_key', 'reason', 'source_refs', ...(kind === 'CREATE' ? ['local_key', 'content'] : ['target_id', 'expected_version']), ...(['UPDATE', 'RESTORE'].includes(kind) ? ['content'] : []), ...(['ARCHIVE', 'RETRACT'].includes(kind) ? ['replacement_refs'] : []), ...(['UPDATE', 'RESTORE', 'ARCHIVE', 'RETRACT'].includes(kind) ? ['remove_source_refs'] : [])];
    shape(op, fields, fields.filter(x => !['replacement_refs', 'remove_source_refs'].includes(x)), 'MemoryOperation');
    text(op.operation_key, 'operation_key'); text(op.reason, 'reason'); validateSources(op.source_refs);
    if (op.remove_source_refs !== undefined) {
      requireValue(Array.isArray(op.remove_source_refs) && op.remove_source_refs.length <= 256, 'INVALID_PROPOSAL', 'remove_source_refs must be a bounded array');
      for (const removal of op.remove_source_refs) { shape(removal, ['source_ref', 'reason'], ['source_ref', 'reason'], 'SourceRemoval'); validateSources([removal.source_ref]); text(removal.reason, 'source removal reason'); }
    }
    requireValue(!keys.has(op.operation_key), 'INVALID_PROPOSAL', 'duplicate operation_key'); keys.add(op.operation_key);
    if (kind === 'CREATE') { text(op.local_key, 'local_key'); requireValue(!locals.has(op.local_key), 'INVALID_PROPOSAL', 'duplicate local_key'); locals.add(op.local_key); }
    else { text(op.target_id, 'target_id'); text(op.expected_version, 'expected_version'); requireValue(!targets.has(op.target_id), 'INVALID_PROPOSAL', 'multiple operations for one target'); targets.add(op.target_id); }
    if (op.content) validateContent(op.content);
    if (op.replacement_refs !== undefined) strings(op.replacement_refs, 'replacement_refs');
  }
  const issues = new Set();
  for (const issue of draft.issues) {
    shape(issue, ['issue_key', 'question', 'context', 'affected', 'source_refs', 'options'], ['issue_key', 'question', 'context', 'affected', 'source_refs'], 'IssueProposal');
    for (const key of ['issue_key', 'question', 'context']) text(issue[key], key);
    requireValue(!issues.has(issue.issue_key), 'INVALID_PROPOSAL', 'duplicate issue_key'); issues.add(issue.issue_key);
    requireValue(Array.isArray(issue.affected), 'INVALID_PROPOSAL', 'affected must be an array');
    for (const item of issue.affected) { shape(item, ['memory_id', 'observed_version'], ['memory_id', 'observed_version'], 'ObservedMemory'); text(item.memory_id, 'memory_id'); text(item.observed_version, 'observed_version'); }
    validateSources(issue.source_refs); if (issue.options !== undefined) strings(issue.options, 'options');
  }
  if (draft.review_responses !== undefined) {
    requireValue(Array.isArray(draft.review_responses), 'INVALID_PROPOSAL', 'review_responses must be an array');
    for (const response of draft.review_responses) {
      shape(response, ['finding_index', 'disposition', 'explanation'], ['finding_index', 'disposition', 'explanation'], 'ReviewResponse');
      requireValue(Number.isSafeInteger(response.finding_index) && response.finding_index >= 0, 'INVALID_PROPOSAL', 'invalid finding index');
      requireValue(['adopted', 'modified', 'not_adopted'].includes(response.disposition), 'INVALID_PROPOSAL', 'invalid review disposition'); text(response.explanation, 'review response explanation');
    }
  }
  return draft;
}
