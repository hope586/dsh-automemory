// Defense in depth, not a guarantee that arbitrary material is safe to publish.
// This one UUID is a deliberate, deterministic untitled-session test fixture.
const fixtureSession = 'session-' + '12345678-1234-1234-1234-123456789abc';
const privateData = /(?:\/Users\/|\/home\/[^/\s]+\/|session-[a-f0-9]{8}-[a-f0-9-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{20,}|DSH_AUTH_TOKEN=[A-Za-z0-9_-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----)/;
export function hasPrivatePattern(file, content) {
  const syntheticFixtures = new Set(['test/client.test.mjs', 'test/global-api.test.mjs']);
  const normalized = syntheticFixtures.has(file) ? content.replaceAll(fixtureSession, 'synthetic-session-id') : content;
  return privateData.test(normalized);
}
export function allowedPublicFile(file) {
  const top = new Set(['.gitignore', '.gitattributes', 'package.json', 'pnpm-lock.yaml', 'cordis.patch.yml', 'README.md', 'README.en.md', 'SPEC.md', 'HOST-API.md', 'UI-API.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'SECURITY.md']);
  return top.has(file) || /^(src|test|scripts|prompts|schemas|licenses|lib|docs)\/[A-Za-z0-9_./-]+\.(?:js|mjs|json|md|css|txt|yml)$/.test(file) || file === '.github/workflows/ci.yml';
}
export const prohibitedArtifact = /(?:^|\/)(?:acceptance|sessions|storages|dsh-home|node_modules|artifacts)\/|\.(?:jsonl(?:\.zstd)?|sqlite(?:-wal|-shm)?|tgz|log)$|(?:^|\/)(?:\.credentials\.ya?ml|\.env(?:\..*)?)$/;
