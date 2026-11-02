import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply, actionFor, stateFor, trustedOrigin } from '../lib/index.js';
const draft = { audit_completion:'complete', explanation:'fixture user decision', operations:[{op:'CREATE',operation_key:'create',local_key:'constraint',reason:'User specified a project constraint',source_refs:[{source_kind:'session_event',locator:'parent#event:1'}],content:{title:'Fixture constraint',category:'stable',index_hint:'Read before changing storage',group:'architecture',conditions:'Only this project',payload:{kind:'markdown',text:'Use SQLite for this project.'}}}],issues:[] };
const noop = {audit_completion:'complete',explanation:'No additional change',operations:[],issues:[]};
test('native Node request normalization accepts its real browser origin and rejects foreign origins',()=>{
 assert.equal(trustedOrigin(new Request('http://dsh.internal/api/dsh-automemory/action',{headers:{host:'127.0.0.1:3080',origin:'http://127.0.0.1:3080'}})),true);
 assert.equal(trustedOrigin(new Request('http://dsh.internal/api/dsh-automemory/action',{headers:{host:'127.0.0.1:3080',origin:'https://attacker.example'}})),false);
});
async function setup(t, respond) {
 const h=await harness(respond);const c=apply(h.ctx,{dshHome:path.join(h.temp,'memory-home'),dataDir:path.join(h.temp,'memory-home','automemory')});clearInterval(c.timer);
 t.after(()=>h.close());return {h,c};
}
test('main G1 tool really commits, next native session recalls, and project disable persists',async t=>{
 let step=0;const {h,c}=await setup(t,()=>++step===1?call('memory_submit',{draft},'save-1'):text('done'));
 const a=await h.agent();a.followup(message('Remember this project must use SQLite.'));await a.whenIdle();
 const state=await stateFor(c,a.id);assert.equal(state.memories.length,1,JSON.stringify(c.errors));
 const b=await h.agent('other');b.followup(message('Continue the project','continue'));await b.whenIdle();
 const sent=h.calls.find(x=>x.sessionId==='other');assert.match(JSON.stringify(sent.messages),/Fixture constraint/);
 assert.equal((await actionFor(c,{sessionId:a.id,action:'project-toggle',enabled:false})).status,'committed');
 assert.equal((await stateFor(c,b.id)).workspace.enabled,false);
});
test('G2 tool returns durable acceptance and the real background loop completes with exact context',async t=>{
 let main=0;const {h,c}=await setup(t,options=>options.sessionId==='parent'?(++main===1?call('memory_audit',{reason:'stage finished'},'audit-1'):text('FUTURE_PARENT_REPLY')):text(noop));
 const a=await h.agent();a.followup(message('CURRENT_STAGE_EVIDENCE'));await a.whenIdle();
 const w=c.bind(a.session);const jobs=c.store.listJobs({workspaceId:w.id});assert.equal(jobs.length,1,JSON.stringify(c.errors));assert.equal(jobs[0].status,'queued');
 await c.tick();await c.active;
 const final=c.store.getJob(jobs[0].id);assert.equal(final.status,'completed',JSON.stringify({final,errors:c.errors}));
 const audit=h.calls.find(x=>x.sessionId.startsWith('automemory-g2-'));assert.ok(audit);assert.match(JSON.stringify(audit.messages),/CURRENT_STAGE_EVIDENCE/);assert.doesNotMatch(JSON.stringify(audit.messages),/FUTURE_PARENT_REPLY/);
});
test('manual Dreamer runs candidate, one independent reviewer and final revision, producing committed activity',async t=>{
 let dreamer=0;const {h,c}=await setup(t,options=>{
   if(options.sessionId==='parent')return text('work finished');
   if(options.sessionId.startsWith('automemory-reviewer-')){
     const input=options.messages.map(m=>m.content?.map(x=>x.text||'').join('')).join('\n');
     const id=input.match(/"candidate_id":"([a-f0-9]+)"/)?.[1];assert.ok(id);return text({candidate_id:id,findings:[],checked_sources:[],limitations:[]});
   }
   dreamer++;return text(draft);
 });
 c.settings.set({models:{dreamer:{provider:'fixture',model:'dream'},reviewer:{provider:'fixture',model:'review'}}});
 const a=await h.agent();a.followup(message('This project should use SQLite.'));await a.whenIdle();
 const receipt=await actionFor(c,{sessionId:a.id,action:'dream'});assert.equal(receipt.status,'accepted');
 await c.tick();await c.active;
 const state=await stateFor(c,a.id);assert.equal(state.jobs[0].status,'completed',JSON.stringify({jobs:state.jobs,errors:c.errors}));
 assert.equal(dreamer,2);assert.equal(h.calls.filter(x=>x.sessionId.startsWith('automemory-reviewer-')).length,1);assert.equal(state.memories.length,1);assert.equal(state.activity.length,1);
});
