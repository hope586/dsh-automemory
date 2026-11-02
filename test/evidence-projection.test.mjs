import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { projectEvidence } from '../src/core/evidence-projection.js';
import { createHostAdapter } from '../src/host/index.js';
import { apply } from '../lib/index.js';
import { workspaceIdentity } from '../src/identity.js';
import { harness, message, call, text, tool } from './fixtures/harness.mjs';

const fragment = { sessionId: 'source', startExclusive: -1, endInclusive: 99, purpose: 'Authorized audit evidence', filename: 'source-audit.jsonl' };
const event = (seq, type, data, extra = {}) => ({ seq, type, time: 1700000000000 + seq, data, ...extra });

test('projection omits runtime wiring by native fields while preserving human and unknown-source content in full', () => {
  const human = 'runtime-context: this prefix is a real user decision, not an injection.\n' + '中文事实'.repeat(20000);
  const events = [
    event(0, 'system/message', { content: [{ type: 'text', text: 'SYSTEM_PRIVATE_CANARY_419'.repeat(10000) }] }),
    event(1, 'request/header', { header: { prompt: 'WIRE_PRIVATE_CANARY_419'.repeat(10000), tools: [{ name: 'tool', description: 'D'.repeat(100000) }] } }),
    event(2, 'user/message', message(human)),
    ...['runtime-context', 'automemory', 'automemory-superseded', 'skill-catalog', 'time-context'].map((kind, i) => event(3 + i, 'user/message', { ...message('INJECTED_PRIVATE_CANARY_419'), source: { kind } })),
    event(8, 'user/message', { ...message('UNKNOWN_SOURCE_FACT_419'), source: { kind: 'user-question-reply', callId: 'question' } }),
    event(9, 'tool/call', { name: 'ask_user_question', callId: 'question', arguments: { question: 'Choose the branch' }, turn: 1, step: 1 }),
    event(10, 'tool/result', { message: { id: 'answer', role: 'tool', source: { kind: 'tool', callId: 'question' }, content: [{ type: 'text', text: 'USER_DECIDED_BRANCH_GREEN_419' }] } }, { sourceEventSeqs: [9] }),
    event(11, 'assistant/message', { message: { role: 'assistant', content: [{ type: 'reasoning', text: 'INTERNAL_CANARY_419' }, { type: 'text', text: 'ASSISTANT_VISIBLE_FACT_419' }] }, usage: { providerWire: 'NOT_FACT'.repeat(20000) } }),
  ];
  const before = JSON.stringify(events), result = projectEvidence({ sessionId: 'source', events, fragment });
  assert.equal(JSON.stringify(events), before, 'Projection must not mutate original native events');
  assert.equal(result.records.find(e => e.seq === 2).data.message.content[0].text, human, 'Do not truncate genuine text even when it is long');
  assert.match(result.jsonl, /UNKNOWN_SOURCE_FACT_419/); assert.match(result.jsonl, /USER_DECIDED_BRANCH_GREEN_419/); assert.match(result.jsonl, /ASSISTANT_VISIBLE_FACT_419/);
  for (const token of ['SYSTEM_PRIVATE_CANARY_419', 'WIRE_PRIVATE_CANARY_419', 'INJECTED_PRIVATE_CANARY_419', 'INTERNAL_CANARY_419', 'NOT_FACT']) assert.ok(!result.jsonl.includes(token), token);
  assert.equal(result.header.projection.contentTruncated, false);
  assert.deepEqual(result.records.find(e => e.seq === 10).sourceEventSeqs, [9]);
  assert.ok(result.records.every(e => e.locator === `source#event:${e.seq}`));
  assert.equal(result.header.projection.omittedEvents.length, 7); assert.equal(result.header.projection.omittedBlocks.length, 1);
  assert.ok(result.header.projection.omittedEvents.every(e => /^[a-f0-9]{64}$/.test(e.sha256)));
});

test('native assistant stream attempts and interrupted visible replies stay explicitly incomplete', () => {
  const stream = [
    { type: 'chunk', at: 0, chunk: { type: 'block-start', index: 0, blockType: 'text' } },
    { type: 'text-chunks', index: 0, texts: ['PARTIAL_FACT_', '519'], times: [1, 2] },
    { type: 'chunk', at: 3, chunk: { type: 'finish', reason: { kind: 'error', failure: { code: 'NETWORK_ERROR', message: 'private endpoint omitted' } } } },
  ];
  const result = projectEvidence({ sessionId: 'source', fragment, events: [
    event(1, 'assistant/attempt', { turn: 1, step: 1, stream }),
    event(2, 'assistant/message', { turn: 1, step: 2, interrupted: true, message: { role: 'assistant', source: { provider: 'fixture', model: 'fixture', replayState: { opaque: 'REPLAY_SECRET_519' } }, content: [{ type: 'text', text: 'INTERRUPTED_VISIBLE_519' }] } }),
    event(3, 'assistant/attempt', { turn: 2, step: 1, stream: [{ type: 'unknown-invalid-record' }] }),
  ] });
  assert.match(JSON.stringify(result.records[0]), /PARTIAL_FACT_519/); assert.match(result.records[0].delivery, /incomplete/);
  assert.equal(result.records[0].data.finish.failureCode, 'NETWORK_ERROR'); assert.ok(!result.jsonl.includes('private endpoint omitted'));
  assert.equal(result.records[1].data.interrupted, true); assert.match(result.records[1].delivery, /interrupted/); assert.ok(!result.jsonl.includes('REPLAY_SECRET_519'));
  assert.equal(result.header.projection.contentComplete, false); assert.equal(result.header.projection.contentGaps[0].seq, 3);
});

test('growing request prompts/tools does not inflate the factual projection', () => {
  const make = size => [event(0, 'request/header', { prompt: 'P'.repeat(size), tools: 'T'.repeat(size) }), event(1, 'system/message', { text: 'S'.repeat(size) }), event(2, 'user/message', message('The validation gate is make check.'))];
  const small = projectEvidence({ sessionId: 'source', events: make(20), fragment }), large = projectEvidence({ sessionId: 'source', events: make(1000000), fragment });
  assert.equal(large.stats.projectedBytes, small.stats.projectedBytes);
  assert.ok(large.stats.originalEventBytes > 3000000); assert.ok(large.stats.projectedBytes < 3000);
});

test('unknown message content shapes are explicit gaps while native empty content remains valid', () => {
  for (const type of ['user/message', 'assistant/message', 'tool/result', 'assistant/attempt']) {
    for (const data of [{ text: 'legacy shape is not silently empty' }, { message: { text: 'unknown nested shape' } }, { content: null }, { content: { text: 'non-array' } }]) {
      const result = projectEvidence({ sessionId: 'source', fragment, events: [event(1, type, data)] });
      assert.equal(result.header.projection.contentComplete, false, `${type}: ${JSON.stringify(data)}`);
      assert.equal(result.header.projection.contentGaps[0].seq, 1);
      assert.match(result.header.projection.contentGaps[0].sha256, /^[a-f0-9]{64}$/);
    }
    const empty = projectEvidence({ sessionId: 'source', fragment, events: [event(1, type, { message: { content: [] } })] });
    assert.equal(empty.header.projection.contentComplete, true); assert.deepEqual(empty.records[0].data.message.content, []);
  }
});

test('unprojectable fact evidence fails before any model dispatch and leaves audit coverage unchanged', async t => {
  const h = await harness(() => text('This fixture model must never run.'));
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory'), toolFactory: () => [] });
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'fixture-model' }, reviewer: { provider: 'fixture', model: 'fixture-model' } } });
  clearInterval(c.timer); t.after(async () => { await c.close(); await h.close(); });
  const workspace = workspaceIdentity(h.temp); c.store.registerWorkspace(workspace);
  c.store.registerSession({ workspaceId: workspace.id, sessionId: 'unknown-shape', newSession: true });
  c.store.updateSessionHead({ workspaceId: workspace.id, sessionId: 'unknown-shape', headSeq: 2 });
  const before = c.store.listSessions(workspace.id)[0];
  c.host.readSession = async () => ({ header: { cwd: h.temp }, cursor: 2, events: [event(1, 'user/message', { message: { content: { text: 'important but unsupported' } } })] });
  let dispatched = 0; c.host.runRole = async () => { dispatched++; throw new Error('Unexpected model dispatch'); };
  const requested = await c.requestDream(workspace, true);
  await c.tick(); await c.active;
  const job = c.store.getJob(requested.job_id);
  assert.equal(job.status, 'failed'); assert.ok(c.errors.some(error => error.code === 'EVIDENCE_CONTENT_INCOMPLETE'));
  assert.equal(dispatched, 0); assert.equal(h.calls.length, 0);
  assert.equal(c.store.listSessions(workspace.id)[0].dream_cursor, before.dream_cursor);
  assert.equal(c.store.getWorkspace(workspace.id).dream_processed_seq, 0);
  assert.deepEqual(c.store.getJobArtifacts(job.id), {});
  assert.equal(existsSync(c.evidenceDirectory(job)), false);
});

test('native user, assistant and ask_user_question results keep their exact source sequence without altering G2 inheritance', async t => {
  let step = 0;
  const h = await harness(() => ++step === 1 ? call('ask_user_question', { question: 'Which gate?' }, 'native-question') : text('ASSISTANT_FACT_880: the choice is recorded in this conversation.'));
  t.after(() => h.close());
  h.ctx.systemPrompt.section({ name: 'fixture-system-metadata', order: 1, interpolate: false, text: 'SYSTEM_WIRE_880 '.repeat(20000) });
  h.ctx.tools.register(tool('ask_user_question', () => ({ answer: 'USER_VIA_TOOL_880: keep the low-risk gate.' }), { type: 'object', properties: { question: { type: 'string' } }, required: ['question'] }));
  const agent = await h.agent(); agent.followup(message('USER_FACT_880: do not automatically publish the branch.')); await agent.whenIdle();
  const adapter = createHostAdapter(h.ctx); t.after(() => adapter.close());
  const snapshot = await adapter.captureG2(agent), frozen = JSON.stringify(snapshot);
  const native = await adapter.readSession(agent.id);
  const result = projectEvidence({ sessionId: agent.id, events: native.events, fragment: { ...fragment, sessionId: agent.id, endInclusive: native.cursor } });
  for (const token of ['USER_FACT_880', 'USER_VIA_TOOL_880', 'ASSISTANT_FACT_880']) {
    const original = native.events.find(e => ['user/message', 'assistant/message', 'tool/result'].includes(e.type) && JSON.stringify(e.data).includes(token));
    assert.ok(original, token); const projected = result.records.find(e => e.seq === original.seq);
    assert.ok(JSON.stringify(projected).includes(token)); assert.equal(projected.locator, `${agent.id}#event:${original.seq}`);
  }
  assert.ok(!result.jsonl.includes('SYSTEM_WIRE_880')); assert.ok(result.stats.projectedBytes < result.stats.originalEventBytes / 10);
  assert.equal(JSON.stringify(snapshot), frozen); assert.ok(frozen.includes('SYSTEM_WIRE_880'), 'G2 still inherits the original full effective snapshot');
  assert.equal(h.calls.length, 2, 'Only the deterministic fixture adapter ran; projection adds no model calls');
});
