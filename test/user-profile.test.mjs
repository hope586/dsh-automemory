import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { UserProfileStore } from '../src/user-profile.js';
function setup(t) { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'automemory-profile-')); const options = { dshHome: dir, dataDir: path.join(dir, 'data') }; const a = new UserProfileStore(options), b = new UserProfileStore(options); t.after(() => { a.close(); b.close(); fs.rmSync(dir, { recursive: true, force: true }); }); return { a, b, dir }; }
test('global file is shared, updates reject stale versions and replay once', t => {
  const { a, b } = setup(t); const old = a.read();
  const update = { text: 'Prefer concise Chinese.', expectedHash: old.hash, requestId: 'r1', reason: 'User preference', sources: [] };
  assert.equal(a.update(update).status, 'committed'); assert.equal(b.read().text, update.text);
  assert.equal(b.update(update).status, 'committed'); assert.equal(a.activity().length, 1);
  assert.throws(() => b.update({ ...update, requestId: 'r2', text: 'stale' }), { code: 'VERSION_CONFLICT' });
  assert.throws(() => a.update({ ...update, text: 'different' }), { code: 'IDEMPOTENCY_CONFLICT' });
});
test('external edits are authoritative and automatic writes can be disabled independently', t => {
  const { a, dir } = setup(t); const old = a.read(); fs.writeFileSync(path.join(dir, 'USER.md'), 'Human edit');
  assert.equal(a.read().text, 'Human edit');
  assert.throws(() => a.update({ text: 'overwrite', expectedHash: old.hash, requestId: 'r1', reason: 'test' }), { code: 'VERSION_CONFLICT' });
  a.configure({ autoWrite: false });
  assert.throws(() => a.update({ text: 'auto', expectedHash: a.read().hash, requestId: 'r2', reason: 'test' }), { code: 'PROFILE_DISABLED' });
  assert.equal(a.update({ text: 'Explicit edit', expectedHash: a.read().hash, requestId: 'r3', reason: 'user', origin: 'user' }).status, 'committed');
});
test('clearing requires authorization and removes retained audit content', t => {
  const { a, b } = setup(t);
  const create = { text: 'private preference', expectedHash: a.read().hash, requestId: 'r1', reason: 'test' };
  a.update(create);
  assert.throws(() => a.clear({ expectedHash: a.read().hash, requestId: 'clear' }), { code: 'DELETE_NOT_AUTHORIZED' });
  const clear = { expectedHash: a.read().hash, requestId: 'clear', authorized: true };
  assert.equal(a.clear(clear).cleanup_status, 'complete');
  assert.equal(b.clear(clear).cleanup_status, 'complete');
  assert.equal(a.update(create).status, 'rejected');
  assert.equal(b.read().text, ''); assert.deepEqual(a.activity(), []);
});
test('interruption after clearing file is recovered with audit cleanup and old-request revocation', t => {
  const { a, b } = setup(t);
  const create = { text: 'private preference', expectedHash: a.read().hash, requestId: 'old', reason: 'private preference' };
  a.update(create);
  const clear = { expectedHash: a.read().hash, requestId: 'clear', authorized: true };
  const finish = a.finish.bind(a); a.finish = () => { throw new Error('simulated crash after rename before SQLite commit'); };
  assert.throws(() => a.clear(clear), /simulated crash/); a.finish = finish;
  assert.equal(b.recover().cleanup_status, 'complete');
  assert.equal(b.clear(clear).cleanup_status, 'complete'); assert.equal(b.update(create).status, 'rejected');
  assert.equal(b.read().text, ''); assert.deepEqual(b.activity(), []);
});
test('full injection capacity fails explicitly instead of truncating', t => {
  const { a, dir } = setup(t); fs.writeFileSync(path.join(dir, 'USER.md'), 'x'.repeat(40000));
  assert.throws(() => a.read(), { code: 'PROFILE_CAPACITY' });
});
