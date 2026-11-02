import assert from 'node:assert/strict';
import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { unpackOwnPackage } from './package-utils.mjs';
import { hasPrivatePattern, prohibitedArtifact } from './public-policy.mjs';

const bundle = await unpackOwnPackage();
try {
  const { packageRoot, manifest, packed } = bundle;
  const files = packed.files.map(f => f.path);
  for (const required of ['lib/index.js', 'lib/client.js', 'lib/build.json', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'README.md', 'README.en.md', 'schemas/memory-contracts.schema.json']) assert.ok(files.includes(required), `Missing ${required}`);
  for (const file of files) {
    assert.ok(!prohibitedArtifact.test(file) && !/^(src|test|scripts|prompts|node_modules)\//.test(file), `Unexpected distributed file: ${file}`);
    assert.ok(file === 'package.json' || manifest.files.some(p => file === p || file.startsWith(p + '/')), `File outside manifest allowlist: ${file}`);
    const stat = await lstat(path.join(packageRoot, file)); assert.ok(stat.isFile() && !stat.isSymbolicLink());
    const bytes = await readFile(path.join(packageRoot, file)); assert.ok(!bytes.includes(0), `Unexpected binary file: ${file}`);
    assert.ok(!hasPrivatePattern(file, bytes.toString('utf8')), `Private data pattern in archive: ${file}`);
  }
  assert.equal(manifest.name, 'dsh-automemory'); assert.equal(manifest.license, 'MIT');
  assert.equal(manifest.version, JSON.parse(await readFile(path.join(packageRoot, 'lib/build.json'), 'utf8')).version);
  for (const lifecycle of ['preinstall', 'install', 'postinstall', 'prepare']) assert.ok(!manifest.scripts?.[lifecycle], `Installation lifecycle not expected: ${lifecycle}`);
  for (const file of ['lib/index.js', 'lib/client.js']) execFileSync(process.execPath, ['--check', path.join(packageRoot, file)]);
  console.log(`Archive verified: ${files.length} files; ${manifest.name}@${manifest.version}; no private paths, reports or install lifecycle scripts.`);
} finally { await bundle.cleanup(); }
