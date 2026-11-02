import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { harness, message, call, text } from '../test/fixtures/harness.mjs';
import { unpackOwnPackage } from './package-utils.mjs';

const archive = await unpackOwnPackage({ nearDependencies: true });
const plugin = await import(pathToFileURL(path.join(archive.packageRoot, 'lib/index.js')).href);
const draft = title => ({ audit_completion:'complete', explanation:'Synthetic package smoke request', operations:[{op:'CREATE',operation_key:'create',local_key:'constraint',reason:'Synthetic user decision',source_refs:[{source_kind:'audit_artifact',locator:'package-fixture'}],content:{title,category:'stable',index_hint:'Read before changing storage',group:'architecture',conditions:'Only this synthetic project',payload:{kind:'markdown',text:'Use SQLite for the synthetic project.'}}}],issues:[] });
let mainStep = 0, managerStep = 0, controller, fiber;
const h = await harness(options => {
  if (options.sessionId.startsWith('automemory-manager-')) return ++managerStep === 1 ? call('memory_submit', { draft:draft('Package manager decision') }, 'manager-save') : text('Manager commit checked.');
  return ++mainStep === 1 ? call('memory_submit', { draft:draft('Package project decision') }, 'main-save') : text('Done.');
});
const home = path.join(h.temp, 'memory-home');
const load = async () => {
  fiber = h.ctx.plugin({ name:'package-smoke', inject:plugin.inject, apply(ctx) {
    controller = plugin.apply(ctx, {dshHome:home,dataDir:path.join(home,'automemory')}); clearInterval(controller.timer);
  }});
  await fiber;
};
try {
  await load();
  const first = await h.agent('parent'); first.followup(message('Remember the synthetic project must use SQLite.')); await first.whenIdle();
  const before = await plugin.stateFor(controller, first.id); assert.equal(before.memories.length,1);
  const second = await h.agent('next-session'); second.followup(message('Continue the synthetic project.', 'continue')); await second.whenIdle();
  assert.match(JSON.stringify(h.calls.find(c=>c.sessionId==='next-session').messages), /Package project decision/);
  controller.settings.set({ models:{manager:{provider:'fixture',model:'fixture-model'}} });
  const visit = await plugin.actionFor(controller,{action:'manager-open',scope:'project',workspaceId:before.workspace.id});
  await plugin.actionFor(controller,{action:'manager-send',conversationId:visit.id,text:'Record the package manager decision.',requestId:'package-manager-request'});
  await controller.management.conversations.get(visit.id).active;
  const result = controller.management.get({conversationId:visit.id}); assert.equal(result.error,undefined); assert.equal(result.status,'ready');
  assert.equal((await plugin.stateFor(controller, first.id)).memories.length,2);
  const observed = await h.ctx.sessionQuery.observeSession(result.diagnostics.nativeSessionId,{projectionMode:'none'});
  try { assert.equal(observed.header.origin,'subagent'); assert.ok(observed.events.some(e=>e.type==='tool/result')); }
  finally { observed[Symbol.dispose](); }
  await fiber.dispose(); assert.equal(h.ctx.tools.get('memory_submit',first),undefined);
  await load(); assert.equal((await plugin.stateFor(controller,first.id)).memories.length,2,'Unloading must retain formal data');
  await plugin.actionFor(controller,{action:'project-toggle',sessionId:first.id,enabled:false});
  const disabled = await h.agent('disabled-session'); disabled.followup(message('Memory is off.', 'disabled')); await disabled.whenIdle();
  assert.doesNotMatch(JSON.stringify(h.calls.find(c=>c.sessionId==='disabled-session').messages),/project-memory-index/);
  console.log(`Archive smoke passed: ${archive.manifest.version}; native record, next-session recall, manager commit/log, unload/reload persistence and project-off behavior. External model calls: 0.`);
} finally { await fiber?.dispose(); await h.close(); await archive.cleanup(); }
