import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import { harness, text } from './fixtures/harness.mjs';
import { apply, globalStateFor, stateFor } from '../lib/index.js';
import { workspaceIdentity } from '../src/identity.js';

// The legacy `models` field of /global and /state must keep its exact shape,
// but the memory page polls those endpoints every 15 seconds and each read
// used to re-enumerate every provider catalog sequentially (network I/O on
// real adapters). These checks pin the caching boundary without slowing the
// suite: providers are counted, not delayed.
async function setup(t) {
  const h = await harness(() => text('Fixture acknowledgement.'));
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') });
  clearInterval(c.timer);
  t.after(async () => { await c.close(); await h.close(); });
  return { h, c };
}

test('repeated state reads within the TTL do not re-enumerate provider catalogs', async t => {
  const { h, c } = await setup(t);
  let providerCalls = 0, modelCalls = 0;
  h.ctx.llm.listProviders = () => { providerCalls++; return [{ id: 'p1' }, { id: 'p2' }]; };
  h.ctx.llm.listModels = async provider => { modelCalls++; return provider === 'p1' ? [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }] : [{ id: 'c', name: 'C' }]; };
  const first = await globalStateFor(c);
  assert.deepEqual(first.models, [{ provider: 'p1', model: 'a', label: 'A' }, { provider: 'p1', model: 'b', label: 'B' }, { provider: 'p2', model: 'c', label: 'C' }]);
  assert.equal(modelCalls, 2);
  for (let i = 0; i < 5; i++) assert.deepEqual((await globalStateFor(c)).models, first.models);
  assert.equal(modelCalls, 2, 'Polling reads must be served from the cache; only one enumeration per TTL window');
  assert.ok(providerCalls > 1, 'Provider presence is still rechecked on every read');
});

test('state responses share the same cached enumeration as global responses', async t => {
  const { h, c } = await setup(t);
  const root = path.join(h.temp, 'routes-project'); mkdirSync(root);
  const workspace = workspaceIdentity(root);
  c.store.registerWorkspace(workspace);
  let modelCalls = 0;
  h.ctx.llm.listProviders = () => [{ id: 'only' }];
  h.ctx.llm.listModels = async () => { modelCalls++; return [{ id: 'm', name: 'M' }]; };
  assert.deepEqual((await globalStateFor(c)).models, [{ provider: 'only', model: 'm', label: 'M' }]);
  assert.deepEqual((await stateFor(c, { workspaceId: workspace.id })).models, [{ provider: 'only', model: 'm', label: 'M' }]);
  assert.equal(modelCalls, 1);
});

test('a changed provider list invalidates the cache immediately and expiry refetches', async t => {
  const { h, c } = await setup(t);
  let modelCalls = 0;
  const providersFor = () => [{ id: 'p1' }, { id: 'p2' }];
  h.ctx.llm.listProviders = providersFor;
  h.ctx.llm.listModels = async provider => { modelCalls++; return [{ id: provider + '-m', name: provider }]; };
  await globalStateFor(c);
  assert.equal(modelCalls, 2);
  h.ctx.llm.listProviders = () => [...providersFor(), { id: 'p3' }];
  const grown = await globalStateFor(c);
  assert.equal(grown.models.length, 3);
  assert.equal(modelCalls, 5, 'A changed provider list invalidates the whole cache immediately');
  c._modelRoutesCache = { ...c._modelRoutesCache, at: 0 };
  await globalStateFor(c);
  assert.equal(modelCalls, 8, 'After the TTL the whole catalog is enumerated again');
});

test('unavailable provider catalogs stay empty and stop stretching every read', async t => {
  const { h, c } = await setup(t);
  let modelCalls = 0;
  h.ctx.llm.listProviders = () => [{ id: 'broken' }, { id: 'fine' }];
  h.ctx.llm.listModels = async provider => { modelCalls++; if (provider === 'broken') throw new Error('catalog offline'); return [{ id: 'ok', name: 'Ok' }]; };
  const first = await globalStateFor(c);
  assert.deepEqual(first.models, [{ provider: 'fine', model: 'ok', label: 'Ok' }]);
  assert.deepEqual((await globalStateFor(c)).models, first.models);
  assert.equal(modelCalls, 2, 'A degraded catalog is not retried on every poll within the TTL');
});

test('concurrent cold reads share one enumeration', async t => {
  const { h, c } = await setup(t);
  let release; const gate = new Promise(resolve => { release = resolve; });
  let calls = 0;
  h.ctx.llm.listProviders = () => [{ id: 'a' }, { id: 'b' }];
  h.ctx.llm.listModels = async () => { calls++; await gate; return [{ id: 'm', name: 'M' }]; };
  const first = globalStateFor(c), second = globalStateFor(c);
  await new Promise(resolve => setImmediate(resolve));
  release();
  const [x, y] = await Promise.all([first, second]);
  assert.deepEqual(x.models, [{ provider: 'a', model: 'm', label: 'M' }, { provider: 'b', model: 'm', label: 'M' }]);
  assert.deepEqual(y.models, x.models);
  assert.equal(calls, 2, 'Concurrent readers must share a single enumeration (one catalog read per provider)');
});

test('a stale enumeration cannot overwrite a newer provider list cache entry', async t => {
  const { h, c } = await setup(t);
  let providers = ['slow'], calls = { slow: 0, fast: 0 }, resolveSlow;
  const slow = new Promise(resolve => { resolveSlow = resolve; });
  h.ctx.llm.listProviders = () => providers.map(id => ({ id }));
  h.ctx.llm.listModels = async provider => { calls[provider]++; if (provider === 'slow') return await slow; return [{ id: 'fast-m', name: 'FastM' }]; };
  const first = globalStateFor(c); // starts the 'slow' enumeration
  providers = ['fast'];           // the provider list changes mid-flight
  const second = await globalStateFor(c);
  assert.deepEqual(second.models, [{ provider: 'fast', model: 'fast-m', label: 'FastM' }]);
  resolveSlow([{ id: 'slow-m', name: 'SlowM' }]); // the old enumeration completes last
  assert.deepEqual((await first).models, [{ provider: 'slow', model: 'slow-m', label: 'SlowM' }]);
  assert.equal(c._modelRoutesCache.key, 'fast');
  const third = await globalStateFor(c);
  assert.deepEqual(third.models, second.models);
  assert.equal(calls.fast, 1, 'A stale completion must not invalidate or replace the newer provider list entry');
  assert.equal(calls.slow, 1);
});

test('a hung provider listing is bounded and recovers after the TTL', async t => {
  const { h, c } = await setup(t);
  c._modelRoutesFetchTimeoutMs = 30;
  let hung = true;
  h.ctx.llm.listProviders = () => [{ id: 'hung' }, { id: 'fine' }];
  h.ctx.llm.listModels = async provider => { if (provider === 'hung' && hung) return new Promise(() => {}); return [{ id: provider + '-m', name: provider }]; };
  const started = Date.now();
  const state = await globalStateFor(c);
  assert.ok(Date.now() - started < 2000, 'A hung catalog listing must not hang state reads');
  assert.deepEqual(state.models, [{ provider: 'fine', model: 'fine-m', label: 'fine' }]);
  assert.deepEqual((await globalStateFor(c)).models, state.models, 'The bounded empty result is cached for the same window');
  hung = false;
  c._modelRoutesCache = { ...c._modelRoutesCache, at: 0 };
  assert.deepEqual((await globalStateFor(c)).models.map(m => m.provider), ['hung', 'fine'], 'A recovered provider is enumerated again after the TTL');
});
