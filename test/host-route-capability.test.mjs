import test from 'node:test';
import assert from 'node:assert/strict';
import { harness, text, tool } from './fixtures/harness.mjs';
import { createHostAdapter } from '../src/host/index.js';
import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import * as PiAi from '@deepseek-ai/dsh-llm-pi-ai';

test('local route checks use registered adapters and exact pi-ai configuration without catalog or network probes', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  assert.equal((await adapter.checkModelRoute({ provider: 'zai', model: 'glm-fixture' })).causeCode, 'NO_ADAPTER');
  let networkCalls = 0;
  const fetch = globalThis.fetch;
  globalThis.fetch = () => { networkCalls++; throw new Error('No capability check may contact a model endpoint.'); };
  t.after(() => { globalThis.fetch = fetch; });
  const pi = await h.ctx.plugin(PiAi, { providers: { zai: {
    api: 'openai-completions', baseURL: 'http://127.0.0.1:1/not-contacted', apiKeyEnv: 'AUTOMEMORY_CAPABILITY_TEST_MISSING_KEY',
    models: [{ id: 'glm-fixture', name: 'Local configured fixture', contextWindow: 131072, maxTokens: 4096, input: ['text'] }],
  } } });
  assert.ok(h.ctx.llm.listProviders().some(p => p.id === 'zai'));
  assert.equal(h.ctx.llm.listConfigurableProviders().find(p => p.provider === 'zai').settingsNs, 'llm-pi-ai');
  const known = await adapter.checkModelRoute({ provider: 'zai', model: 'glm-fixture' });
  assert.deepEqual(known, { available: true, provider: 'zai', model: 'glm-fixture', level: 'model', remoteVerified: false });
  const unknown = await adapter.checkModelRoute({ provider: 'zai', model: 'not-configured-fixture' });
  assert.equal(unknown.available, false); assert.equal(unknown.code, 'HOST_MODEL_UNAVAILABLE'); assert.equal(unknown.causeCode, 'UNKNOWN_MODEL');
  const invalidControl = await adapter.checkModelRoute({ provider: 'zai', model: 'glm-fixture', reasoningEffort: 'not-configured-effort' });
  assert.equal(invalidControl.available, false); assert.equal(invalidControl.causeCode, 'UNSUPPORTED_REASONING_EFFORT');
  assert.equal(networkCalls, 0); assert.equal(h.calls.length, 0);
  await pi.dispose();
  assert.equal((await adapter.checkModelRoute({ provider: 'zai', model: 'glm-fixture' })).causeCode, 'NO_ADAPTER');
});

test('dynamic adapters remain explicitly provider-level and unlisted model IDs are not rejected by an advisory catalog', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  let catalogCalls = 0, modelLookups = 0;
  class Dynamic extends LlmAdapter {
    listModels() { catalogCalls++; throw new Error('Remote catalog must not be consulted for scheduling.'); }
    resolveModel() { modelLookups++; throw new Error('Dynamic model metadata might contact the remote account.'); }
    async *stream() { throw new Error('No provider stream is permitted.'); }
  }
  h.ctx.llm.registerAdapter(['dynamic-account'], new Dynamic());
  h.ctx.llm.registerConfigurableProviders([{ provider: 'dynamic-account', displayName: 'Dynamic fixture', settingsNs: 'llm-deepseek-account', settingsPath: [] }]);
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  assert.deepEqual(await adapter.checkModelRoute({ provider: 'dynamic-account', model: 'unlisted-but-routable' }), { available: true, provider: 'dynamic-account', model: 'unlisted-but-routable', level: 'provider', remoteVerified: false });
  assert.equal((await adapter.checkModelRoute({ provider: 'dynamic-account', model: '' })).causeCode, 'MODEL_UNCONFIGURED');
  assert.equal(catalogCalls, 0); assert.equal(modelLookups, 0); assert.equal(h.calls.length, 0);
  const stop = new AbortController(); stop.abort(new Error('Cancelled capability check'));
  await assert.rejects(adapter.checkModelRoute({ provider: 'dynamic-account', model: 'x' }, { signal: stop.signal }), /Cancelled capability check/);
});

test('a missing host provider defers before role creation, reservations or provider request accounting', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  let planned = 0, created = 0, reservations = 0;
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'zai', model: 'glm-fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'No matching host route.',
    onSessionPlanned: () => planned++, onCreated: () => created++, onRequest: () => reservations++ });
  assert.equal(result.status, 'deferred'); assert.equal(result.error.code, 'HOST_MODEL_UNAVAILABLE'); assert.equal(result.error.causeCode, 'NO_ADAPTER');
  assert.equal(planned, 0); assert.equal(created, 0); assert.equal(reservations, 0); assert.equal(result.steps, 0);
  assert.deepEqual(result.requests, []); assert.deepEqual(result.usage, []); assert.equal(h.calls.length, 0);
  assert.equal(h.ctx.agents.list().length, 0); assert.equal(await h.ctx.sessionPersistence.stat(result.sessionId), undefined);
});

test('a route removed after role creation still defers before its first reservation or outbound dispatch', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close());
  class NeverCalled extends LlmAdapter { async *stream() { throw new Error('Provider must never be called.'); } }
  const remove = h.ctx.llm.registerAdapter(['vanishing'], new NeverCalled());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close()); let reservations = 0;
  const result = await adapter.runRole({ role: 'reviewer', model: { provider: 'vanishing', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Test the registration race.',
    onCreated: () => remove(), onRequest: () => reservations++ });
  assert.equal(result.status, 'deferred'); assert.equal(result.error.causeCode, 'NO_ADAPTER'); assert.equal(reservations, 0);
  assert.deepEqual(result.requests, []); assert.deepEqual(result.usage, []); assert.equal(h.calls.length, 0);
  const log = await adapter.readSession(result.sessionId);
  assert.equal(log.events.filter(e => e.type === 'assistant/message' && e.data.usage).length, 0);
});

test('route loss after a real request keeps actual usage and does not masquerade as an unstarted deferral', async t => {
  const h = await harness(() => text({ done: true })); t.after(() => h.close()); let remove, actualCalls = 0, reservations = 0;
  class OneCall extends LlmAdapter {
    async *stream() {
      actualCalls++;
      yield { type: 'block-start', index: 0, blockType: 'tool-call' };
      yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'one-read', name: 'memory_read', arguments: '{}' } };
      yield { type: 'usage', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } };
      remove(); yield { type: 'finish', reason: { kind: 'tool-calls' } };
    }
  }
  remove = h.ctx.llm.registerAdapter(['one-request'], new OneCall());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'one-request', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Keep real accounting.',
    tools: [tool('memory_read', () => ({ records: [] }))], onRequest: () => reservations++ });
  assert.equal(result.status, 'failed'); assert.equal(result.error.code, 'HOST_MODEL_UNAVAILABLE');
  assert.equal(actualCalls, 1); assert.equal(reservations, 1); assert.equal(result.requests.length, 1); assert.equal(result.usage.length, 1); assert.equal(result.usage[0].totalTokens, 15);
});
