/** Session evidence references have one canonical form. Unknown spellings must
 * fail closed, never become an unrestricted reference outside the audit cut. */
export function sessionReference(locator) {
  if (typeof locator !== 'string') return null;
  const match = /^([^\s/#]+)#events?:(\d+)(?:-(\d+))?$/.exec(locator)
    || /^session:([^\s/]+)\/events?:(\d+)(?:-(\d+))?$/.exec(locator)
    || /^session:\/\/([^\s/]+)\/events?\/(\d+)(?:-(\d+))?$/.exec(locator);
  if (!match) return null;
  const start = Number(match[2]), end = Number(match[3] ?? match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) return null;
  return { sessionId: match[1], start, end };
}
export function insideEvidence(ranges, start, end) {
  let next = start;
  for (const range of [...ranges].sort((a, b) => a.startExclusive - b.startExclusive)) {
    if (range.endInclusive < next) continue;
    if (range.startExclusive + 1 > next) return false;
    next = Math.max(next, range.endInclusive + 1);
    if (next > end) return true;
  }
  return false;
}
