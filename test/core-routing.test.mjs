import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import { MemoryStore } from '../src/core/index.js';

const DAY = 86400000;
const noop = { audit_completion: 'complete', explanation: 'No change.', operations: [], issues: [] };
function fixture(t) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'automemory-core-routing-')); let now = 1000;
  const store = new MemoryStore({ dataDir, clock: () => now });
  store.registerWorkspace({ id: 'w', root: dataDir }); store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 1 });
  t.after(() => { store.close(); rmSync(dataDir, { recursive: true, force: true }); });
  return { store, dataDir, now: () => now, advance: ms => { now += ms; } };
}

test('capability deferral is shared, does not start the daily interval, and safely resumes only the same undispatched job', t => {
  const f = fixture(t); f.advance(DAY);
  const other = new MemoryStore({ dataDir: f.dataDir, clock: f.now }); t.after(() => other.close());
  const accepted = f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'automatic-first' });
  assert.equal(f.store.claimJob({ owner: 'web', eligibility: () => ({ eligible: false, code: 'HOST_MODEL_UNAVAILABLE', message: 'Waiting for the configured provider.' }) }), null);
  assert.equal(other.getJob(accepted.job_id).deferral.code, 'HOST_MODEL_UNAVAILABLE');
  assert.equal(other.getJob(accepted.job_id).started_at, null); assert.equal(other.getWorkspace('w').last_dream_started, null);
  const job = other.claimJob({ owner: 'desktop', eligibility: () => ({ eligible: true }) });
  const started = other.getWorkspace('w').last_dream_started;
  assert.equal(job.deferral, undefined);
  other.saveJobArtifact({ lease: job.lease, stage: 'candidate-input-meta', value: { promptHash: 'fixture' } });
  other.saveJobArtifact({ lease: job.lease, stage: 'candidate-usage', value: { status: 'deferred', requests: [], usage: [] } });
  other.deferUndispatchedJob({ lease: job.lease, stage: 'candidate', code: 'HOST_MODEL_UNAVAILABLE', message: 'Provider unloaded before dispatch.' });
  const resumed = f.store.claimJob({ owner: 'another-capable-host', eligibility: () => ({ eligible: true }) });
  assert.equal(resumed.id, job.id); assert.equal(resumed.lease.token, job.lease.token + 1);
  assert.equal(f.store.getWorkspace('w').last_dream_started, started);
  f.store.completeJob({ lease: resumed.lease, draft: noop });
  f.store.updateSessionHead({ workspaceId: 'w', sessionId: 's', headSeq: 2 });
  assert.throws(() => f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'another-new-run' }), { code: 'DREAM_INTERVAL' });
});

test('a paid stage cannot use the zero-dispatch deferral path and asynchronous claim checks roll back', t => {
  const f = fixture(t); f.store.enqueueJob({ workspaceId: 'w', kind: 'DREAMING', requestId: 'manual', manual: true });
  assert.throws(() => f.store.claimJob({ owner: 'bad-check', eligibility: async () => ({ eligible: true }) }), { code: 'INVALID_CONFIGURATION' });
  const job = f.store.claimJob({ owner: 'valid-check', eligibility: () => ({ eligible: true }) });
  f.store.saveJobArtifact({ lease: job.lease, stage: 'candidate-usage', value: { status: 'deferred', requests: [{ index: 1 }], usage: [{ totalTokens: 10 }] } });
  assert.throws(() => f.store.deferUndispatchedJob({ lease: job.lease, stage: 'candidate' }), { code: 'MODEL_STAGE_INTERRUPTED' });
  assert.equal(f.store.getJob(job.id).status, 'running'); assert.ok(f.store.getJobArtifacts(job.id)['candidate-usage']);
});
