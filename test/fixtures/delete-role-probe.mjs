// Fresh-process regression only: no provider or credential configuration.
import { harness, text } from './harness.mjs';
import { createHostAdapter } from '../../src/host/index.js';
const [root, sessionId, storageJson] = process.argv.slice(2);
const h = await harness(() => text({ unused: true }), { root });
const host = createHostAdapter(h.ctx);
try {
  try { process.stdout.write(JSON.stringify(await host.deleteRoleSession(sessionId, { storage: JSON.parse(storageJson) }))); }
  catch (error) { process.stdout.write(JSON.stringify({ code: error.code, message: error.message })); }
} finally { await host.close(); await h.close(); }
