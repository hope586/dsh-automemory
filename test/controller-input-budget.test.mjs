import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { TokenMeter } from '@deepseek-ai/dsh-token-meter';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';
import { requestInputBudget, DEFAULT_SETTINGS } from '../src/settings.js';

const noop = { audit_completion: 'complete', explanation: 'No further durable change.', operations: [], issues: [] };
async function fullG2(t, { meter = true, size = 160000 } = {}) {
  let parentSteps = 0;
  const h = await harness(options => options.sessionId === 'parent'
    ? ++parentSteps === 1 ? call('memory_audit', { reason: 'Completed fixture stage' }, 'budget-audit') : text('FUTURE_PARENT_NOT_IN_SNAPSHOT_669')
    : text(noop));
  if (meter) new TokenMeter(h.ctx);
  const home = path.join(h.temp, 'memory-home'), c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') }); clearInterval(c.timer);
  t.after(async () => { await c.close(); await h.close(); });
  const body = 'FULL_CONTEXT_START_669\n' + 'x'.repeat(size) + '\nFULL_CONTEXT_END_669';
  const parent = await h.agent(); parent.followup(message(body)); await parent.whenIdle();
  const workspace = c.bind(parent.session), job = c.store.listJobs({ workspaceId: workspace.id }).find(job => job.kind === 'G2');
  assert.ok(job, JSON.stringify(c.errors));
  const snapshot = JSON.stringify(c.store.getJob(job.id).snapshot);
  await c.tick(); if (c.active) await c.active;
  return { h, c, body, job: c.store.getJob(job.id), snapshot, artifacts: c.store.getJobArtifacts(job.id), calls: h.calls.filter(call => call.sessionId.startsWith('automemory-g2-')) };
}

test('native token estimate admits a complete normal G2 snapshot exceeding the old byte bound under the unchanged default', async t => {
  const f = await fullG2(t), budget = f.artifacts['audit-budget-1'];
  assert.equal(f.job.status, 'completed', JSON.stringify(f.c.errors)); assert.equal(f.calls.length, 1);
  assert.equal(f.c.settings.get().budget.maxInputTokens, DEFAULT_SETTINGS.budget.maxInputTokens);
  assert.equal(budget.method, 'native-token-meter'); assert.equal(budget.estimateReliable, true);
  assert.ok(budget.byteUpperTokens > DEFAULT_SETTINGS.budget.maxInputTokens);
  assert.ok(budget.conservativeInputTokens < DEFAULT_SETTINGS.budget.maxInputTokens);
  assert.equal(budget.conservativeInputTokens, Math.ceil(budget.rawEstimateTokens * 1.25) + 4096);
  assert.equal(f.snapshot, JSON.stringify(f.job.snapshot), 'The captured G2 context is never rewritten or trimmed');
  const messages = f.calls[0].messages.flatMap(message => message.content || []).filter(block => block.type === 'text').map(block => block.text);
  assert.ok(messages.includes(f.body), 'The full original user body remains in the actual outgoing request');
  assert.ok(!messages.some(text => text.includes('FUTURE_PARENT_NOT_IN_SNAPSHOT_669')));
  assert.equal(f.c.settings.usage()[0].reservation, budget.conservativeInputTokens + DEFAULT_SETTINGS.budget.maxOutputTokens);
  assert.notEqual(f.c.settings.usage()[0].actual, budget.conservativeInputTokens, 'The estimate is not persisted as provider billing');
});

test('genuinely excessive native G2 estimates reject before dispatch or budget reservation without truncation', async t => {
  const f = await fullG2(t, { size: 450000 }), budget = f.artifacts['audit-budget-1'];
  assert.equal(f.job.status, 'failed'); assert.equal(f.job.error.code, 'MODEL_INPUT_BUDGET');
  assert.equal(budget.method, 'native-token-meter'); assert.equal(budget.limitExceeded, true);
  assert.ok(budget.conservativeInputTokens > DEFAULT_SETTINGS.budget.maxInputTokens);
  assert.equal(f.calls.length, 0); assert.equal(f.c.settings.usage().length, 0);
  assert.equal(f.snapshot, JSON.stringify(f.job.snapshot));
});

test('without a reliable native meter a large full G2 retains the old byte upper fallback', async t => {
  const f = await fullG2(t, { meter: false }), budget = f.artifacts['audit-budget-1'];
  assert.equal(f.job.status, 'failed'); assert.equal(f.job.error.code, 'MODEL_INPUT_BUDGET');
  assert.equal(budget.method, 'utf8-byte-upper-fallback'); assert.equal(budget.estimateReliable, false);
  assert.equal(budget.conservativeInputTokens, budget.byteUpperTokens);
  assert.equal(f.calls.length, 0); assert.equal(f.c.settings.usage().length, 0);
  assert.equal(f.snapshot, JSON.stringify(f.job.snapshot));
});

test('untrusted, malformed or zero native estimates cannot silently lower the byte fallback', () => {
  const request = { provider: 'fixture', model: 'actual-model', messages: [{ role: 'user', content: [{ type: 'text', text: '完整中文事实'.repeat(20000) }] }], tools: [] };
  const baseline = requestInputBudget(request);
  for (const inputEstimate of [
    { provider: 'fixture', model: 'actual-model', method: 'native-token-meter', reliable: false, rawEstimateTokens: 1 },
    { provider: 'fixture', model: 'actual-model', method: 'unverified-meter', reliable: true, rawEstimateTokens: 1 },
    { provider: 'other-provider', model: 'actual-model', method: 'native-token-meter', reliable: true, rawEstimateTokens: 1 },
    { provider: 'fixture', model: 'different-model', method: 'native-token-meter', reliable: true, rawEstimateTokens: 1 },
    ...[undefined, null, NaN, Infinity, -1, 0, 0.5, Number.MAX_SAFE_INTEGER].map(rawEstimateTokens => ({ provider: 'fixture', model: 'actual-model', method: 'native-token-meter', reliable: true, rawEstimateTokens })),
  ]) {
    const result = requestInputBudget({ ...request, inputEstimate });
    assert.equal(result.method, 'utf8-byte-upper-fallback'); assert.equal(result.conservativeInputTokens, baseline.byteUpperTokens);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(result)));
  }
});
