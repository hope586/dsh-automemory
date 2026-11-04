import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createNativeModelCatalog, modelRouteKey, catalogChoices, chooseCatalogModel, chooseCatalogEffort } from '../src/model-picker.js';
import { SettingsStore } from '../src/settings.js';

const catalog = { groups: [
  { id: 'provider-a', name: 'Provider A', models: [{ id: 'shared-model', name: 'Model A', reasoning: { defaultEffort: 'high', efforts: [{ id: 'low', name: 'Low' }, { id: 'high', name: 'High' }] } }] },
  { id: 'provider-b', name: 'Provider B', models: [{ id: 'shared-model', name: 'Model B' }, { id: 'other/model', name: 'Other', reasoning: { efforts: [{ id: 'custom', name: 'Custom' }] } }] },
], failures: [] };
const reply = value => ({ ok: true, value });
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };

test('native catalog loads once for all roles and never selects a conversation model', async () => {
  let reads = 0;
  const store = createNativeModelCatalog(async () => { reads++; return reply(catalog); });
  assert.equal(reads, 0);
  const loads = await Promise.all([store.load(), store.load(), store.load()]);
  assert.equal(reads, 1); assert.ok(loads.every(value => value === catalog));
  await store.load(); assert.equal(reads, 1);
  assert.equal(store.getSnapshot().status, 'ready');
  store.dispose();
});

test('host replacement clears old choices and ignores the prior hosts late response', async () => {
  const old = deferred(), next = deferred(); let reads = 0;
  const store = createNativeModelCatalog(() => ++reads === 1 ? old.promise : next.promise);
  const first = store.load(); await Promise.resolve();
  const second = store.refresh(true); await Promise.resolve();
  assert.equal(store.getSnapshot().value, null);
  const replacement = {groups:[],failures:[]}; next.resolve(reply(replacement)); await second;
  old.resolve(reply(catalog)); await first;
  assert.equal(store.getSnapshot().value, replacement);
  store.dispose();
});

test('provider-local failure retains working groups and whole-request errors can retry', async () => {
  const partial = { ...catalog, failures:[{id:'offline',name:'Offline',message:'Unavailable'}] };
  let fail = false;
  const store = createNativeModelCatalog(async () => fail ? {ok:false,error:{message:'Disconnected'}} : reply(partial));
  await store.load(); assert.equal(catalogChoices(store.getSnapshot().value).length,3);
  assert.equal(store.getSnapshot().value.failures.length,1);
  fail=true; await assert.rejects(store.refresh(), /Disconnected/);
  assert.equal(store.getSnapshot().status,'error'); assert.equal(store.getSnapshot().value,partial);
  fail=false; await store.load(); assert.equal(store.getSnapshot().status,'ready');
  store.dispose();
});

test('disposing a catalog prevents late notifications', async () => {
  const request = deferred(), store=createNativeModelCatalog(() => request.promise);
  let notifications=0; store.subscribe(() => notifications++);
  const load=store.load(); store.dispose(); const before=notifications;
  request.resolve(reply(catalog)); await load;
  assert.equal(notifications,before);
});

test('same model id from different providers selects its exact route and resets incompatible effort', () => {
  const old={provider:'provider-a',model:'shared-model',reasoningEffort:'low'};
  assert.deepEqual(chooseCatalogModel(catalog,modelRouteKey(old),old),old);
  const changed=chooseCatalogModel(catalog,modelRouteKey({provider:'provider-b',model:'shared-model'}),old);
  assert.deepEqual(changed,{provider:'provider-b',model:'shared-model'});
  assert.deepEqual(chooseCatalogModel(catalog,modelRouteKey(old),changed),{...old,reasoningEffort:'high'});
  assert.throws(() => chooseCatalogModel(catalog,'unknown',old));
});

test('G2 has an explicit follow-session route and other roles cannot select it', () => {
  assert.equal(chooseCatalogModel(catalog,'follow-session',{provider:'provider-a',model:'shared-model'},true),null);
  assert.throws(() => chooseCatalogModel(catalog,'follow-session',null));
});

test('effort choices come from the exact model and provider defaults remove an override', () => {
  const route={provider:'provider-b',model:'other/model',reasoningEffort:'custom'};
  assert.deepEqual(chooseCatalogEffort(catalog,route,undefined),{provider:'provider-b',model:'other/model'});
  assert.deepEqual(chooseCatalogEffort(catalog,route,'custom'),route);
  assert.throws(() => chooseCatalogEffort(catalog,route,'high'));
  assert.throws(() => chooseCatalogEffort(catalog,{provider:'provider-b',model:'shared-model'},'custom'));
});

test('chosen routes survive settings persistence including unavailable saved routes and G2 follow', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'automemory-model-picker-')); let settings=new SettingsStore(dir);
  try {
    const old={provider:'another-host',model:'custom-model',reasoningEffort:'custom-level'};
    const manager=chooseCatalogModel(catalog,modelRouteKey({provider:'provider-a',model:'shared-model'}),old);
    settings.set({models:{manager:chooseCatalogEffort(catalog,manager,'low'),g2:null,dreamer:old}});
    settings.close(); settings=new SettingsStore(dir);
    assert.deepEqual(settings.get().models.manager,{provider:'provider-a',model:'shared-model',reasoningEffort:'low'});
    assert.deepEqual(settings.get().models.dreamer,old); assert.equal(settings.get().models.g2,null);
  } finally {settings.close();fs.rmSync(dir,{recursive:true,force:true});}
});
