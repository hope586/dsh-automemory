import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const inventory = JSON.parse(await readFile('licenses/bundled-components.json', 'utf8'));
const actual = new Map();
for (const config of [
  { entryPoints: ['src/index.js'], bundle: true, platform: 'node', format: 'esm', external: ['@deepseek-ai/*'], loader: { '.md': 'text' } },
  { entryPoints: ['src/client.js'], bundle: true, platform: 'browser', format: 'iife' },
]) {
  const result = await build({ ...config, write: false, metafile: true });
  for (const file of Object.keys(result.metafile.inputs)) {
    if (!file.includes('node_modules/')) continue;
    let directory = path.dirname(path.resolve(file));
    while (directory !== path.dirname(directory)) {
      try {
        const manifest = JSON.parse(await readFile(path.join(directory, 'package.json'), 'utf8'));
        if (manifest.name) { actual.set(manifest.name, { manifest, directory }); break; }
      } catch (error) { if (error.code !== 'ENOENT') throw error; }
      directory = path.dirname(directory);
    }
  }
}
assert.deepEqual([...actual.keys()].sort(), inventory.components.map(c => c.name).sort(), 'Bundle contents and license inventory differ');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
for (const component of inventory.components) {
  const { manifest, directory } = actual.get(component.name);
  assert.equal(manifest.version, component.version); assert.equal(manifest.license, component.license);
  const local = await readFile(path.join('licenses', component.licenseFile)); assert.equal(sha(local), component.sha256);
  let upstream;
  for (const filename of ['LICENSE', 'LICENSE.txt', 'LICENSE.md', 'license', 'license.txt']) {
    try { await access(path.join(directory, filename)); upstream = await readFile(path.join(directory, filename)); break; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  assert.ok(upstream, `Installed license missing for ${component.name}`); assert.deepEqual(local, upstream);
}
console.log(`Bundle licenses verified: ${actual.size} components, exact versions and unmodified license files.`);
