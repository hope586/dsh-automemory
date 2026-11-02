import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { allowedPublicFile, prohibitedArtifact, hasPrivatePattern } from './public-policy.mjs';

const rows = execFileSync('git', ['ls-files', '--stage', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
assert.ok(rows.length > 0, 'Stage the intended public source before verification');
for (const row of rows) {
  const [index, file] = row.split('\t');
  assert.ok(index.startsWith('100644 ') || index.startsWith('100755 '), `Unsupported staged type: ${file}`);
  assert.ok(allowedPublicFile(file) && !prohibitedArtifact.test(file), `File outside public allowlist: ${file}`);
  const bytes = execFileSync('git', ['show', `:${file}`], { maxBuffer: 8 * 1024 * 1024 });
  assert.ok(bytes.length <= 5 * 1024 * 1024 && !bytes.includes(0), `Unexpected binary/large file: ${file}`);
  assert.ok(!hasPrivatePattern(file, bytes.toString('utf8')), `Private-data pattern in staged ${file}`);
  assert.deepEqual(readFileSync(file), bytes, `Unstaged changes in ${file}; verify the exact intended tree`);
}
const untracked = execFileSync('git', ['ls-files', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
assert.deepEqual(untracked, [], 'Review or remove untracked public files before release');
console.log(`Public index verified: ${rows.length} text source/test/documentation files; no private artifact paths or known secret/session patterns.`);
