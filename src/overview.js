import { createHash } from 'node:crypto';
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 24);
const fail = (code, message) => { throw Object.assign(new Error(message), { code }); };
const excerpt = record => {
  const p = record.content.payload;
  if (p.kind === 'markdown') return p.text;
  return [p.goal, ...(p.progress || []).map(x => `- ${x}`), ...(p.blockers || []).map(x => `- 待解决：${x}`), ...(p.next_actions || []).map(x => `- 下一步：${x}`)].filter(Boolean).join('\n');
};

/** A grounded human view, rebuilt from current facts without model calls on read. */
export function getOverview(store, workspaceId) {
  return buildOverview(store, workspaceId, store.exportSnapshot(workspaceId));
}
function buildOverview(store, workspaceId, snapshot) {
  const records = snapshot.records.filter(r => r.status === 'current');
  const sourceHash = hash({ records, issues: snapshot.issues });
  const row = store._get('SELECT * FROM overview_views WHERE workspace_id=?', workspaceId);
  const saved = row ? JSON.parse(row.payload) : null;
  const exact = row?.source_hash === sourceHash;
  const remaining = new Map(records.map(r => [r.id, r]));
  const topics = [];
  const topic = (id, title, members, summary) => {
    const memoryIds = members.map(m => m.id);
    const issueIds = snapshot.issues.filter(i => (i.proposal?.affected || []).some(x => memoryIds.includes(x.memory_id))).map(i => i.id);
    return { id, title, memoryIds, issueIds,
      summary: summary ?? members.map(m => `### ${m.content.title}\n\n${excerpt(m)}${m.content.conditions ? '\n\n适用范围：' + m.content.conditions : ''}`).join('\n\n'),
      entries: members.map(m => ({ id: m.id, title: m.content.title, version: m.version })) };
  };
  // Preserve a user's thematic arrangement while recomputing stale prose. Never
  // serve a summary derived from deleted or changed facts as the current truth.
  for (const t of saved?.topics || []) {
    const members = t.memoryIds.map(id => remaining.get(id)).filter(Boolean);
    if (!members.length) continue;
    members.forEach(m => remaining.delete(m.id));
    topics.push(topic(t.id, t.title, members, exact ? t.summary : undefined));
  }
  const groups = new Map();
  for (const r of remaining.values()) {
    const name = r.content.group?.trim() || '项目约定';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(r);
  }
  for (const [name, members] of groups) topics.push(topic('T_' + hash(name), name, members));
  const summary = exact && saved?.summary ? saved.summary : topics.map(t => {
    const members = t.memoryIds.map(id => records.find(r => r.id === id));
    return `### ${t.title}\n\n` + members.map(r => `- **${r.content.title}**：${excerpt(r)}${r.content.conditions ? '（适用范围：' + r.content.conditions + '）' : ''}`).join('\n');
  }).join('\n\n');
  return { revision: sourceHash + ':' + (row?.revision || 0), sourceRevision: snapshot.workspace_revision,
    summary, topics, memoryCount: records.length, issueCount: snapshot.issues.length,
    derived: true, summaryMode: exact && saved ? 'organized' : 'current-facts' };
}

/** Model/user-authored organization remains a version-bound projection, never authority. */
export function updateOverview(store, { workspaceId, expectedRevision, summary, topics }) {
  return store._tx(() => {
    return saveOverview(store, { workspaceId, expectedRevision, summary, topics });
  });
}
function saveOverview(store, input) {
  const workspaceId = input.workspaceId;
  const current = buildOverview(store, workspaceId, {
    workspace_revision: store.getWorkspace(workspaceId).workspace_revision,
    records: store._all('SELECT * FROM memories WHERE workspace_id=? ORDER BY id', workspaceId).map(x => store._record(x)),
    issues: store.listIssues({ workspaceId }),
  });
  if (current.revision !== input.expectedRevision) fail('VERSION_CONFLICT', 'Memory changed; read the current overview before reorganizing it.');
  if (typeof input.summary !== 'string' || input.summary.length > 32000 || !Array.isArray(input.topics) || input.topics.length > 100) fail('INVALID_OVERVIEW', 'Provide a bounded summary and topic list.');
  const known = new Set(current.topics.flatMap(t => t.memoryIds)), used = new Set(), topicIds = new Set();
  const topics = input.topics.map(t => {
    if (!t || typeof t.id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(t.id) || topicIds.has(t.id) || typeof t.title !== 'string' || !t.title.trim() || t.title.length > 200 || typeof t.summary !== 'string' || t.summary.length > 32000 || !Array.isArray(t.memoryIds) || !t.memoryIds.length) fail('INVALID_OVERVIEW', 'Each topic requires a unique ID, title, grounded summary and memory references.');
    topicIds.add(t.id);
    for (const id of t.memoryIds) { if (!known.has(id) || used.has(id)) fail('SOURCE_SCOPE_MISMATCH', 'Topics must reference current memories in this project exactly once.'); used.add(id); }
    return { id: t.id, title: t.title, summary: t.summary, memoryIds: t.memoryIds };
  });
  if (used.size !== known.size) fail('INVALID_OVERVIEW', 'The project overview must account for every current memory.');
  const [sourceHash, version] = current.revision.split(':');
  store._run('INSERT INTO overview_views VALUES(?,?,?,?) ON CONFLICT(workspace_id) DO UPDATE SET source_hash=excluded.source_hash,revision=excluded.revision,payload=excluded.payload', input.workspaceId, sourceHash, Number(version) + 1, JSON.stringify({ summary: input.summary, topics }));
  store._event(input.workspaceId, 'MEMORY_UI', 'overview.organized', { changed: true, metadata: { topic_count: topics.length } });
  return { status: 'committed', revision: sourceHash + ':' + (Number(version) + 1), topicCount: topics.length };
}
