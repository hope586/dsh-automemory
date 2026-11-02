import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryStore } from '../src/core/index.js';
import { digest } from '../src/core/validate.js';
import { renderIndexHint, INDEX_RENDER_VERSION } from '../src/core/render.js';

const task = (blockers = ['filter choice pending', 'bad-line choice pending', 'unittest acceptance pending', 'DEBUG choice pending']) => ({ title: 'Project handoff', category: 'active', group: 'work', index_hint: 'STALE_HINT_763: only three choices remain; unittest accepted', conditions: 'This project', payload: { kind: 'task', goal: 'Finish the project handoff', progress: ['A colleague implemented unittest; this is not user acceptance.'], ...(blockers === null ? {} : { blockers }), next_actions: ['Ask for the still-pending choices.'] } });
function fixture(t) {
  const dataDir = mkdtempSync(path.join(os.tmpdir(), 'automemory-active-index-'));
  const store = new MemoryStore({ dataDir }); store.registerWorkspace({ id: 'w', root: dataDir }); store.registerSession({ workspaceId: 'w', sessionId: 's', newSession: true });
  t.after(() => { store.close(); rmSync(dataDir, { recursive: true, force: true }); });
  const create = content => store.submit({ audit_completion: 'complete', explanation: 'Fixture handoff', operations: [{ op: 'CREATE', operation_key: 'create', local_key: 'task', reason: 'Fixture source', source_refs: [{ source_kind: 'session_event', locator: 's#event:1' }], content }], issues: [] }, { workspaceId: 'w', requestId: 'seed', channel: 'G1' });
  return { store, dataDir, create };
}

test('active task navigation reflects structured blockers without modifying the formal record or full recall', t => {
  const { store, create } = fixture(t), original = task(), receipt = create(original), id = receipt.results[0].memory_id;
  const before = store.db.prepare('SELECT * FROM memories WHERE id=?').get(id), revision = store.getWorkspace('w').workspace_revision;
  const entry = store.browse({ workspaceId: 'w' }).entries[0], bundle = store.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'fresh-turn' });
  assert.match(entry.index_hint, /Unresolved blockers are recorded/); assert.doesNotMatch(entry.index_hint, /STALE_HINT_763|only three|unittest accepted/);
  assert.match(bundle.index_markdown, /Unresolved blockers are recorded/); assert.doesNotMatch(bundle.index_markdown, /STALE_HINT_763/);
  const full = store.read({ workspaceId: 'w', ids: [id] })[0];
  assert.deepEqual(full.record.content, original); assert.equal(full.record.content.payload.blockers.length, 4); assert.match(full.markdown, /unittest acceptance pending/);
  assert.deepEqual(store.db.prepare('SELECT * FROM memories WHERE id=?').get(id), before);
  assert.equal(store.getWorkspace('w').workspace_revision, revision);
});

test('one blocker entry can contain multiple choices; empty or absent arrays never imply completion', () => {
  assert.equal(renderIndexHint(task(['first choice', 'second choice', 'third choice', 'fourth choice'])), renderIndexHint(task(['Four distinct choices are still pending in this one entry.'])));
  assert.match(renderIndexHint(task([])), /No blockers are recorded; completion is not inferred/);
  assert.match(renderIndexHint(task(null)), /Blocker status is not recorded/);
  const stable = { ...task(), category: 'stable', payload: { kind: 'markdown', text: 'Stable rule.' } };
  const activeMarkdown = { ...task(), format_reason: 'Freeform work note', payload: { kind: 'markdown', text: 'Active note.' } };
  assert.equal(renderIndexHint(stable), stable.index_hint); assert.equal(renderIndexHint(activeMarkdown), activeMarkdown.index_hint);
});

test('a new rendering version invalidates same-revision cached indexes only for new turns across connections', t => {
  const { store, dataDir, create } = fixture(t); create(task());
  const revision = store.getWorkspace('w').revision, legacyMarkdown = '# MEMORY.md\nSTALE_HINT_763: only three choices remain';
  const legacy = { state: 'ready', bundle_id: 'legacy-bundle', workspace_id: 'w', session_id: 's', turn_id: 'legacy-turn', snapshot_ref: `r${revision}`, workspace_revision: `r${revision}`, index_markdown: legacyMarkdown, index_hash: digest(legacyMarkdown), index_changed: false, notifications: [] };
  const body = JSON.stringify(legacy);
  store.db.prepare('INSERT INTO index_cache VALUES (?,?,?,?)').run('w', revision, legacyMarkdown, legacy.index_hash);
  store.db.prepare('INSERT INTO bundles(workspace_id,session_id,turn_id,bundle,observations,provided,created_at) VALUES (?,?,?,?,?,?,?)').run('w', 's', 'legacy-turn', body, '[]', 1, Date.now());
  store.db.prepare('UPDATE sessions SET last_index_hash=?,last_revision=? WHERE workspace_id=? AND id=?').run(legacy.index_hash, revision, 'w', 's');
  const other = new MemoryStore({ dataDir }); t.after(() => other.close());
  assert.deepEqual(other.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'legacy-turn' }), legacy);
  const next = other.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'new-rendering-turn' });
  assert.match(next.index_hash, new RegExp(`^${INDEX_RENDER_VERSION}:`)); assert.equal(next.index_changed, true);
  assert.match(next.index_markdown, /Unresolved blockers are recorded/); assert.doesNotMatch(next.index_markdown, /STALE_HINT_763/);
  assert.equal(store.db.prepare('SELECT bundle FROM bundles WHERE turn_id=?').get('legacy-turn').bundle, body, 'Already supplied historical bundles remain byte-for-byte immutable');
  assert.equal(other.getWorkspace('w').revision, revision);
  // A still-running older host may replace the shared cache with its old format.
  // The next new renderer must recognize the missing format stamp again.
  store.db.prepare('UPDATE index_cache SET markdown=?,hash=? WHERE workspace_id=?').run(legacyMarkdown, legacy.index_hash, 'w');
  const again = other.prepareTurn({ workspaceId: 'w', sessionId: 's', turnId: 'after-legacy-cache-write' });
  assert.equal(again.index_markdown, next.index_markdown); assert.equal(again.index_hash, next.index_hash);
});
