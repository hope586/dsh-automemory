import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, readFile, symlink, mkdtemp, rm, mkdir, readdir, stat, realpath, open } from 'node:fs/promises';
import vm from 'node:vm';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { harness, message, tool, call, text } from './fixtures/harness.mjs';
import { createHostAdapter, installTurnMemory, createReadOnlyGuard } from '../src/host/index.js';
import SubagentRuntime from '@deepseek-ai/dsh-subagent';
import TeamService from '@deepseek-ai/dsh-experimental-agent-team';
import * as TeamTools from '@deepseek-ai/dsh-experimental-tool-agent-team';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import LocalFileSystem from '@deepseek-ai/dsh-fs-local';

// Decode what the fixture model actually receives, not the tool's execute value.
function readPage(result) {
  assert.equal(result.isError, false);
  const [header, ...rows] = result.content[0].text.split('\n');
  const metadata = JSON.parse(header);
  const lines = rows.length === 1 && rows[0] === '' ? [] : rows.map(row => {
    const match = row.match(/^L(\d+) column (\d+): ([\s\S]*)$/);
    assert.ok(match, 'A read line must retain its original line number, column and verbatim text');
    return { number: Number(match[1]), column: Number(match[2]), text: match[3] };
  });
  return { ...metadata, lines };
}

test('actual host injects once per turn, multi-step calls reuse it; next turn refreshes',async t=>{
  let stage=0,prepare=0; const delivered=[];
  const h=await harness(()=>++stage===1?call('noop'):text('done'));t.after(()=>h.close());
  h.ctx.tools.register(tool('noop',()=>({ok:true})));
  const stop=installTurnMemory(h.ctx,{prepareTurn:({turnId})=>({bundle_id:turnId,text:`MEMORY:${++prepare}`,provided:[{id:'M1',version:'1'}]}),onProvided:e=>delivered.push(e)});t.after(stop);
  const a=await h.agent();a.followup(message('first'));await a.whenIdle();
  assert.equal(h.calls.length,2);assert.equal(prepare,1);assert.equal(delivered.length,1);
  for(const c of h.calls)assert.equal(c.messages.filter(m=>m.source?.kind==='automemory').length,1);
  a.followup(message('second','p2'));await a.whenIdle();
  assert.equal(prepare,2);assert.equal(delivered.length,2);
});

test('captureG2 during a real tool call preserves current turn and isolates future parent reply',async t=>{
  let captured,parentStep=0;const h=await harness(options=>options.sessionId==='parent'?(++parentStep===1?call('capture'):text('PARENT_FUTURE')):text({audit_completion:'complete',operations:[],issues:[],explanation:'no changes'}));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  h.ctx.tools.register(tool('capture',async(_args,exec)=>{captured=await adapter.captureG2(exec.agent);return {accepted:true};}));
  const a=await h.agent();a.followup(message('CURRENT_TURN_ONLY'));await a.whenIdle();
  assert.ok(captured);assert.equal(captured.route.model,'fixture-model');
  const r=await adapter.runRole({role:'G2',snapshot:captured,workspace:{id:'w1',root:h.temp},prompt:'Audit the captured range.'});
  assert.equal(r.status,'completed',JSON.stringify(r));assert.equal(r.usage.length,1);
  const input=h.calls.find(c=>c.sessionId===r.sessionId);
  assert.match(JSON.stringify(input.messages),/CURRENT_TURN_ONLY/);assert.doesNotMatch(JSON.stringify(input.messages),/PARENT_FUTURE/);
  assert.ok(input.messages.some(m=>m.role==='tool'&&m.isError===true));
  assert.ok(r.snapshot);assert.equal(r.output.audit_completion,'complete');
});

test('independent Reviewer refuses inherited history and starts without Dreamer history',async t=>{
  const h=await harness(()=>text({candidate_id:'c1',findings:[],checked_sources:[],limitations:[]}));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  await assert.rejects(()=>adapter.runRole({role:'reviewer',snapshot:{},workspace:{id:'w',root:h.temp},prompt:'x'}),{code:'REVIEWER_CONTEXT_FORBIDDEN'});
  const r=await adapter.runRole({role:'reviewer',model:{provider:'fixture',model:'review-model'},workspace:{id:'w',root:h.temp},prompt:'Review candidate C1'});
  assert.equal(r.status,'completed',JSON.stringify(r));assert.equal(r.requests[0].model,'review-model');
});

test('background role origin is persisted and the installed official sidebar predicate hides it without inherited reviewer history',async t=>{
  const h=await harness(()=>text({ok:true}));t.after(()=>h.close());const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const ui=await readFile(new URL(import.meta.resolve('@deepseek-ai/dsh-client-ui-workspace/client')),'utf8');
  const officialFunction=ui.match(/function sessionVisible\(session, current, archived, archivedFilter\) \{[\s\S]*?\n\t\t\}/)?.[0];
  assert.ok(officialFunction,'Installed native sidebar predicate must remain inspectable; do not substitute a copied policy');
  const visible=vm.runInNewContext(`(${officialFunction})`,{assertNever$1:()=>{throw new Error('unexpected filter');}});
  const candidate=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'CANDIDATE_PRIVATE_CONTEXT'});
  const review=await adapter.runRole({role:'reviewer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Fresh review'});
  for(const r of [candidate,review]){
    assert.equal(r.status,'completed',JSON.stringify(r));const header=(await adapter.readSession(r.sessionId)).header;
    assert.equal(header.origin,'subagent');assert.equal(header.parentSession,undefined);assert.equal(header.isSeeded,false);
    assert.equal(visible({id:header.id,origin:header.origin,blank:false},undefined,new Set(),'default'),false);
  }
  assert.equal(visible({id:'ordinary',blank:false},undefined,new Set(),'default'),true);
  assert.doesNotMatch(JSON.stringify(h.calls.find(c=>c.sessionId===review.sessionId).messages),/CANDIDATE_PRIVATE_CONTEXT/);
});

test('Dreamer can continue from its captured candidate history after independent review',async t=>{
  const h=await harness(()=>text({audit_completion:'complete',operations:[],issues:[],explanation:'candidate or final'}));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const candidate=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'dream'},workspace:{id:'w',root:h.temp},prompt:'CANDIDATE_CONTEXT'});
  assert.equal(candidate.status,'completed',JSON.stringify(candidate));
  const final=await adapter.runRole({role:'dreamer',snapshot:candidate.snapshot,workspace:{id:'w',root:h.temp},prompt:'REVIEWER_FEEDBACK'});
  assert.equal(final.status,'completed',JSON.stringify(final));
  const messages=h.calls.find(c=>c.sessionId===final.sessionId).messages;
  assert.match(JSON.stringify(messages),/CANDIDATE_CONTEXT/);assert.match(JSON.stringify(messages),/REVIEWER_FEEDBACK/);
});

test('background role denies shell even when model fabricates forbidden call',async t=>{
  let executed=0,attempt=0;
  const h=await harness(()=>++attempt===1?call('shell'):text({ok:true}));t.after(()=>h.close());
  h.ctx.tools.register(tool('shell',()=>{executed++;return {ok:true};}));
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const result=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Inspect only'});
  assert.equal(result.status,'completed',JSON.stringify(result));assert.equal(executed,0);
  assert.ok(h.calls.every(c=>!c.tools?.some(tool=>tool.name==='shell')));
});

test('hard model-call budget stops looping tools before another outbound request',async t=>{
  const h=await harness(()=>call('memory_read'));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const r=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Inspect',maxSteps:2,tools:[tool('memory_read',()=>({body:'data'}))]});
  assert.equal(r.status,'failed');assert.equal(r.error.code,'ROLE_STEP_BUDGET');assert.equal(h.calls.length,2);
});

test('awaited budget callback can refuse before provider dispatch',async t=>{
  const h=await harness(()=>text({ok:true}));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const r=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Inspect',onRequest:async()=>{await Promise.resolve();throw Object.assign(new Error('budget exhausted'),{code:'BUDGET_EXHAUSTED'});}});
  assert.equal(r.status,'failed');assert.equal(r.error.code,'BUDGET_EXHAUSTED');assert.equal(h.calls.length,0);
});

test('actual preset-free host with Teams exposes usable file tools only to memory roles, including final request headers', async t => {
  const actions = [
    ['read', { file_path: 'notes.txt' }], ['grep', { pattern: 'EVIDENCE', path: 'notes.txt' }],
    ['glob', { pattern: '*.txt', path: 'project-files' }], ['spawn_teammate', { name: 'forbidden', description: 'forbidden', prompt: 'do not run' }],
  ];
  const h = await harness((_options, calls) => calls.length <= actions.length ? call(...actions[calls.length - 1], `c${calls.length}`) : text({ audited: true })); t.after(() => h.close());
  // These are the installed DSH services, not a stub Team schema. Like the
  // desktop role path, no standard Agent preset or global file tools is loaded.
  await h.ctx.plugin(LocalFileSystem, { cwd: h.temp }); await h.ctx.plugin(WorkingDirectory);
  await h.ctx.plugin(SubagentRuntime); await h.ctx.plugin(TeamService); await h.ctx.plugin(TeamTools);
  assert.ok(h.ctx.get('agentTeams'), 'Installed Team service must be active for this reproduction');
  const original = await h.ctx.agents.create({ sessionId: 'legacy-role-shape', agentOptions: { provider: 'fixture', model: 'fixture' }, meta: { cwd: h.temp, origin: 'subagent' },
    setup(ctx) { ctx.tools.restrict({ allow: [] }); ctx.tools.register(tool('memory_read', () => ({ value: 'fixture' }))); } });
  const oldNames = h.ctx.tools.schemas(original.agent).map(tool => tool.name);
  assert.ok(oldNames.includes('spawn_teammate')); assert.ok(oldNames.includes('memory_read'));
  assert.ok(['read', 'grep', 'glob'].every(name => !oldNames.includes(name)));
  await original.dispose();
  await writeFile(path.join(h.temp, 'notes.txt'), 'PROJECT_EVIDENCE_683');
  await mkdir(path.join(h.temp, 'project-files')); await writeFile(path.join(h.temp, 'project-files', 'checked.txt'), 'ok');
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Read current evidence.',
    tools: [tool('memory_read', () => ({ value: 'fixture' })), tool('memory_browse', () => ({ records: [] }))] });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const expected = ['glob', 'grep', 'memory_browse', 'memory_read', 'read'];
  for (const request of h.calls) {
    assert.deepEqual(request.tools.map(tool => tool.name).sort(), expected);
    assert.doesNotMatch(JSON.stringify(request.messages.filter(message => message.role === 'system')), /Agent Teams is available|You are the Team Lead/);
  }
  const results = h.calls.at(-1).messages.filter(message => message.role === 'tool');
  assert.match(JSON.stringify(results[0]), /PROJECT_EVIDENCE_683/); assert.match(JSON.stringify(results[1]), /PROJECT_EVIDENCE_683/);
  assert.match(JSON.stringify(results[2]), /checked\.txt/); assert.equal(results[3].isError, true);
  assert.match(JSON.stringify(results[3]), /cannot execute spawn_teammate/);
  const stored = await adapter.readSession(result.sessionId);
  const headers = stored.events.filter(event => event.type === 'request/header');
  assert.ok(headers.length > 0);
  for (const event of headers) assert.deepEqual(event.data.header.tools.map(tool => tool.name).sort(), expected);
  assert.equal(stored.events.some(event => event.type.startsWith('team/')), false);
});

test('role-local evidence reader paginates long JSONL records without silently losing their suffix', async t => {
  let stage = 0, continuation;
  const h = await harness(options => {
    stage++;
    if (stage === 1) return call('read', { file_path: 'evidence.jsonl' }, 'first');
    if (stage === 2) {
      const result = options.messages.find(message => message.role === 'tool');
      continuation = readPage(result);
      return call('read', { file_path: 'evidence.jsonl', offset: continuation.next_offset, column: continuation.next_column }, 'continue');
    }
    return text({ complete: true });
  }); t.after(() => h.close());
  const source = JSON.stringify({ text: 'x'.repeat(70000) + 'SOURCE_TAIL_379' });
  await writeFile(path.join(h.temp, 'evidence.jsonl'), source);
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'reviewer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Read all the evidence.' });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  assert.equal(continuation.truncated, true); assert.equal(continuation.next_offset, 1); assert.equal(continuation.next_column, 65536);
  const final = readPage(h.calls.at(-1).messages.filter(message => message.role === 'tool').at(-1));
  assert.equal(final.truncated, false); assert.equal(continuation.lines[0].text + final.lines[0].text, source);
});

test('actual read rendering preserves structured page values and verbatim JSONL while reducing escaped wire bytes', async t => {
  const nested = JSON.stringify({ quote: '"quoted"', path: 'C:\\work\\notes', text: '中文来源与决定', literal: '\\n\\t' });
  const sourceLines = [JSON.stringify({ events: Array(100).fill(nested) }), '\tIndented "text" with \\ literal\\n and carriage return\r', '', 'L77 column 88: literal prefix \u2028 🙂'];
  const values = [], dispatched = [];
  const h = await harness(options => {
    const prior = options.messages.filter(message => message.role === 'tool');
    if (!prior.length) return call('read', { file_path: 'source.jsonl', limit: 2 }, 'read-page-1');
    const page = readPage(prior.at(-1));
    if (page.truncated) return call('read', { file_path: 'source.jsonl', offset: page.next_offset, column: page.next_column, limit: 2 }, 'read-page-2');
    return text({ complete: true });
  }); t.after(() => h.close());
  await writeFile(path.join(h.temp, 'source.jsonl'), sourceLines.join('\n'));
  h.ctx.on('tools/result', (exec, result) => {
    if (exec.name !== 'read' || result.isError) return;
    values.push(structuredClone(result.value)); dispatched.push(structuredClone(result.content));
  });
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Read both complete pages of the source.' });
  assert.equal(result.status, 'completed', JSON.stringify(result)); assert.equal(values.length, 2);
  const received = h.calls.at(-1).messages.filter(message => message.role === 'tool');
  const pages = received.map(readPage);
  for (const [index, page] of pages.entries()) {
    assert.deepEqual(page, values[index], 'Rendered output round-trips every field of the actual native structured result');
    assert.deepEqual(received[index].content, dispatched[index], 'The model sees the ToolRuntime-rendered content');
  }
  assert.equal(pages[0].next_offset, 3); assert.equal(pages[0].next_column, 0); assert.equal(pages[1].truncated, false);
  assert.deepEqual(pages.flatMap(page => page.lines.map(line => line.text)), sourceLines);
  const previousBytes = values.reduce((total, value) => total + Buffer.byteLength(JSON.stringify([{ type: 'text', text: JSON.stringify(value) }])), 0);
  const renderedBytes = received.reduce((total, message) => total + Buffer.byteLength(JSON.stringify(message.content)), 0);
  assert.ok(previousBytes - renderedBytes > 500, `JSONL representation should remove redundant escaping (${previousBytes} -> ${renderedBytes} bytes)`);
});

test('preset-free Dreamer, independent Reviewer, and resumed final Dreamer all read the exact supplied evidence through AgentLoop', async t => {
  const evidenceRoot = await mkdtemp(path.join(os.tmpdir(), 'automemory-cycle-evidence-')); t.after(() => rm(evidenceRoot, { recursive: true, force: true }));
  const evidence = path.join(evidenceRoot, 'selected.jsonl'); await writeFile(evidence, JSON.stringify({ user: 'VERIFIED_CYCLE_590' }));
  const counts = new Map();
  const h = await harness(options => {
    const step = (counts.get(options.sessionId) || 0) + 1; counts.set(options.sessionId, step);
    if (step === 1) return call('read', { file_path: evidence }, `${options.sessionId}-read`);
    const source = options.messages.filter(message => message.role === 'tool').at(-1);
    assert.equal(source.isError, false); assert.match(JSON.stringify(source), /VERIFIED_CYCLE_590/);
    return text({ checked_source: 'VERIFIED_CYCLE_590', stage: options.sessionId });
  }); t.after(() => h.close());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const common = { workspace: { id: 'cycle', root: h.temp }, evidencePaths: [evidence], blockedRoots: [evidenceRoot], model: { provider: 'fixture', model: 'fixture' } };
  const candidate = await adapter.runRole({ ...common, role: 'dreamer', sessionId: 'automemory-dreamer-candidate', prompt: 'CANDIDATE_ONLY_CONTEXT: read the selected evidence.' });
  assert.equal(candidate.status, 'completed', JSON.stringify(candidate));
  const reviewer = await adapter.runRole({ ...common, role: 'reviewer', sessionId: 'automemory-reviewer-review', prompt: `Independently check this candidate: ${JSON.stringify(candidate.output)}` });
  assert.equal(reviewer.status, 'completed', JSON.stringify(reviewer));
  const final = await adapter.runRole({ ...common, role: 'dreamer', snapshot: candidate.snapshot, sessionId: 'automemory-dreamer-final', prompt: `FINAL_REVIEW_FEEDBACK: ${JSON.stringify(reviewer.output)}` });
  assert.equal(final.status, 'completed', JSON.stringify(final)); assert.equal(final.output.checked_source, 'VERIFIED_CYCLE_590');
  assert.doesNotMatch(JSON.stringify(h.calls.find(request => request.sessionId === reviewer.sessionId).messages), /CANDIDATE_ONLY_CONTEXT/);
  const finalMessages = JSON.stringify(h.calls.find(request => request.sessionId === final.sessionId).messages);
  assert.match(finalMessages, /CANDIDATE_ONLY_CONTEXT/); assert.match(finalMessages, /FINAL_REVIEW_FEEDBACK/);
  assert.equal(h.calls.length, 6);
});

test('missing promised evidence and removed required schema fail before any model request', async t => {
  const h = await harness(() => { throw new Error('No provider dispatch is permitted.'); }); t.after(() => h.close());
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const input = { role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Inspect evidence.' };
  const absent = await adapter.runRole({ ...input, evidencePaths: [path.join(h.temp, 'missing-evidence.jsonl')] });
  assert.equal(absent.status, 'failed'); assert.equal(absent.error.code, 'INVALID_EVIDENCE_FILE'); assert.match(absent.error.message, /Regenerate/);
  const missing = await adapter.runRole({ ...input, onCreated: ({ agent }) => {
    agent.ctx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembly = await next(); return { ...assembly, tools: assembly.tools.filter(tool => tool.name !== 'read') };
    });
  } });
  assert.equal(missing.status, 'failed'); assert.equal(missing.error.code, 'HOST_CAPABILITY_MISSING'); assert.match(missing.error.message, /read/);
  assert.equal(h.calls.length, 0);
});

test('role-local file tools reject invalid read/search bounds and report oversized evidence without file mutations', async t => {
  const actions = [
    ['read', { file_path: 'safe.txt', limit: -1 }], ['read', { file_path: 'safe.txt', offset: '1' }],
    ['read', { file_path: 'safe.txt', column: 1e12 }], ['grep', { pattern: '', path: 'safe.txt' }],
    ['glob', { pattern: '*'.repeat(257), path: 'safe' }], ['read', { file_path: 'large.txt' }],
  ];
  const h = await harness((_options, calls) => calls.length <= actions.length ? call(...actions[calls.length - 1], `c${calls.length}`) : text({ complete: true })); t.after(() => h.close());
  await mkdir(path.join(h.temp, 'safe')); await writeFile(path.join(h.temp, 'safe.txt'), 'UNCHANGED_448');
  const large = await open(path.join(h.temp, 'large.txt'), 'w');
  try { await large.truncate(32 * 1024 * 1024 + 1); } finally { await large.close(); }
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Check invalid arguments.' });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const results = h.calls.at(-1).messages.filter(message => message.role === 'tool');
  assert.equal(results.length, actions.length); assert.ok(results.every(result => result.isError === true));
  assert.match(JSON.stringify(results.at(-1)), /read limit/);
  assert.equal(await readFile(path.join(h.temp, 'safe.txt'), 'utf8'), 'UNCHANGED_448');
});

test('role-local grep counts skipped binary files toward the total input-byte budget', async t => {
  const actions = [
    ['grep', { pattern: 'SHOULD_NOT_BE_REACHED', path: 'large-binary-tree' }],
    ['grep', { pattern: 'SAFE_TEXT_502', path: 'small-mixed-tree' }],
    ['read', { file_path: 'small-mixed-tree/0.bin' }],
  ];
  const h = await harness((_options, calls) => calls.length <= actions.length ? call(...actions[calls.length - 1], `c${calls.length}`) : text({ complete: true })); t.after(() => h.close());
  const large = path.join(h.temp, 'large-binary-tree'), small = path.join(h.temp, 'small-mixed-tree');
  await mkdir(large); await mkdir(small);
  const binary = Buffer.alloc(17 * 1024 * 1024);
  await writeFile(path.join(large, '0.bin'), binary); await writeFile(path.join(large, '1.bin'), binary);
  await writeFile(path.join(large, '2.txt'), 'SHOULD_NOT_BE_REACHED');
  await writeFile(path.join(small, '0.bin'), Buffer.from([0, 1, 2, 3])); await writeFile(path.join(small, '1.txt'), 'SAFE_TEXT_502');
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const result = await adapter.runRole({ role: 'dreamer', model: { provider: 'fixture', model: 'fixture' }, workspace: { id: 'w', root: h.temp }, prompt: 'Search only within the bounded file budget.' });
  assert.equal(result.status, 'completed', JSON.stringify(result));
  const results = h.calls.at(-1).messages.filter(message => message.role === 'tool');
  const limited = JSON.parse(results[0].content[0].text), mixed = JSON.parse(results[1].content[0].text);
  assert.equal(limited.truncated, true); assert.deepEqual(limited.matches, []); assert.match(limited.limitation, /input-byte limit/);
  assert.equal(mixed.truncated, false); assert.equal(mixed.matches.length, 1); assert.equal(mixed.matches[0].text, 'SAFE_TEXT_502');
  assert.equal(results[2].isError, true); assert.match(JSON.stringify(results[2]), /Only UTF-8 text/);
});

test('read guard admits project/selected evidence, rejects sibling and symlink escape',async t=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'automemory-guard-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  const outside=await mkdtemp(path.join(os.tmpdir(),'automemory-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
  await writeFile(path.join(dir,'ok.txt'),'ok');await writeFile(path.join(outside,'bad.txt'),'bad');await writeFile(path.join(outside,'evidence.json'),'evidence');
  await symlink(outside,path.join(dir,'escape'));
  const guard=createReadOnlyGuard({workspaceRoot:dir,evidencePaths:[path.join(outside,'evidence.json')]});
  assert.equal(guard({name:'read',arguments:{file_path:'ok.txt'}}),undefined);
  assert.equal(guard({name:'read',arguments:{file_path:path.join(outside,'evidence.json')}}),undefined);
  assert.match(guard({name:'read',arguments:{file_path:'escape/bad.txt'}}),/outside/);
  assert.match(guard({name:'write',arguments:{file_path:'ok.txt'}}),/cannot execute/);
});

test('G2 refuses accepted durable capture without persistence',async t=>{
  const h=await harness(()=>text('done'),{persistence:false});t.after(()=>h.close());const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const a=await h.agent();a.followup(message('input'));await a.whenIdle();
  await assert.rejects(()=>adapter.captureG2(a),{code:'PERSISTENCE_UNAVAILABLE'});
});

test('split recall replaces old index only, retaining revision notices and original tool reads',async t=>{
  let callNo=0;const h=await harness(()=>++callNo===1?call('memory_read'):text('done'));t.after(()=>h.close());
  h.ctx.tools.register(tool('memory_read',()=>({body:'ORIGINAL_V1'})));
  const deliveries=[];
  const stop=installTurnMemory(h.ctx,{prepareTurn:({turn,turnId})=>({bundle_id:turnId,indexText:`INDEX_${turn}`,revisionsText:turn===2?'CORRECTION_V2':'',provided:turn===2?[{id:'M1',version:'2'}]:[]}),onProvided:e=>deliveries.push(e)});t.after(stop);
  const a=await h.agent();
  for(let i=1;i<=3;i++){a.followup(message(`prompt${i}`,`p${i}`));await a.whenIdle();}
  const last=h.calls.at(-1).messages;
  assert.equal(last.filter(m=>m.source?.part==='index').length,1);
  assert.match(JSON.stringify(last),/INDEX_3/);assert.doesNotMatch(JSON.stringify(last),/INDEX_1|INDEX_2/);
  assert.match(JSON.stringify(last),/CORRECTION_V2/);assert.match(JSON.stringify(last),/ORIGINAL_V1/);
  assert.equal(deliveries.filter(e=>e.provided.length).length,1);
  const observed=await h.ctx.sessionQuery.observeSession(a.id,{projectionMode:'none'});
  try {assert.match(JSON.stringify(observed.events),/INDEX_1/);} finally {observed[Symbol.dispose]();}
});

test('compression within a turn reconstructs its same index without duplicating surviving revisions',async t=>{
  let calls=0,prepared=0;const h=await harness(()=>++calls===1?call('compact_index'):text('done'));t.after(()=>h.close());
  h.ctx.tools.register(tool('compact_index',async(_args,exec)=>{
    const observation=await h.ctx.sessionQuery.observeSession(exec.agent.id,{projectionMode:'none'});
    try {
      const entry=observation.events.find(e=>e.type==='user/message'&&e.data?.source?.part==='index');
      exec.agent.session.append('user/message',{id:'compaction-result',role:'user',source:{kind:'compaction'},content:[{type:'text',text:'index omitted by compaction'}]},{surfaceOp:{op:'replace',startSeq:entry.seq,endSeq:entry.seq},sourceEventSeqs:[entry.seq]});
      return {ok:true};
    } finally {observation[Symbol.dispose]();}
  }));
  const deliveries=[];
  const stop=installTurnMemory(h.ctx,{prepareTurn:({turnId})=>{prepared++;return {bundle_id:turnId,indexText:'SAME_INDEX_SNAPSHOT',revisionsText:'REVISION_M2',provided:[{id:'M2',version:'2'}]};},onProvided:e=>deliveries.push(e)});t.after(stop);
  const a=await h.agent();a.followup(message('prompt'));await a.whenIdle();
  assert.equal(prepared,2);assert.equal(h.calls.length,2);
  assert.equal(h.calls[1].messages.filter(m=>m.source?.part==='index').length,1);
  assert.equal(h.calls[1].messages.filter(m=>m.source?.part==='revisions').length,1);
  assert.equal(deliveries.length,1);
});

for (const native of [true, false]) test(`${native ? 'native' : 'role-local'} read/grep/glob are bounded to project and selected evidence, including symlink traversal`,async t=>{
  const outside=await mkdtemp(path.join(os.tmpdir(),'automemory-native-outside-'));t.after(()=>rm(outside,{recursive:true,force:true}));
  await mkdir(path.join(outside,'child'));await writeFile(path.join(outside,'SECRET.txt'),'OUTSIDE_SECRET_SENTINEL');
  const actions=[['read',{file_path:'inside.txt'}],['read',{file_path:'jump/../SECRET.txt'}],['grep',{pattern:'SENTINEL',path:'.'}],['glob',{pattern:'**/*',path:'.'}]];
  let n=0;const h=await harness(()=>n<actions.length?call(...actions[n++],`c${n}`):text({done:true}));t.after(()=>h.close());
  await writeFile(path.join(h.temp,'inside.txt'),'INSIDE_SENTINEL');await symlink(path.join(outside,'child'),path.join(h.temp,'jump'));await symlink(outside,path.join(h.temp,'external'));
  if (native) await h.nativeTools();
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const r=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Read and search in project.',maxSteps:6});
  assert.equal(r.status,'completed',JSON.stringify(r));
  const results=h.calls.at(-1).messages.filter(m=>m.role==='tool').map(m=>m.content.map(b=>b.text).join('\n'));
  assert.match(results[0],/INSIDE_SENTINEL/);
  assert.match(results[1],/outside the authorized/);
  assert.doesNotMatch(results.join('\n'),/OUTSIDE_SECRET_SENTINEL/);
  assert.doesNotMatch(results[3],/external\/SECRET|jump\/.*SECRET/);
});

test('external abort cancels the real role loop and prevents completion receipt',async t=>{
  const controller=new AbortController();
  const h=await harness(async options=>{controller.abort(new Error('job lease lost'));options.signal.throwIfAborted();return text({ok:true});});t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const result=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'test cancel',signal:controller.signal});
  assert.equal(result.status,'cancelled');assert.equal(result.output,undefined);
});

for (const native of [true, false]) test(`${native ? 'native' : 'role-local'} tools refuse nested host state and credential copies before dispatch; exact evidence and safe subtree remain usable`,async t=>{
  const h=await harness((_options,calls)=>calls.length<=actions.length?call(...actions[calls.length-1],`c${calls.length}`):text({done:true}));t.after(()=>h.close());
  const home=path.join(h.temp,'private-home'),data=path.join(h.temp,'plugin-data'),safe=path.join(h.temp,'safe');
  for(const dir of [home,data,safe,path.join(h.temp,'backups','private-home'),path.join(h.temp,'loose')])await mkdir(dir,{recursive:true});
  const evidence=path.join(data,'selected-job.jsonl');
  await writeFile(path.join(home,'SECRET.txt'),'PRIVATE_HOME_SENTINEL');
  await writeFile(path.join(home,'.credentials.yaml'),'PRIVATE_CREDENTIAL_SENTINEL');
  await writeFile(path.join(data,'other-project.jsonl'),'OTHER_PROJECT_SENTINEL');
  await writeFile(path.join(h.temp,'backups','private-home','copy.txt'),'BACKUP_SENTINEL');
  await writeFile(path.join(h.temp,'loose','.credentials.yml'),'LOOSE_CREDENTIAL_SENTINEL');
  await writeFile(evidence,'SELECTED_EVIDENCE_SENTINEL');await writeFile(path.join(safe,'README.txt'),'SAFE_PROJECT_SENTINEL');
  const actions=[
    ['read',{file_path:'private-home/SECRET.txt'}],['read',{file_path:'private-home/.credentials.yaml'}],
    ['read',{file_path:'plugin-data/other-project.jsonl'}],['read',{file_path:'backups/private-home/copy.txt'}],
    ['read',{file_path:'loose/.credentials.yml'}],['grep',{pattern:'SENTINEL',path:'.'}],['glob',{pattern:'**/*',path:'.'}],
    ['grep',{pattern:'SENTINEL',path:'backups'}],['glob',{pattern:'**/*',path:'loose'}],
    ['grep',{pattern:'SENTINEL',path:[safe,home]}],['glob',{pattern:'../private-home/*',path:safe}],
    ['glob',{pattern:path.join(home,'*'),path:safe}],
    ['read',{file_path:evidence}],['grep',{pattern:'SENTINEL',path:evidence}],
    ['grep',{pattern:'SENTINEL',path:safe}],['glob',{pattern:'**/*',path:safe}],
  ];
  if (native) await h.nativeTools();const dispatched=[];h.ctx.on('tools/execute',(exec,next)=>{dispatched.push(exec.callId);return next();});
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const r=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},blockedRoots:[home,data],protectedDirectoryNames:['private-home'],evidencePaths:[evidence],prompt:'Read only selected project evidence.',maxSteps:actions.length+1});
  assert.equal(r.status,'completed',JSON.stringify(r));
  const results=h.calls.at(-1).messages.filter(m=>m.role==='tool').map(m=>m.content.map(b=>b.text).join('\n'));
  assert.equal(results.length,actions.length);assert.doesNotMatch(results.join('\n'),/PRIVATE_HOME_SENTINEL|PRIVATE_CREDENTIAL_SENTINEL|OTHER_PROJECT_SENTINEL|BACKUP_SENTINEL|LOOSE_CREDENTIAL_SENTINEL/);
  assert.match(results[12],/SELECTED_EVIDENCE_SENTINEL/);assert.match(results[13],/SELECTED_EVIDENCE_SENTINEL/);
  assert.match(results[14],/SAFE_PROJECT_SENTINEL/);assert.match(results[15],/README.txt/);
  assert.deepEqual(dispatched,['c13','c14','c15','c16']);
});

test('role lifecycle is durably planned before creation and settled after disposal, including cancelled planning',async t=>{
  const h=await harness(()=>text({ok:true}));t.after(()=>h.close());const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const transitions=[];
  const result=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Test',
    onSessionPlanned:async({sessionId,role,storage})=>{assert.equal(role,'dreamer');assert.equal(storage.name,'session-persistence-jsonl');assert.equal(storage.root,path.join(await realpath(h.temp),'sessions'));assert.equal(h.ctx.agents.get(sessionId),undefined);assert.equal(await h.ctx.sessionPersistence.stat(sessionId),undefined);transitions.push('planned');},
    onCreated:()=>transitions.push('created'),onSessionSettled:({sessionId})=>{assert.equal(h.ctx.agents.get(sessionId),undefined);assert.equal(h.ctx.sessions.get(sessionId),undefined);transitions.push('settled');}});
  assert.equal(result.status,'completed',JSON.stringify(result));assert.deepEqual(transitions,['planned','created','settled']);
  let failedCreationSettled=false;
  const duplicate=await adapter.runRole({role:'dreamer',sessionId:result.sessionId,model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Duplicate must fail',onSessionSettled:()=>{failedCreationSettled=true;}});
  assert.equal(duplicate.status,'failed');assert.equal(failedCreationSettled,true);
  const stop=new AbortController();let settled=false;
  const aborted=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Test',signal:stop.signal,onSessionPlanned:()=>stop.abort(),onSessionSettled:()=>{settled=true;}});
  assert.equal(aborted.status,'cancelled');assert.equal(settled,true);assert.equal(await h.ctx.sessionPersistence.stat(aborted.sessionId),undefined);
});

for(const compression of ['none','zstd'])test(`role-log deletion uses official writer ownership and hides prewarmed query cache (${compression})`,async t=>{
  const h=await harness(()=>text({sensitive:'PLUGIN_COPY_SENTINEL'}),{compression});t.after(()=>h.close());const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  let storage;
  const r=await adapter.runRole({role:'reviewer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root:h.temp},prompt:'Owned plugin copy',onSessionPlanned:e=>{storage=e.storage;}});
  assert.equal(r.status,'completed',JSON.stringify(r));assert.match(JSON.stringify(await adapter.readSession(r.sessionId)),/PLUGIN_COPY_SENTINEL/);
  const metadata=await h.ctx.sessionPersistence.stat(r.sessionId);const artifact=h.ctx.sessionPersistence.locate(metadata.header);const lock=path.join(path.dirname(artifact.path),'session.lock');const lockBefore=await stat(lock);
  await assert.rejects(()=>adapter.deleteRoleSession(r.sessionId,{storage:{...storage,root:storage.root+'-other'}}),{code:'ROLE_SESSION_CLEANUP_UNAVAILABLE'});
  assert.deepEqual(await adapter.deleteRoleSession(r.sessionId,{storage}),{sessionId:r.sessionId,status:'deleted'});
  assert.equal(await h.ctx.sessionPersistence.stat(r.sessionId),undefined);await assert.rejects(()=>adapter.readSession(r.sessionId),{code:'SESSION_QUERY_SESSION_NOT_FOUND'});
  assert.deepEqual(await readdir(path.dirname(artifact.path)),['session.lock']);assert.equal((await stat(lock)).ino,lockBefore.ino);
  assert.equal((await adapter.deleteRoleSession(r.sessionId,{storage})).status,'absent');
  await assert.rejects(()=>adapter.deleteRoleSession(r.sessionId),{code:'ROLE_SESSION_CLEANUP_UNAVAILABLE'});
  await assert.rejects(()=>adapter.deleteRoleSession('parent'),{code:'INVALID_ROLE_SESSION'});
});

test('role-log cleanup refuses active foreign writer and unknown sidecar artifacts',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'automemory-role-cleanup-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const first=await harness(()=>text({ok:true}),{root});t.after(()=>first.close());const adapter=createHostAdapter(first.ctx);t.after(()=>adapter.close());
  const second=await harness(()=>text({ok:true}),{root});t.after(()=>second.close());const other=createHostAdapter(second.ctx);t.after(()=>other.close());
  let storage;
  const result=await adapter.runRole({role:'dreamer',model:{provider:'fixture',model:'fixture'},workspace:{id:'w',root},prompt:'Owned log',onSessionPlanned:e=>{storage=e.storage;},onCreated:async({sessionId})=>{
    await first.ctx.sessions.flush(first.ctx.sessions.get(sessionId));await assert.rejects(()=>other.deleteRoleSession(sessionId,{storage}),{code:'ROLE_SESSION_BUSY'});
    const child=spawnSync(process.execPath,[fileURLToPath(new URL('./fixtures/delete-role-probe.mjs',import.meta.url)),root,sessionId,JSON.stringify(storage)],{encoding:'utf8',timeout:10000});
    assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).code,'ROLE_SESSION_BUSY');
  }});
  assert.equal(result.status,'completed',JSON.stringify(result));
  const metadata=await first.ctx.sessionPersistence.stat(result.sessionId),artifact=first.ctx.sessionPersistence.locate(metadata.header);
  await writeFile(path.join(path.dirname(artifact.path),'unknown-copy.json'),'PRIVATE');
  await assert.rejects(()=>adapter.deleteRoleSession(result.sessionId,{storage}),{code:'ROLE_SESSION_CLEANUP_UNAVAILABLE'});assert.ok(await first.ctx.sessionPersistence.stat(result.sessionId));
});

test('snapshot digest survives storage key sorting and still rejects content corruption',async t=>{
  const h=await harness(()=>text({audit_completion:'complete',operations:[],issues:[],explanation:'done'}));t.after(()=>h.close());
  const adapter=createHostAdapter(h.ctx);t.after(()=>adapter.close());
  const parent=await h.agent();parent.followup(message('PERSISTED_EVIDENCE'));await parent.whenIdle();
  const captured=await adapter.captureG2(parent);
  const sorted=JSON.parse(JSON.stringify(captured,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(k=>[k,item[k]])):item));
  const restored=await adapter.runRole({role:'g2',snapshot:sorted,workspace:{id:'w',root:h.temp},prompt:'Audit'});
  assert.equal(restored.status,'completed',JSON.stringify(restored));
  sorted.seed.find(e=>e.type==='user/message').data.content[0].text='CORRUPTED';
  await assert.rejects(()=>adapter.runRole({role:'g2',snapshot:sorted,workspace:{id:'w',root:h.temp},prompt:'Audit'}),{code:'CONTEXT_CORRUPT'});
});

test('a frozen G2 snapshot runs in a fresh process after its parent host is closed',async t=>{
  const root=await mkdtemp(path.join(os.tmpdir(),'automemory-host-restart-'));t.after(()=>rm(root,{recursive:true,force:true}));
  const h=await harness(()=>text({done:true}),{root});
  const adapter=createHostAdapter(h.ctx);
  const a=await h.agent();a.followup(message('FRESH_PROCESS_EVIDENCE'));await a.whenIdle();
  const snapshot=await adapter.captureG2(a);
  const file=path.join(root,'frozen.json');await writeFile(file,JSON.stringify(snapshot));
  await adapter.close();await h.close();
  const processResult=spawnSync(process.execPath,[fileURLToPath(new URL('./fixtures/resume-role.mjs',import.meta.url)),file],{encoding:'utf8',timeout:10000});
  assert.equal(processResult.status,0,processResult.stderr);
  const restored=JSON.parse(processResult.stdout.trim());
  assert.equal(restored.status,'completed',JSON.stringify(restored));assert.equal(restored.inherited,true);assert.equal(restored.requests,1);
});
