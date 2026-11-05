#!/usr/bin/env node
/** Reproducible hot-path benchmarks for the numbers in docs/review-2026-11-05.md.
 *
 * Usage (Node 22):
 *   node scripts/bench.mjs            # core + models
 *   node scripts/bench.mjs core       # MemoryStore read/write hot paths (source tree)
 *   node scripts/bench.mjs models     # model-route enumeration for /global and /state
 *                                     # (uses lib/; run `node scripts/build.mjs` first)
 *
 * Options:
 *   --memories N   memories in the core fixture (default 300)
 *   --issues N     open issues in the core fixture (default 40)
 *   --providers N  stubbed providers for the models fixture (default 5)
 *   --delay-ms N   per-provider listModels latency (default 15)
 *   --warm N       warm state reads to average (default 20)
 *
 * Everything runs in a throwaway temp directory with a stubbed llm service; no
 * network, no API keys, no real DSH_HOME. Compare two revisions by checking
 * each one out, running the same command, and comparing the printed metrics.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/core/index.js';

const argv = process.argv.slice(2);
const flag = (name, fallback) => { const index = argv.indexOf(name); const value = index >= 0 ? Number(argv[index + 1]) : NaN; return Number.isFinite(value) ? value : fallback; };
const mode = argv.find(value => !value.startsWith('--')) || 'all';
const ms = ns => Number(ns) / 1e6;
const timed = (label, unit, fn, repeats) => {
  fn();
  const start = process.hrtime.bigint();
  for (let i = 0; i < repeats; i++) fn();
  const value = ms(process.hrtime.bigint() - start) / repeats;
  console.log(`${label}: ${value.toFixed(3)} ${unit} (repeats=${repeats})`);
  return value;
};

function coreBench() {
  const memories = flag('--memories', 300), issues = flag('--issues', 40);
  const dir = mkdtempSync(path.join(os.tmpdir(), 'automemory-bench-core-'));
  try {
    const store = new MemoryStore({ dataDir: dir });
    store.registerWorkspace({ id: 'w', root: dir });
    store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
    const content = i => ({ title: `Fact ${i}`, category: 'stable', index_hint: `Hint ${i}`, group: `G${i % 10}`, conditions: 'benchmark fixture', payload: { kind: 'markdown', text: `Body ${i} `.repeat(20) } });
    const sources = [{ source_kind: 'session_event', locator: 's#event:1' }];
    const draft = { audit_completion: 'complete', explanation: 'bench', operations: [], issues: [] };
    for (let batch = 0; batch * 40 < memories; batch++) {
      const operations = [];
      for (let i = 0; i < 40 && batch * 40 + i < memories; i++) {
        const key = `k${batch}_${i}`;
        operations.push({ op: 'CREATE', operation_key: key, local_key: key, reason: 'bench', source_refs: sources, content: content(batch * 40 + i) });
      }
      const receipt = store.submit({ ...draft, operations }, { workspaceId: 'w', requestId: `bench-${batch}`, channel: 'G1' });
      if (receipt.status !== 'committed') throw new Error(`setup failed: ${JSON.stringify(receipt.errors)}`);
    }
    const ids = store.browse({ workspaceId: 'w', pageSize: 1000 }).entries.map(entry => entry.id);
    for (let i = 0; i + 1 < issues * 2; i += 2) {
      const receipt = store.submit({ ...draft, operations: [], issues: [{ issue_key: `ik${i}`, question: `q${i}`, context: 'bench', affected: [{ memory_id: ids[i], observed_version: 'v1' }, { memory_id: ids[i + 1], observed_version: 'v1' }], source_refs: sources }] }, { workspaceId: 'w', requestId: `issue-${i}`, channel: 'G1' });
      if (receipt.status !== 'committed') throw new Error(`issue setup failed: ${JSON.stringify(receipt.errors)}`);
    }
    store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'warm' });
    console.log(`core fixture: ${ids.length} memories, ${issues} open issues (2 affected memories each)`);
    timed('core/browse[pageSize=1000]', 'ms/op', () => store.browse({ workspaceId: 'w', pageSize: 1000 }), 20);
    let serial = 0;
    timed('core/prepareTurn[index re-render]', 'ms/op', () => {
      store.db.exec("UPDATE workspaces SET revision=revision+1 WHERE id='w'");
      store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'render' + serial++ });
    }, 5);
    store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 5, eventOnly: true });
    timed('core/updateSessionHead[stale duplicate x1000]', 'ms/1000 events', () => {
      for (let i = 0; i < 1000; i++) store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 5, eventOnly: true });
    }, 3);
    store.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

async function modelsBench() {
  const providers = flag('--providers', 5), delayMs = flag('--delay-ms', 15), warm = flag('--warm', 20);
  const { harness, text } = await import('../test/fixtures/harness.mjs');
  // The plugin entry bundles Markdown prompts via esbuild, so this path uses
  // the built lib. Run `node scripts/build.mjs` first; it stays consistent
  // with what the host actually executes.
  const { apply, globalStateFor } = await import('../lib/index.js');
  const h = await harness(() => text('bench'));
  try {
    const home = path.join(h.temp, 'memory-home');
    const controller = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') });
    clearInterval(controller.timer);
    const delay = value => new Promise(resolve => setTimeout(resolve, value));
    let listModelsCalls = 0;
    h.ctx.llm.listProviders = () => Array.from({ length: providers }, (_, i) => ({ id: `p${i}` }));
    h.ctx.llm.listModels = async provider => { listModelsCalls++; await delay(delayMs); return [{ id: `${provider}-m1`, name: `${provider} model 1` }, { id: `${provider}-m2`, name: `${provider} model 2` }]; };
    const cold = [];
    for (let i = 0; i < 5; i++) {
      controller._modelRoutesCache = undefined;
      const start = process.hrtime.bigint();
      const state = await globalStateFor(controller);
      cold.push(ms(process.hrtime.bigint() - start));
      if (state.models.length !== providers * 2) throw new Error('unexpected model count');
    }
    console.log(`models fixture: ${providers} providers x ${delayMs}ms listModels`);
    console.log(`models/cold globalStateFor: ${cold.map(value => value.toFixed(1)).join(', ')} ms (5 runs, parallel enumeration)`);
    controller._modelRoutesCache = undefined;
    await globalStateFor(controller);
    const before = listModelsCalls;
    const start = process.hrtime.bigint();
    for (let i = 0; i < warm; i++) await globalStateFor(controller);
    const average = ms(process.hrtime.bigint() - start) / warm;
    console.log(`models/warm globalStateFor: ${average.toFixed(3)} ms/op (repeats=${warm}); listModels calls during warm window: ${listModelsCalls - before} (cache TTL 30s)`);
    await controller.close();
  } finally { await h.close(); }
}

if (mode === 'core' || mode === 'all') coreBench();
if (mode === 'models' || mode === 'all') await modelsBench();
