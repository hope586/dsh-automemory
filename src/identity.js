import { execFileSync } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const cache = new Map();
export function workspaceIdentity(cwd) {
  if (typeof cwd !== 'string' || !path.isAbsolute(cwd)) throw Object.assign(new Error('A trusted absolute session working directory is required.'), { code: 'WORKSPACE_UNAVAILABLE' });
  const real = realpathSync(cwd);
  if (!statSync(real).isDirectory()) throw new Error('Workspace is not a directory.');
  const hit = cache.get(real); if (hit && Date.now() - hit.at < 5000) return hit.value;
  let root = real, identity = real, currentRoot = real;
  try {
    const output = execFileSync('git', ['-C', real, 'rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'], { encoding: 'utf8', timeout: 3000, stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n');
    identity = realpathSync(output[0]); currentRoot = realpathSync(output[1]);
    root = path.basename(identity) === '.git' ? path.dirname(identity) : identity;
  } catch { /* Non-Git projects use their trusted cwd; never merge by remote URL. */ }
  const value = { id: 'W' + createHash('sha256').update(identity).digest('hex').slice(0, 24), root, currentRoot, name: path.basename(root) };
  cache.set(real, { at: Date.now(), value }); return value;
}
