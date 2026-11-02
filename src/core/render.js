const line = value => String(value).replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
export const INDEX_RENDER_VERSION = 'index-render-v2';
/** Task navigation is a projection of the structured record. Its independent
 * authored hint must not summarize away blockers that the record still keeps.
 * A string-array entry may contain several decisions, so do not infer counts. */
export function renderIndexHint(content) {
  const payload = content.payload;
  if (content.category !== 'active' || payload?.kind !== 'task') return content.index_hint;
  const blockers = !Array.isArray(payload.blockers) ? 'Blocker status is not recorded.'
    : payload.blockers.length ? 'Unresolved blockers are recorded.'
      : 'No blockers are recorded; completion is not inferred.';
  return `Goal: ${payload.goal}. ${blockers} Read the full memory for progress, blocker details and next actions.`;
}
export function renderMemory(record, issueRefs = []) {
  const c = record.content, p = c.payload;
  const lines = [`# ${c.title}`, '', `ID: ${record.id} · Version: ${record.version} · Status: ${record.status}`, `Applicability: ${c.conditions || '(not further specified)'}`];
  if (record.status !== 'current') lines.push(`Historical / inactive: ${record.status_reason || record.status}. Do not treat this as a current conclusion.`);
  if (issueRefs.length) lines.push(`Unresolved issues: ${issueRefs.join(', ')}. Disputed statements are not unconditional facts.`);
  lines.push('');
  if (p.kind === 'markdown') lines.push(p.text);
  else {
    lines.push(`Goal: ${p.goal}`);
    for (const [key, label] of [['progress', 'Progress'], ['blockers', 'Blockers'], ['next_actions', 'Next actions']]) if (p[key]?.length) lines.push('', `## ${label}`, ...p[key].map(x => `- ${x}`));
    if (p.references?.length) lines.push('', '## References', ...p.references.map(x => `- ${x.locator}`));
  }
  lines.push('', 'Sources (retained provenance; historical sources are not all reconfirmed or proof of every current statement):', ...record.source_refs.map(x => `- ${x.locator}${x.version_hint ? ` (${x.version_hint})` : ''}`));
  if (record.change_source_refs?.length) lines.push('', 'Evidence for the latest change:', ...record.change_source_refs.map(x => `- ${x.locator}${x.version_hint ? ` (${x.version_hint})` : ''}`));
  return lines.join('\n');
}
export function renderIndex(entries) {
  const lines = ['# MEMORY.md', '', 'Read relevant memory IDs for full content and applicability. This index is a derived snapshot, not project ground truth.'];
  for (const category of ['stable', 'active']) {
    lines.push('', `## ${category === 'stable' ? 'Stable' : 'Active'}`);
    const rows = entries.filter(x => x.category === category);
    if (!rows.length) { lines.push('(none)'); continue; }
    let group;
    for (const row of rows) {
      if (row.group !== group) { group = row.group; lines.push('', `### ${line(group)}`); }
      lines.push(`- ${row.id} | ${line(row.title)} | ${line(row.index_hint)}${row.issue_refs?.length ? ` | unresolved: ${row.issue_refs.join(', ')}` : ''}`);
    }
  }
  return lines.join('\n');
}
