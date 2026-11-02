import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, text, tool } from './fixtures/harness.mjs';
import { createHostAdapter } from '../src/host/index.js';
import { TokenMeter } from '@deepseek-ai/dsh-token-meter';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';

const role = h => ({ role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Inspect this evidence and return JSON.' });

test('native measurement uses the actual AgentLoop header and surface without mutating the request', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  new TokenMeter(h.ctx);
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  let measuredHeader, measuredMessages, request;
  const measure = h.ctx.tokenMeter.measure.bind(h.ctx.tokenMeter);
  h.ctx.tokenMeter.measure = (session, header) => {
    assert.equal(header, session.requestHeader());
    measuredHeader = structuredClone(header); measuredMessages = JSON.stringify(session.deriveMessages());
    return measure(session, header);
  };
  const result = await adapter.runRole({ ...role(h), prompt: '完整中文事实'.repeat(9000), onRequest: value => { request = value; } });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const estimate = request.inputEstimate;
  assert.equal(estimate.method, 'native-token-meter'); assert.equal(estimate.reliable, true); assert.equal(estimate.approximate, true);
  assert.equal(estimate.provider, measuredHeader.config.provider); assert.equal(estimate.model, measuredHeader.config.model);
  assert.equal(estimate.byteUpperTokens, Buffer.byteLength(JSON.stringify({ messages: request.messages, tools: request.tools })) + 4096);
  assert.ok(estimate.byteUpperTokens > 131072); assert.ok(estimate.rawEstimateTokens < 131072);
  assert.equal(JSON.stringify(h.calls[0].messages), measuredMessages);
  assert.deepEqual(h.calls[0].tools, measuredHeader.tools);
  assert.equal(result.requestChecks[0].status, 'dispatched'); assert.deepEqual(result.requests[0].inputEstimate, estimate);
});

test('same-route native usage anchors are reused, but a changed model re-prices the complete inherited snapshot', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close()); new TokenMeter(h.ctx);
  const calls = [];
  class MeterFixture extends LlmAdapter {
    async *stream(options) {
      calls.push(options);
      const block = calls.length === 1 ? { type: 'tool-call', id: 'read-once', name: 'memory_read', arguments: '{}' } : { type: 'text', text: '{"done":true}' };
      yield { type: 'block-start', index: 0, blockType: block.type };
      yield { type: 'block-end', index: 0, block };
      yield { type: 'usage', usage: { inputTokens: 25000, outputTokens: 5 } };
      yield { type: 'finish', reason: { kind: block.type === 'tool-call' ? 'tool-calls' : 'stop' } };
    }
  }
  h.ctx.llm.registerAdapter(['meter-fixture'], new MeterFixture());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const shared = { ...role(h), model: { provider: 'meter-fixture', model: 'first-model' }, tools: [tool('memory_read', () => ({ body: 'unaltered source fact' }))] };
  const first = await adapter.runRole(shared);
  assert.equal(first.status, 'completed', JSON.stringify(first)); assert.equal(first.requests.length, 2);
  assert.equal(first.requests[0].inputEstimate.baselineKind, 'estimated');
  assert.equal(first.requests[1].inputEstimate.baselineKind, 'usage'); assert.equal(first.requests[1].inputEstimate.baselineTokens, 25005);
  const snapshotBefore = JSON.stringify(first.snapshot);
  const changed = await adapter.runRole({ ...shared, snapshot: first.snapshot, model: { provider: 'meter-fixture', model: 'second-model' }, prompt: 'Continue with all previous evidence.' });
  assert.equal(changed.status, 'completed', JSON.stringify(changed));
  assert.equal(changed.requests[0].inputEstimate.method, 'native-token-meter');
  assert.equal(changed.requests[0].inputEstimate.baselineKind, 'estimated');
  assert.ok(changed.requests[0].inputEstimate.rawEstimateTokens < 25005);
  assert.equal(changed.requests[0].inputEstimate.model, 'second-model');
  assert.equal(JSON.stringify(first.snapshot), snapshotBefore);
  assert.match(JSON.stringify(calls.at(-1).messages), /unaltered source fact/);
  assert.match(JSON.stringify(calls.at(-1).messages), /Inspect this evidence/);
});

test('unavailable, failed, stale and malformed meter results retain the byte fallback and never become billing', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const noMeter = await adapter.runRole(role(h));
  assert.equal(noMeter.requests[0].inputEstimate.fallbackReason, 'TOKEN_METER_UNAVAILABLE');
  new TokenMeter(h.ctx); const measure = h.ctx.tokenMeter.measure.bind(h.ctx.tokenMeter);
  for (const variant of ['throw', 'stale', 'zero', 'fraction', 'nan', 'inconsistent', 'missing-baseline']) {
    h.ctx.tokenMeter.measure = (session, header) => {
      if (variant === 'throw') throw new Error('Unusable local projection');
      const value = structuredClone(measure(session, header));
      if (variant === 'stale') value.logRevision--;
      if (variant === 'zero') value.totalTokens = value.baseline.tokens = value.surfaceDeltaTokens = 0;
      if (variant === 'fraction') value.totalTokens = 1.5;
      if (variant === 'nan') value.totalTokens = NaN;
      if (variant === 'inconsistent') value.totalTokens++;
      if (variant === 'missing-baseline') delete value.baseline;
      return value;
    };
    const result = await adapter.runRole(role(h));
    assert.equal(result.status, 'completed', variant + JSON.stringify(result));
    const estimate = result.requests[0].inputEstimate;
    assert.equal(estimate.method, 'byte-fallback', variant); assert.equal(estimate.reliable, false); assert.equal(estimate.rawEstimateTokens, null);
    assert.equal(estimate.fallbackReason, variant === 'throw' ? 'TOKEN_METER_FAILED' : 'TOKEN_METER_INVALID');
    assert.deepEqual(result.usage.map(usage => ({ input: usage.inputTokens, output: usage.outputTokens })), [{ input: 10, output: 5 }]);
    assert.doesNotThrow(() => JSON.parse(JSON.stringify(estimate)));
  }
});

test('an envelope changed before measurement is not priced using the stale native session header', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close()); new TokenMeter(h.ctx);
  // Simulate another public middleware changing the persisted header between
  // AgentLoop's immutable request snapshot and this plugin's budget check.
  h.ctx.on('llm/stream', (options, next) => {
    const session = h.ctx.sessions.get(options.sessionId);
    const header = session.requestHeader();
    session.append('request/header', { header: { ...header, config: { ...header.config, model: 'changed-header-model' } }, reason: 'change' });
    return next();
  });
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole(role(h));
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.requests[0].inputEstimate.fallbackReason, 'REQUEST_HEADER_MISMATCH');
  assert.equal(result.requests[0].inputEstimate.reliable, false);
});

test('a session surface changed after the immutable request was built cannot silently lower its estimate', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close()); new TokenMeter(h.ctx);
  h.ctx.on('llm/stream', (options, next) => {
    h.ctx.sessions.get(options.sessionId).append('user/message', {
      id: 'late-source', role: 'user', source: { kind: 'fixture-late-source' }, content: [{ type: 'text', text: 'Not in the built request.' }],
    }, { surfaceOp: 'append' });
    return next();
  });
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole(role(h));
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(result.requests[0].inputEstimate.fallbackReason, 'REQUEST_SURFACE_MISMATCH');
  assert.equal(result.requests[0].inputEstimate.reliable, false);
  assert.doesNotMatch(JSON.stringify(h.calls[0].messages), /Not in the built request/);
});

test('budget rejection retains its native estimate without inventing a provider request or usage', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close()); new TokenMeter(h.ctx);
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ ...role(h), onRequest: () => { throw Object.assign(new Error('Input budget exhausted'), { code: 'MODEL_INPUT_BUDGET' }); } });
  assert.equal(result.status, 'failed'); assert.equal(result.error.code, 'MODEL_INPUT_BUDGET');
  assert.equal(result.requestChecks.length, 1); assert.equal(result.requestChecks[0].status, 'rejected');
  assert.equal(result.requestChecks[0].code, 'MODEL_INPUT_BUDGET'); assert.equal(result.requestChecks[0].inputEstimate.method, 'native-token-meter');
  assert.deepEqual(result.requests, []); assert.deepEqual(result.usage, []); assert.equal(h.calls.length, 0);
});
