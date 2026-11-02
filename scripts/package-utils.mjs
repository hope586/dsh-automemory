import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('..', import.meta.url));
export async function unpackOwnPackage({ nearDependencies = false } = {}) {
  const base = nearDependencies ? path.join(root, 'node_modules', '.cache') : tmpdir();
  await mkdir(base, { recursive: true });
  const directory = await mkdtemp(path.join(base, 'automemory-package-'));
  try {
    const env = { ...process.env, npm_config_cache: path.join(directory, 'cache'), npm_config_loglevel: 'error' };
    const [packed] = JSON.parse(execFileSync('npm', ['pack', '--json', '--ignore-scripts', '--pack-destination', directory], { cwd: root, env, encoding: 'utf8' }));
    const archive = path.join(directory, packed.filename);
    const members = execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' }).trim().split('\n');
    assert.ok(members.every(p => p.startsWith('package/') && !p.split('/').includes('..') && !p.startsWith('/')), 'Archive paths must remain in package/');
    execFileSync('tar', ['-xzf', archive, '-C', directory]);
    const packageRoot = path.join(directory, 'package');
    const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8'));
    return { directory, archive, packageRoot, manifest, packed, cleanup: () => rm(directory, { recursive: true, force: true }) };
  } catch (error) { await rm(directory, { recursive: true, force: true }); throw error; }
}
