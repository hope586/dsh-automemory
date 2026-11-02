import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { harness, message, text } from './fixtures/harness.mjs';
import { apply } from '../lib/index.js';
import { workspaceIdentity } from '../src/identity.js';

async function setup(t) {
  const h = await harness(() => text('fixture'));
  const home = path.join(h.temp, 'memory-home');
  const c = apply(h.ctx, { dshHome: home, dataDir: path.join(home, 'automemory'), toolFactory: () => [] });
  c.settings.set({ models: { dreamer: { provider: 'fixture', model: 'fixture-model' }, reviewer: { provider: 'fixture', model: 'fixture-model' } } });
  clearInterval(c.timer);
  t.after(async () => { await c.close(); await h.close(); });
  return { h, c };
}
const noop = { audit_completion: 'complete', explanation: 'No changes.', operations: [], issues: [] };
async function queued(t, h, c) {
  const root = path.join(h.temp, 'project'); mkdirSync(root);
  const w = workspaceIdentity(root); c.store.registerWorkspace(w);
  const sid = 'synthetic-evidence';
  c.store.registerSession({ workspaceId: w.id, sessionId: sid, newSession: true });
  c.store.updateSessionHead({ workspaceId: w.id, sessionId: sid, headSeq: 2 });
  const request = await c.requestDream(w, true);
  c.host.readSession = async () => ({ header: { cwd: root }, cursor: 2, events: [{ seq: 1, time: 0, type: 'user/message', data: message('bounded fixture evidence') }] });
  return { w, request };
}

test('deleted idle session cwd does not stop unrelated workspace scheduling or produce global errors', async t => {
  const { h, c } = await setup(t);
  const gone = path.join(h.temp, 'removed-directory'); mkdirSync(gone);
  const handle = await h.ctx.agents.create({ sessionId: 'removed-session', agentOptions: { provider: 'fixture', model: 'fixture' }, meta: { cwd: gone } });
  t.after(() => handle.dispose()); rmSync(gone, { recursive: true });
  const { request } = await queued(t, h, c);
  let executed = 0;
  c.executeJob = async job => { executed++; return c.store.completeJob({ lease: job.lease, draft: noop }); };
  await c.tick(); await c.active;
  assert.equal(executed, 1); assert.equal(c.store.getJob(request.job_id).status, 'completed');
  assert.equal(c.errors.length, 0); assert.equal(c.sessions.has('removed-session'), false);
});

test('a stale evidence cleanup cannot remove a successor lease evidence files', async t => {
  const { h, c } = await setup(t);
  const { w } = await queued(t, h, c);
  let now = Date.now(); c.store.clock = () => now;
  const old = c.store.claimJob({ owner: 'old-host', leaseMs: 10 });
  const oldFiles = await c.evidence(old, w);
  now += 60001;
  const successor = c.store.claimJob({ owner: 'new-host' });
  assert.ok(successor); assert.notEqual(successor.lease.token, old.lease.token);
  const newFiles = await c.evidence(successor, w);
  assert.notEqual(oldFiles[0], newFiles[0]);
  c.cleanupEvidence(old);
  assert.equal(existsSync(oldFiles[0]), false);
  assert.match(readFileSync(newFiles[0], 'utf8'), /bounded fixture evidence/);
  assert.throws(() => c.store.completeJob({ lease: old.lease, draft: noop }));
  c.store.completeJob({ lease: successor.lease, draft: noop });
  c.cleanupEvidence(successor);
  assert.equal(existsSync(newFiles[0]), false);
});

test('evidence source await cannot recreate files after clearing cancels its lease', async t => {
  const { h, c } = await setup(t);
  const { w } = await queued(t, h, c);
  const job = c.store.claimJob({ owner: c.owner });
  const read = c.host.readSession;
  let release, reached;
  const gate = new Promise(resolve => { release = resolve; });
  const entered = new Promise(resolve => { reached = resolve; });
  c.host.readSession = async (...args) => { reached(); await gate; return read(...args); };
  const pending = c.evidence(job, w); await entered;
  c.store.cancelJob({ workspaceId: w.id, jobId: job.id });
  c.cleanupWorkspace(w.id);
  release();
  await assert.rejects(pending);
  assert.equal(existsSync(c.evidenceDirectory(job)), false);
});

test('diagnostic deduplication preserves scope and does not grow on repeated missing resources', async t => {
  const { c } = await setup(t);
  for (let i = 0; i < 20; i++) c.report(Object.assign(new Error('Fixture source missing'), { code: 'SOURCE_UNAVAILABLE' }), { workspaceId: 'A', jobId: 'J1' });
  c.report(Object.assign(new Error('Fixture source missing'), { code: 'SOURCE_UNAVAILABLE' }), { workspaceId: 'B', jobId: 'J2' });
  assert.equal(c.errors.length, 2); assert.equal(c.errors[0].workspaceId, 'A'); assert.equal(c.errors[1].workspaceId, 'B');
});

test('shutdown keeps management cleanup available until an in-flight scheduler has drained', async t => {
  const { c } = await setup(t);
  let release, entered, disposed = false;
  const gate = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const dispose = c.management.dispose.bind(c.management);
  c.management.dispose = async () => { disposed = true; await dispose(); };
  c.cleanupRoleSessions = async () => { entered(); await gate; assert.equal(disposed, false); c.management.clearGlobal(); };
  const tick = c.tick(); await reached;
  const closing = c.close(); assert.equal(disposed, false); release();
  await Promise.all([tick, closing]); assert.equal(disposed, true);
});

test('passive presence scanning cannot recreate a memory project from an archived retained session', async t => {
  const { h, c } = await setup(t);
  const handle = await h.ctx.agents.create({ sessionId: 'archived-ui-fixture', agentOptions: { provider: 'fixture', model: 'fixture' }, meta: { cwd: h.temp } });
  t.after(() => handle.dispose());
  h.ctx.provide('workspaceRegistry', { archivedSessionIds: ['archived-ui-fixture'], list: () => [] });
  c.refreshPresence();
  assert.equal(c.store.listWorkspaces().length, 0);
  assert.equal(c.sessions.has('archived-ui-fixture'), false);
});
