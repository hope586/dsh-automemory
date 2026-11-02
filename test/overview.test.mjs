import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/core/index.js';
import { getOverview, updateOverview } from '../src/overview.js';
function fixture(t) {
 const dataDir=mkdtempSync(path.join(os.tmpdir(),'memory-overview-'));const store=new MemoryStore({dataDir});
 store.registerWorkspace({id:'W',root:dataDir});t.after(()=>{store.close();rmSync(dataDir,{recursive:true,force:true});});return store;
}
const content=text=>({title:'Database decision',category:'stable',group:'Architecture',index_hint:'Database choice',conditions:'This project only',payload:{kind:'markdown',text}});
const draft=operations=>({audit_completion:'complete',explanation:'User decision',operations,issues:[]});
const source=[{source_kind:'session_event',locator:'manager:user-request:1'}];
function seed(store) {const receipt=store.submit(draft([{op:'CREATE',operation_key:'one',local_key:'one',reason:'User specified',source_refs:source,content:content('Use PostgreSQL')}]),{workspaceId:'W',requestId:'seed',channel:'MEMORY_UI'});return receipt.results[0].memory_id;}

test('human overview remains readable when automation is off; direct agents remain disabled',t=>{
 const store=fixture(t),id=seed(store);store.setWorkspaceEnabled('W',false);
 const view=getOverview(store,'W');assert.equal(view.memoryCount,1);assert.match(view.topics[0].summary,/Use PostgreSQL/);
 assert.throws(()=>store.read({workspaceId:'W',ids:[id]}),{code:'WORKSPACE_DISABLED'});
 assert.equal(store.read({workspaceId:'W',ids:[id],forManagement:true})[0].outcome,'found');
 const changed=store.submit(draft([{op:'UPDATE',target_id:id,expected_version:'v1',operation_key:'update',reason:'Explicit user correction',source_refs:source,content:content('Use SQLite')}]),{workspaceId:'W',requestId:'update',channel:'MEMORY_UI'});
 assert.equal(changed.status,'committed');assert.match(getOverview(store,'W').topics[0].summary,/Use SQLite/);
 assert.equal(store.getWorkspace('W').enabled,false);
});

test('topic organization is complete, project-bound and CAS protected; changed facts invalidate prose',t=>{
 const store=fixture(t),id=seed(store),v=getOverview(store,'W');
 const layout={workspaceId:'W',expectedRevision:v.revision,summary:'Uses PostgreSQL.',topics:[{id:'database',title:'Database',summary:'PostgreSQL decision.',memoryIds:[id]}]};
 assert.throws(()=>updateOverview(store,{...layout,topics:[{...layout.topics[0],memoryIds:['foreign'] }]}),{code:'SOURCE_SCOPE_MISMATCH'});
 assert.throws(()=>updateOverview(store,{...layout,topics:[]}),{code:'INVALID_OVERVIEW'});
 assert.equal(updateOverview(store,layout).status,'committed');
 assert.throws(()=>updateOverview(store,layout),{code:'VERSION_CONFLICT'});
 assert.equal(getOverview(store,'W').summary,'Uses PostgreSQL.');
 store.submit(draft([{op:'UPDATE',target_id:id,expected_version:'v1',operation_key:'update',reason:'Correction',source_refs:source,content:content('Use SQLite')}]),{workspaceId:'W',requestId:'update',channel:'MEMORY_UI'});
 const fresh=getOverview(store,'W');assert.equal(fresh.topics[0].title,'Database');assert.match(fresh.topics[0].summary,/Use SQLite/);assert.doesNotMatch(fresh.summary,/Uses PostgreSQL/);
 const activity=store.listActivity({workspaceId:'W',channel:'ALL'}).find(a=>a.request_id==='update');assert.match(activity.detail.changes[0].after.content.payload.text,/SQLite/);
});

test('automatic Dreamer preference is independent from project use and human read access',t=>{
 const store=fixture(t);seed(store);store.setAutomaticDream('W',false);
 assert.equal(store.getWorkspace('W').enabled,true);assert.equal(store.getWorkspace('W').automatic_dream,0);
 assert.equal(getOverview(store,'W').memoryCount,1);store.setAutomaticDream('W',true);assert.equal(store.getWorkspace('W').automatic_dream,1);
});
