import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { harness, message, call, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';
import { contractSchema } from '../src/validation.js';

const textOf = messages => messages.flatMap(message => message.content || []).filter(block => block.type === 'text').map(block => block.text).join('\n');

test('Final inherits the exact full candidate snapshot and adds review without duplicating contract or candidate', async t => {
  const sourceFact = 'USER_EVIDENCE_563: publish only after an explicit approval.';
  const candidateFact = 'CANDIDATE_BODY_563: require an explicit approval before publishing.';
  const reviewNote = 'REVIEW_ADVICE_563: verify that the explicit approval requirement remains.';
  let draft, candidateCalls = 0, finalSessionId, finalInput, snapshotJson, candidateSnapshot;
  const h = await harness(options => {
    if (options.sessionId === 'parent') return text('The project decision is recorded in this conversation.');
    if (options.sessionId.startsWith('automemory-reviewer-')) {
      const candidateId = textOf(options.messages).match(/"candidate_id":"([a-f0-9]+)"/)?.[1];
      assert.ok(candidateId);
      return text({ candidate_id: candidateId, findings: [], checked_sources: draft.operations[0].source_refs, limitations: [reviewNote] });
    }
    if (options.sessionId === finalSessionId) return text(draft);
    if (++candidateCalls === 1) {
      const evidence = textOf(options.messages).match(/"evidence_files":\["([^"]+)"/)[1];
      return call('read', { file_path: evidence }, 'read-candidate-evidence');
    }
    return text(draft);
  });
  await h.nativeTools();
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory') }); clearInterval(c.timer);
  t.after(async () => { await c.close(); await h.close(); });
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'dream' }, reviewer: { provider: 'fixture', model: 'review' } } });
  const parent = await h.agent(); parent.followup(message(sourceFact)); await parent.whenIdle();
  const w = c.bind(parent.session), native = await c.host.readSession(parent.id);
  const sourceSeq = native.events.find(event => event.type === 'user/message' && JSON.stringify(event.data).includes(sourceFact)).seq;
  draft = { audit_completion: 'complete', explanation: 'A durable user-approved constraint.', operations: [{ op: 'CREATE', operation_key: 'approval', local_key: 'approval', reason: 'The user set this constraint.', source_refs: [{ source_kind: 'session_event', locator: `${parent.id}#event:${sourceSeq}` }], content: { title: 'Explicit publishing approval', category: 'stable', group: 'workflow', index_hint: 'Read before publishing', conditions: 'This project', payload: { kind: 'markdown', text: candidateFact } } }], issues: [] };
  const run = c.host.runRole;
  c.host.runRole = async input => {
    if (input.role === 'DREAMER' && input.snapshot) {
      finalInput = input;
      assert.equal(input.snapshot, candidateSnapshot, 'Pass the complete original snapshot, not a rebuilt or reduced seed');
      assert.equal(JSON.stringify(input.snapshot), snapshotJson);
      assert.ok(input.evidencePaths.every(existsSync));
      assert.ok(input.evidencePaths.every(file => input.prompt.includes(file)), 'The continuation still supplies current authorized paths');
      const planned = input.onSessionPlanned;
      input = { ...input, onSessionPlanned: async info => { finalSessionId = info.sessionId; await planned?.(info); } };
    } else if (input.role === 'REVIEWER') assert.equal(input.snapshot, undefined, 'The reviewer remains independent');
    const result = await run(input);
    if (input.role === 'DREAMER' && !input.snapshot) { candidateSnapshot = result.snapshot; snapshotJson = JSON.stringify(result.snapshot); }
    return result;
  };
  const accepted = await c.requestDream(w, true); await c.tick(); await c.active;
  assert.equal(c.store.getJob(accepted.job_id).status, 'completed', JSON.stringify(c.errors));
  assert.ok(finalInput); assert.equal(JSON.stringify(candidateSnapshot), snapshotJson, 'Host restoration must not mutate the captured snapshot');
  const finalCall = h.calls.find(call => call.sessionId === finalSessionId), full = textOf(finalCall.messages);
  assert.ok(full.includes(JSON.stringify(contractSchema('DraftResult'))), 'The complete original output contract remains model-visible');
  assert.ok(full.includes(JSON.stringify(draft)), 'The complete candidate remains model-visible');
  assert.match(full, /USER_EVIDENCE_563/); assert.match(full, /REVIEW_ADVICE_563/);
  assert.equal(full.split(candidateFact).length - 1, 1, 'The candidate body appears only in its original completed answer');
  assert.doesNotMatch(finalInput.prompt, /输出Schema|"\$defs"|CANDIDATE_BODY_563/);
  assert.match(finalInput.prompt, /"candidate_id":"[a-f0-9]+"/); assert.match(finalInput.prompt, /REVIEW_ADVICE_563/);
  assert.match(finalInput.prompt, /Evidence admission policy:/);
  assert.equal(candidateCalls, 2); assert.equal(h.calls.filter(call => call.sessionId === finalSessionId).length, 1);
});
