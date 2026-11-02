import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import schema from '../schemas/memory-contracts.schema.json' with { type: 'json' };
const ajv = new Ajv({ strict: false, allErrors: true }); addFormats(ajv); ajv.addSchema(schema);
export function contractSchema(definition) {
  const defs = {}, visit = value => {
    if (!value || typeof value !== 'object') return;
    if (typeof value.$ref === 'string' && value.$ref.startsWith('#/$defs/')) {
      const name = value.$ref.slice(8);
      if (!defs[name]) { defs[name] = schema.$defs[name]; visit(defs[name]); }
    }
    for (const nested of Object.values(value)) visit(nested);
  };
  visit({ $ref: '#/$defs/' + definition });
  return { $defs: defs, $ref: '#/$defs/' + definition };
}
export function validateOutput(definition, value) {
  const validate = ajv.getSchema(schema.$id + '#/$defs/' + definition);
  if (!validate(value)) throw Object.assign(new Error('Model output does not match ' + definition + ': ' + ajv.errorsText(validate.errors)), { code: 'INVALID_PROPOSAL' });
  return value;
}

/** Some providers choose a JSON string for a permissive tool parameter.
 * Decode exactly one layer at the tool boundary; semantic validation remains
 * the caller's responsibility. Never recursively parse strings or accept a
 * scalar/array as a proposal or source-reference object. */
export function toolJsonObject(value, field) {
  let object = value;
  if (typeof value === 'string') {
    try { object = JSON.parse(value); }
    catch { throw Object.assign(new Error(`${field} must be an object or one JSON-encoded object.`), { code: 'INVALID_PROPOSAL' }); }
  }
  if (!object || typeof object !== 'object' || Array.isArray(object) || ![Object.prototype, null].includes(Object.getPrototypeOf(object))) {
    throw Object.assign(new Error(`${field} must be an object or one JSON-encoded object.`), { code: 'INVALID_PROPOSAL' });
  }
  return object;
}

export function toolSourceRefs(values) {
  if (!Array.isArray(values)) throw Object.assign(new Error('source_refs must be an array of source-reference objects.'), { code: 'INVALID_PROPOSAL' });
  return values.map((value, index) => validateOutput('SourceRef', normalizeSources(toolJsonObject(value, `source_refs[${index}]`))));
}

/** Model-authored source timestamps are not trusted observations. Preserve facts, bind evidence locations mechanically. */
export function normalizeSources(value, aliases = []) {
  const clone = structuredClone(value);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (typeof node.source_kind === 'string' && typeof node.locator === 'string') {
      delete node.observed_at;
      const alias = aliases.find(a => node.locator === a.path || node.locator.startsWith(a.path + '#') || node.locator.startsWith(a.path + ':'));
      if (alias) { node.source_kind = 'session_event'; node.locator = alias.locator; node.version_hint = alias.version; }
    }
    for (const child of Object.values(node)) visit(child);
  };
  visit(clone); return clone;
}
