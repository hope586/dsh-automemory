import { createHash, randomUUID } from 'node:crypto';
import { realpathSync, statSync, readdirSync, constants } from 'node:fs';
import { lstat, readdir, unlink, open } from 'node:fs/promises';
import path from 'node:path';
import { Session, buildForkSeed, canonicalHeader, headerEquals } from '@deepseek-ai/dsh-session';
import { defineTool } from '@deepseek-ai/dsh-tools';

const SOURCE = 'automemory';
const ROLE_PREFIX = 'automemory-';
const ROLE_SESSION_ID = /^automemory-(g2|dreamer|reviewer|manager)-[A-Za-z0-9_-]{1,128}$/;
const NATIVE_READ_TOOLS = ['read', 'grep', 'glob'];
const textOf = message => message?.content?.filter(b => b.type === 'text').map(b => b.text).join('\n') || '';
// Storage may canonicalize object key order. Hash JSON meaning, preserving
// array/event order, rather than the producer's incidental property order.
const canonicalJson = value => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const hash = value => createHash('sha256').update(canonicalJson(value)).digest('hex');
const detached = value => JSON.parse(JSON.stringify(value));
const failure = (code, message) => Object.assign(new Error(message), { code });
export const isMemoryAgent = agent => Boolean(agent?.id?.startsWith(ROLE_PREFIX));

function estimateRequestInput(ctx, session, options) {
  const byteUpperTokens = Buffer.byteLength(JSON.stringify({ messages: options.messages, tools: options.tools || [] })) + 4096;
  const fallback = fallbackReason => ({ method: 'byte-fallback', reliable: false, rawEstimateTokens: null, byteUpperTokens, approximate: true, provider: options.provider, model: options.model, fallbackReason });
  const meter = ctx.get('tokenMeter');
  if (typeof meter?.measure !== 'function') return fallback('TOKEN_METER_UNAVAILABLE');
  try {
    // AgentLoop records this canonical header before dispatch. Compare its
    // actual envelope and effective surface rather than measuring an older
    // parent snapshot or trusting a usage anchor from another model route.
    const header = session.requestHeader();
    const actualHeader = canonicalHeader({ config: options, adapterDefaults: header?.adapterDefaults, tools: options.tools });
    if (!header || !headerEquals(header, actualHeader)) return fallback('REQUEST_HEADER_MISMATCH');
    const revision = session.seq;
    if (hash(session.deriveMessages()) !== hash(options.messages)) return fallback('REQUEST_SURFACE_MISMATCH');
    const measured = meter.measure(session, header);
    const nonnegative = value => Number.isSafeInteger(value) && value >= 0;
    if (session.seq !== revision || measured?.logRevision !== revision ||
        !['usage', 'estimated', 'none'].includes(measured?.baseline?.kind) || !nonnegative(measured?.baseline?.tokens) ||
        !nonnegative(measured?.surfaceTokens) || !Number.isSafeInteger(measured?.surfaceDeltaTokens) ||
        !nonnegative(measured?.totalTokens) || measured.totalTokens === 0 ||
        measured.totalTokens !== Math.max(0, measured.baseline.tokens + measured.surfaceDeltaTokens)) return fallback('TOKEN_METER_INVALID');
    // This is the public native estimate, not tokenizer-exact billing or a
    // strict upper bound. The controller adds its margin once and settles
    // actual provider usage separately. The meter itself re-prices the whole
    // surface when headerEquals rejects a historical usage anchor.
    return { method: 'native-token-meter', reliable: true, rawEstimateTokens: measured.totalTokens, byteUpperTokens, approximate: true,
      provider: options.provider, model: options.model, baselineKind: measured.baseline.kind, baselineTokens: measured.baseline.tokens,
      surfaceDeltaTokens: measured.surfaceDeltaTokens, surfaceTokens: measured.surfaceTokens, logRevision: measured.logRevision };
  } catch { return fallback('TOKEN_METER_FAILED'); }
}

function routeOf(agent) {
  const persisted = agent.session.requestHeader()?.config || {};
  const live = agent.options || {};
  const provider = persisted.provider || live.provider;
  const model = persisted.model || live.model;
  if (!provider || !model) throw failure('MODEL_UNCONFIGURED', 'No effective provider/model is configured.');
  return {
    provider, model,
    ...(persisted.reasoningEffort || live.reasoningEffort ? { reasoningEffort: persisted.reasoningEffort || live.reasoningEffort } : {}),
  };
}

function normalizedRoot(root) {
  if (!root || !path.isAbsolute(root)) throw failure('INVALID_WORKSPACE', 'An absolute workspace root is required.');
  const resolved = realpathSync.native(root);
  if (!statSync(resolved).isDirectory()) throw failure('INVALID_WORKSPACE', 'Workspace root is not a directory.');
  return resolved;
}
const contains = (root, target) => target === root || target.startsWith(root + path.sep);
function canonicalStorageRoot(root) {
  if (typeof root !== 'string' || !path.isAbsolute(root)) return null;
  const suffix = [];
  let current = root;
  for (;;) {
    try { return path.join(realpathSync.native(current), ...suffix); }
    catch (error) {
      if (error?.code !== 'ENOENT' || path.dirname(current) === current) throw error;
      suffix.unshift(path.basename(current)); current = path.dirname(current);
    }
  }
}
export const storageIdentity = persistence => ({ name: persistence?.name || null, root: canonicalStorageRoot(persistence?.root) });

// Web/Desktop place their general file tools on a user-selected Agent preset,
// not the host. Background roles deliberately do not mount that development
// preset. These small local tools provide the missing read-only capability
// through the public ToolRuntime; no shell, subprocess, or network is needed.
function roleFileTools(guard) {
  const maxFileBytes = 32 * 1024 * 1024, maxOutputChars = 64 * 1024;
  const renderRead = value => {
    const { lines, ...metadata } = value;
    // Keep the structured value intact. Render file lines verbatim instead of
    // JSON-encoding the JSONL text a second time inside a lines[].text string.
    return JSON.stringify(metadata) + '\n' + lines.map(line => `L${line.number} column ${line.column}: ${line.text}`).join('\n');
  };
  const definition = (name, description, properties, required, execute) => defineTool({
    name, description, parameters: Object.fromEntries(Object.entries(properties).map(([key, { minimum, maximum, minLength, maxLength, ...schema }]) => [key, { ...schema, ...(required.includes(key) ? { required: true } : {}) }])),
    output: { schema: { type: 'json' }, render: (_args, value) => [{ type: 'text', text: name === 'read' ? renderRead(value) : JSON.stringify(value) }] },
    execute(args, exec) {
      // DSH's public schema subset validates types, while bounded sizes/ranges
      // are enforced here before opening or searching any file.
      for (const [key, rule] of Object.entries(properties)) {
        const value = args[key]; if (value === undefined) continue;
        if ((rule.minimum !== undefined && value < rule.minimum) || (rule.maximum !== undefined && value > rule.maximum) ||
            (rule.minLength !== undefined && value.length < rule.minLength) || (rule.maxLength !== undefined && value.length > rule.maxLength)) throw failure('READ_ARGUMENT_INVALID', `${key} exceeds the supported read/search range.`);
      }
      return execute(args, exec);
    },
  });
  const string = { type: 'string' };
  const integer = (minimum, maximum, description) => ({ type: 'integer', minimum, maximum, description });
  async function readText(file, exec, maxBytes = maxFileBytes) {
    exec.signal?.throwIfAborted();
    const canonical = guard.resolvePath({ name: 'read', arguments: { file_path: file } });
    const handle = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
    try {
      const before = await handle.stat();
      const current = statSync(guard.resolvePath({ name: 'read', arguments: { file_path: file } }));
      if (!before.isFile() || before.dev !== current.dev || before.ino !== current.ino) throw failure('READ_PATH_UNAVAILABLE', 'The evidence file changed while opening it; retry the read.');
      if (before.size > maxBytes) throw failure('READ_LIMIT_EXCEEDED', `File exceeds the ${maxBytes}-byte read limit; select a smaller evidence file.`);
      // Read a fixed bound even if another writer grows the file after stat.
      const bytes = Buffer.alloc(before.size);
      let count = 0;
      while (count < bytes.length) {
        exec.signal?.throwIfAborted();
        const { bytesRead } = await handle.read(bytes, count, bytes.length - count, count);
        if (!bytesRead) break;
        count += bytesRead;
      }
      const after = await handle.stat();
      if (after.size !== before.size || after.mtimeMs !== before.mtimeMs) throw failure('READ_PATH_UNAVAILABLE', 'The evidence file changed while reading it; retry the read.');
      const content = bytes.subarray(0, count), binary = content.includes(0);
      // Return consumed bytes even for skipped binary files. Otherwise a tree
      // of binary inputs could evade grep's total read budget indefinitely.
      return { text: binary ? null : content.toString('utf8'), bytes: count, binary };
    } finally { await handle.close(); }
  }
  async function filesUnder(target, exec) {
    if (statSync(target).isFile()) return [target];
    const queue = [{ directory: target, depth: 0 }], files = [];
    let inspected = 0;
    while (queue.length) {
      exec.signal?.throwIfAborted();
      const { directory, depth } = queue.pop();
      if (depth > 32) throw failure('READ_LIMIT_EXCEEDED', 'Search is too deep; select a smaller subdirectory.');
      // Recheck before every directory read, including any changes after the
      // monotonic guard admitted the call.
      const canonical = guard.resolvePath({ name: 'glob', arguments: { path: directory, pattern: '*' } });
      for (const entry of await readdir(canonical, { withFileTypes: true })) {
        if (++inspected > 5000) throw failure('READ_LIMIT_EXCEEDED', 'Search is too broad; select a smaller subdirectory.');
        const file = path.join(canonical, entry.name);
        if (entry.isDirectory()) queue.push({ directory: file, depth: depth + 1 });
        else if (entry.isFile()) files.push(guard.resolvePath({ name: 'read', arguments: { file_path: file } }));
        else throw failure('READ_SCOPE_DENIED', 'Search encountered a symbolic link or unsupported entry; select a safe subdirectory.');
      }
    }
    return files.sort();
  }
  return [
    definition('read', 'Read authorized UTF-8 project or exact supplied evidence files. Offset is a 1-based line number. Output: metadata JSON first, then L<number> column <offset>: verbatim line text. If truncated, continue with next_offset and next_column; never treat a partial page as the whole source.', {
      file_path: string, offset: integer(1, 10000000, 'First line; defaults to 1.'),
      limit: integer(1, 500, 'Maximum lines; defaults to 200.'), column: integer(0, maxFileBytes, 'Character offset within the first line, for continuing a long JSONL record; defaults to 0.'),
    }, ['file_path'], async (args, exec) => {
      const file = guard.resolvePath({ ...exec, arguments: args });
      const { text, binary } = await readText(file, exec);
      if (binary) throw failure('READ_TEXT_REQUIRED', 'Only UTF-8 text evidence is supported.');
      const all = text.split('\n'), offset = args.offset ?? 1, limit = args.limit ?? 200;
      const lines = []; let remaining = maxOutputChars, nextOffset = offset, nextColumn = args.column ?? 0;
      for (let index = offset - 1; index < all.length && lines.length < limit; index++) {
        const column = index === offset - 1 ? args.column ?? 0 : 0;
        const line = all[index].slice(column), content = line.slice(0, remaining);
        lines.push({ number: index + 1, column, text: content }); remaining -= content.length;
        nextOffset = index + 2; nextColumn = 0;
        if (content.length < line.length) { nextOffset = index + 1; nextColumn = column + content.length; break; }
        if (!remaining) break;
      }
      const truncated = nextOffset <= all.length;
      return { path: file, lines, total_lines: all.length, truncated, ...(truncated ? { next_offset: nextOffset, next_column: nextColumn } : {}) };
    }),
    definition('grep', 'Search literal text (not a regular expression) within an authorized project directory or exact supplied evidence file. Results are bounded; use a narrower path or more specific text when truncated.', {
      pattern: { ...string, minLength: 1, maxLength: 1000 }, path: string, ignore_case: { type: 'boolean' }, limit: integer(1, 200, 'Maximum matches; defaults to 100.'),
    }, ['pattern'], async (args, exec) => {
      const target = guard.resolvePath({ ...exec, arguments: args }), matches = [];
      const pattern = args.ignore_case ? args.pattern.toLowerCase() : args.pattern;
      let bytesLeft = maxFileBytes, outputLeft = maxOutputChars;
      for (const file of await filesUnder(target, exec)) {
        if (statSync(file).size > bytesLeft) return { matches, truncated: true, limitation: 'Search input-byte limit reached; select a smaller path.' };
        const source = await readText(file, exec, bytesLeft);
        bytesLeft -= source.bytes;
        if (source.binary) continue;
        for (const [index, line] of source.text.split('\n').entries()) {
          if (!(args.ignore_case ? line.toLowerCase() : line).includes(pattern)) continue;
          const content = line.slice(0, Math.min(4000, outputLeft));
          matches.push({ path: file, line: index + 1, text: content, ...(content.length < line.length ? { line_truncated: true } : {}) }); outputLeft -= content.length;
          if (matches.length >= (args.limit ?? 100) || !outputLeft) return { matches, truncated: true };
        }
      }
      return { matches, truncated: false };
    }),
    definition('glob', 'Find project files using a relative glob pattern within a verified safe project directory. Supports *, ** and ?. Output is bounded; narrow the directory when truncated.', {
      pattern: { ...string, minLength: 1, maxLength: 256 }, path: string, limit: integer(1, 500, 'Maximum files; defaults to 200.'),
    }, ['pattern'], async (args, exec) => {
      const target = guard.resolvePath({ ...exec, arguments: args });
      const files = (await filesUnder(target, exec)).filter(file => path.matchesGlob(path.relative(target, file), args.pattern));
      return { files: files.slice(0, args.limit ?? 200), truncated: files.length > (args.limit ?? 200) };
    }),
  ];
}

/** A hard allowlist for background tools; prompt text cannot change it. */
export function createReadOnlyGuard({ workspaceRoot, nativeTools = NATIVE_READ_TOOLS, localTools = [], evidencePaths = [], allowedReadRoots = [], blockedRoots = [], protectedDirectoryNames = [], maxSearchEntries = 5000, maxSearchDepth = 32 }) {
  const root = normalizedRoot(workspaceRoot);
  const roots = [root, ...allowedReadRoots.map(normalizedRoot)];
  const blocked = blockedRoots.map(normalizedRoot);
  const privateNames = new Set(['.dsh', 'dsh-home', ...protectedDirectoryNames].map(name => String(name).toLowerCase()));
  const credentialName = name => ['.credentials.yaml', '.credentials.yml'].includes(name.toLowerCase());
  const protectedPath = target => blocked.some(r => contains(r, target)) || target.split(path.sep).some(part => privateNames.has(part.toLowerCase()));
  const exact = new Set(evidencePaths.map(p => {
    let file;
    try { file = realpathSync.native(p); }
    catch { throw failure('INVALID_EVIDENCE_FILE', `A supplied evidence file is unavailable: ${String(p)}. Regenerate the job evidence before retrying.`); }
    if (credentialName(path.basename(file)) || !statSync(file).isFile()) throw failure('INVALID_EVIDENCE_FILE', 'Evidence exceptions must be exact non-credential regular files.');
    return file;
  }));
  const native = new Set(nativeTools), local = new Set(localTools);
  const checkSearchTree = target => {
    // A search rooted above a private host directory cannot be allowed merely
    // because the starting directory itself is public project material.
    if (blocked.some(r => contains(target, r))) throw failure('READ_SCOPE_DENIED', 'Search includes protected host state. Select a known safe project subdirectory or an exact evidence file.');
    const queue = [{ directory: target, depth: 0 }];
    let inspected = 0;
    while (queue.length) {
      const { directory, depth } = queue.pop();
      if (depth > maxSearchDepth) throw failure('READ_SCOPE_DENIED', 'Search is too broad to verify safely; select a smaller project subdirectory.');
      let children;
      try { children = readdirSync(directory, { withFileTypes: true }); }
      catch { throw failure('READ_SCOPE_DENIED', 'Search subtree cannot be verified safely; select a smaller readable subdirectory.'); }
      for (const entry of children) {
        if (++inspected > maxSearchEntries) throw failure('READ_SCOPE_DENIED', 'Search is too broad to verify safely; select a smaller project subdirectory.');
        if (credentialName(entry.name) || privateNames.has(entry.name.toLowerCase())) throw failure('READ_SCOPE_DENIED', 'Search includes protected host state or credentials. Select a known safe project subdirectory.');
        // Refuse ambiguous links before the native tool runs. Do not read the
        // subtree and then filter output, and do not depend on a future search
        // backend preserving today\'s no-follow default.
        if (entry.isSymbolicLink()) throw failure('READ_SCOPE_DENIED', 'Search includes symbolic links and cannot be verified safely; select a narrower directory without links.');
        const child = path.join(directory, entry.name);
        if (protectedPath(child)) throw failure('READ_SCOPE_DENIED', 'Search includes protected host state. Select a known safe project subdirectory.');
        if (entry.isDirectory()) queue.push({ directory: child, depth: depth + 1 });
        else if (!entry.isFile()) throw failure('READ_SCOPE_DENIED', 'Search includes an unsupported filesystem entry; select a narrower directory.');
      }
    }
  };
  const resolvePath = exec => {
    const args = exec.arguments || {};
    const input = exec.name === 'read' ? args.file_path : args.path ?? root;
    if (typeof input !== 'string' || !input.trim() || input.includes('\0')) throw failure('READ_PATH_INVALID', 'AutoMemory read requires a valid path.');
    let target;
    try { target = realpathSync.native(path.isAbsolute(input) ? input : root + path.sep + input); }
    catch { throw failure('READ_PATH_UNAVAILABLE', 'AutoMemory evidence path is unavailable.'); }
    if (credentialName(path.basename(target))) throw failure('READ_SCOPE_DENIED', 'AutoMemory background roles cannot read credential files.');
    if (!roots.some(r => contains(r, target)) && !exact.has(target)) throw failure('READ_SCOPE_DENIED', 'AutoMemory evidence is outside the authorized project and selected session files.');
    if (protectedPath(target) && !exact.has(target)) throw failure('READ_SCOPE_DENIED', 'AutoMemory background roles cannot read protected host state. Use only the job\'s exact supplied evidence files.');
    if (exec.name === 'glob' && typeof args.pattern === 'string' && (path.isAbsolute(args.pattern) || args.pattern.split(/[\\/]/).includes('..'))) throw failure('READ_SCOPE_DENIED', 'AutoMemory glob patterns must stay within the authorized search directory.');
    const stat = statSync(target);
    if (exec.name === 'read' && !stat.isFile()) throw failure('READ_SCOPE_DENIED', 'AutoMemory read requires an exact regular file.');
    if (exec.name === 'grep' || exec.name === 'glob') {
      if (stat.isDirectory()) checkSearchTree(target);
      else if (!stat.isFile() || exec.name === 'glob') throw failure('READ_SCOPE_DENIED', 'AutoMemory search requires a safe regular file or verified project directory.');
    }
    return target;
  };
  const guard = exec => {
    if (local.has(exec.name)) return;
    if (!native.has(exec.name)) return `AutoMemory background role cannot execute ${exec.name}.`;
    // Native realpath preserves POSIX symlink/.. traversal; path.resolve would
    // erase that distinction before validating the actual filesystem target.
    try { resolvePath(exec); } catch (error) { return error.message; }
  };
  guard.resolvePath = resolvePath;
  return guard;
}

/**
 * One persisted logical bundle per user turn. Reconstruction after compaction
 * reuses the same bundle, and only committed surface messages mark delivery.
 */
export function installTurnMemory(ctx, { prepareTurn, onProvided, onSessionEvent, onError = () => {} }) {
  const pending = new Map();
  const indexNodes = new Map();
  const closed = new AbortController();
  const report = (error, context) => { try { Promise.resolve(onError(error, context)).catch(() => {}); } catch {} };
  const stops = [];
  stops.push(ctx.on('agent/pre-step', async ({ agent, turn, signal }, next) => {
    const decision = await next();
    if (decision.kind !== 'enter' || isMemoryAgent(agent) || closed.signal.aborted) return decision;
    const turnId = `${agent.session.id}:${turn}`;
    const visibleMessages = [...agent.session.deriveMessages(), ...decision.messages];
    const ownMessages = visibleMessages.filter(m => m.source?.kind === SOURCE && m.source?.turnId === turnId);
    const visibleIndex = ownMessages.find(m => m.source.part !== 'revisions');
    const visibleRevisions = ownMessages.find(m => m.source.part === 'revisions' && (!visibleIndex || m.source.bundleId === visibleIndex.source.bundleId));
    if (visibleIndex && (!visibleIndex.source.expectsRevisions || visibleRevisions)) return decision;
    let bundle;
    try {
      bundle = await prepareTurn({ agent, sessionId: agent.session.id, turn, turnId, signal: AbortSignal.any([signal, closed.signal]) });
    } catch (error) {
      report(error, { operation: 'prepare-turn', sessionId: agent.session.id, turnId });
      bundle = { bundle_id: `unavailable:${turnId}`, text: 'AutoMemory is unavailable for this turn. This does not mean the project has no saved memory. Use current project evidence and do not claim memory was synchronized.' };
    }
    if (!bundle?.text && !bundle?.indexText && !bundle?.revisionsText) return decision;
    // Seed the active index-node map once after plugin load/resume. Use the
    // public observation service, never deprecated synchronous event reads.
    if (!indexNodes.has(agent.session.id)) {
      const nodes = new Map();
      if (agent.session.deriveMessages().some(m => m.source?.kind === SOURCE && m.source.part === 'index')) {
        const observation = await ctx.sessionQuery.observeSession(agent.session.id, { projectionMode: 'none', signal });
        try {
          for (const event of observation.events) if (event.type === 'user/message' && event.data?.source?.kind === SOURCE && event.data.source.part === 'index') nodes.set(event.seq, event.data.source);
        } finally { observation[Symbol.dispose](); }
      }
      indexNodes.set(agent.session.id, nodes);
    }
    const additions = [];
    const split = bundle.indexText !== undefined || bundle.revisionsText !== undefined;
    if (split && bundle.indexText) {
      const nodes = indexNodes.get(agent.session.id);
      const active = new Set(agent.session.surface.nodes);
      for (const [seq, old] of nodes) {
        if (old.turnId === turnId) continue;
        nodes.delete(seq);
        if (!active.has(seq)) continue;
        try {
          agent.session.append('user/message', { id: randomUUID(), role: 'user', content: [{ type: 'text', text: 'Previous AutoMemory index superseded by the current turn.' }], source: { kind: 'automemory-superseded', bundleId: old.bundleId } }, { surfaceOp: { op: 'replace', startSeq: seq, endSeq: seq }, sourceEventSeqs: [seq] });
        } catch (error) { report(error, { operation: 'retire-index', sessionId: agent.session.id }); }
      }
    }
    const parts = split ? [
      { part: 'index', text: bundle.indexText, exists: visibleIndex, completesBundle: !bundle.revisionsText },
      { part: 'revisions', text: bundle.revisionsText, exists: visibleRevisions, completesBundle: true },
    ] : [{ part: 'legacy', text: bundle.text, exists: visibleIndex, completesBundle: true }];
    for (const part of parts) {
      if (!part.text || part.exists) continue;
      const message = {
        id: randomUUID(), role: 'user', content: [{ type: 'text', text: part.text }],
        source: { kind: SOURCE, turnId, bundleId: bundle.bundle_id, part: part.part, expectsRevisions: Boolean(bundle.revisionsText), completesBundle: part.completesBundle, provided: part.completesBundle ? bundle.provided || [] : [] },
      };
      pending.set(message.id, { agent, sessionId: agent.session.id, turnId, bundleId: bundle.bundle_id, provided: part.completesBundle ? bundle.provided || [] : [] });
      additions.push(message);
    }
    return { ...decision, messages: [...decision.messages, ...additions] };
  }));
  stops.push(ctx.on('session/event', (session, event) => {
    if (event.type === 'user/message' && event.data?.source?.kind === SOURCE && event.surfaceOp) {
      const source = event.data.source;
      const info = pending.get(event.data.id) || { agent: ctx.agents?.get(session.id), sessionId: session.id, turnId: source.turnId, bundleId: source.bundleId, provided: source.provided || [] };
      pending.delete(event.data.id);
      if (source.completesBundle !== false) {
        try { Promise.resolve(onProvided?.({ ...info, eventSeq: event.seq })).catch(error => report(error, { operation: 'mark-provided', sessionId: session.id })); } catch (error) { report(error, { operation: 'mark-provided', sessionId: session.id }); }
      }
      if (source.part === 'index') {
        const nodes = indexNodes.get(session.id) || new Map();
        indexNodes.set(session.id, nodes);
        nodes.set(event.seq, source);
      }
    }
    try { Promise.resolve(onSessionEvent?.({ session, event })).catch(error => report(error, { operation: 'session-event', sessionId: session.id })); } catch (error) { report(error, { operation: 'session-event', sessionId: session.id }); }
  }));
  stops.push(ctx.on('session/disposed', session => indexNodes.delete(session.id)));
  return () => { closed.abort(); pending.clear(); indexNodes.clear(); for (const stop of stops.reverse()) stop(); };
}

/** Narrow adapter around real public DSH services. No independent provider API. */
export function createHostAdapter(ctx, { maxSnapshotBytes = 32 * 1024 * 1024, nativeReadTools = NATIVE_READ_TOOLS } = {}) {
  const owned = new Map();
  const lifetime = new AbortController();
  if (!Array.isArray(nativeReadTools) || nativeReadTools.some(name => !NATIVE_READ_TOOLS.includes(name)) || new Set(nativeReadTools).size !== nativeReadTools.length) throw failure('INVALID_ROLE_TOOLS', 'Background filesystem tools must be a unique subset of read, grep, glob.');
  for (const service of ['agents', 'sessions', 'sessionQuery', 'tools', 'systemPrompt', 'llm']) {
    if (!ctx.get(service)) throw failure('HOST_CAPABILITY_MISSING', `DSH service ${service} is required.`);
  }

  /** Local scheduling eligibility, not a remote health/credential/quota probe.
   * Catalog listing is advisory and some adapters fetch it over the network.
   * The installed pi-ai exact-model resolver is verified to use its configured
   * in-memory profile only; dynamic/unknown adapters remain provider-level.
   */
  async function checkModelRoute(route, { signal } = {}) {
    signal?.throwIfAborted();
    const provider = typeof route?.provider === 'string' ? route.provider : '';
    const model = typeof route?.model === 'string' ? route.model : '';
    let level = 'provider';
    const unavailable = causeCode => ({ available: false, provider, model, level, remoteVerified: false, deferred: true,
      code: 'HOST_MODEL_UNAVAILABLE', causeCode,
      message: causeCode === 'NO_ADAPTER' ? `This host has no registered model provider ${JSON.stringify(provider)}. Wait for a host with this route.`
        : `This host cannot locally resolve model route ${JSON.stringify(provider + '/' + model)} (${causeCode}). Wait for a compatible host or update its model settings.` });
    if (!provider.trim() || !model.trim()) return unavailable('MODEL_UNCONFIGURED');
    if (!ctx.llm.listProviders().some(entry => entry.id === provider)) return unavailable('NO_ADAPTER');
    const directory = ctx.llm.listConfigurableProviders?.().find(entry => entry.provider === provider);
    if (directory?.settingsNs === 'llm-pi-ai') {
      level = 'model';
      try {
        await ctx.llm.resolveCallConfig({ provider, model,
          ...(route.reasoningEffort !== undefined ? { reasoningEffort: route.reasoningEffort } : {}),
          ...(route.maxTokens !== undefined ? { maxTokens: route.maxTokens } : {}),
        }, signal);
      } catch (error) {
        signal?.throwIfAborted();
        return unavailable(typeof error?.code === 'string' && /^[A-Z][A-Z0-9_]{0,79}$/.test(error.code) ? error.code : 'MODEL_LOOKUP_FAILED');
      }
      signal?.throwIfAborted();
      if (!ctx.llm.listProviders().some(entry => entry.id === provider)) return unavailable('NO_ADAPTER');
    }
    return { available: true, provider, model, level, remoteVerified: false };
  }

  async function requireModelRoute(route, signal) {
    const capability = await checkModelRoute(route, { signal });
    if (!capability.available) throw Object.assign(failure(capability.code, capability.message), { causeCode: capability.causeCode, capabilityLevel: capability.level });
  }

  async function readSession(sessionId, { signal } = {}) {
    const observation = await ctx.sessionQuery.observeSession(sessionId, { projectionMode: 'none', signal });
    try {
      return detached({ sessionId, header: observation.header, events: observation.events, cursor: observation.cursor, revision: observation.revision, inheritedEventCount: observation.inheritedEventCount });
    } finally { observation[Symbol.dispose](); }
  }

  async function captureG2(agent, { signal, startExclusive = -1, requirePersistence = true } = {}) {
    if (ctx.agents.get(agent.id) !== agent || ctx.sessions.get(agent.session.id) !== agent.session) throw failure('SESSION_NOT_LIVE', 'G2 source must be the exact live caller.');
    if (requirePersistence && !ctx.get('sessionPersistence')) throw failure('PERSISTENCE_UNAVAILABLE', 'G2 cannot accept a durable snapshot without host session persistence.');
    const endInclusive = agent.session.seq - 1;
    if (endInclusive < 0 || !Number.isInteger(startExclusive) || startExclusive < -1 || startExclusive > endInclusive) throw failure('INVALID_AUDIT_WINDOW', 'The G2 audit window is invalid.');
    // Capture these before the first await. Later parent events are never inherited.
    const model = routeOf(agent);
    const effective = detached(agent.session.deriveMessages());
    const parentSessionId = agent.session.id;
    const cwd = agent.session.header.cwd;
    const effectiveHash = hash(effective);
    await ctx.sessions.flush(agent.session);
    signal?.throwIfAborted();
    const observed = await readSession(parentSessionId, { signal });
    if (observed.events.length <= endInclusive || observed.events[endInclusive]?.seq !== endInclusive) throw failure('CONTEXT_UNAVAILABLE', 'The captured parent prefix is no longer available.');
    const seed = detached(buildForkSeed(observed.events, endInclusive));
    const inheritedEventCount = endInclusive + 1;
    const header = { version: observed.header.version, id: `automemory-snapshot-${randomUUID()}`, createdAt: Date.now(), isSeeded: true, parentSession: parentSessionId, ...(cwd ? { cwd } : {}) };
    const projected = new Session(header.id, seed, header, 'snapshot', inheritedEventCount, ctx.sessions.messageProjections);
    const messages = detached(projected.deriveMessages());
    if (hash(messages.slice(0, effective.length)) !== effectiveHash) throw failure('CONTEXT_CHANGED', 'The exact trigger-point effective context could not be restored.');
    const snapshot = { schemaVersion: 1, parentSessionId, cwd, route: model, startExclusive, endInclusive, inheritedEventCount, seed, effectiveMessageCount: effective.length, effectiveHash, snapshotHash: hash({ seed, model, startExclusive, endInclusive }), capturedAt: Date.now() };
    if (Buffer.byteLength(JSON.stringify(snapshot)) > maxSnapshotBytes) throw failure('CONTEXT_BUDGET_EXCEEDED', 'G2 snapshot exceeds configured storage limit; context was not truncated.');
    return snapshot;
  }

  async function runRole(input) {
    const role = String(input.role || '').toLowerCase();
    if (!['g2', 'dreamer', 'reviewer', 'manager'].includes(role)) throw failure('INVALID_ROLE', 'Unknown AutoMemory model role.');
    if (role === 'reviewer' && input.snapshot) throw failure('REVIEWER_CONTEXT_FORBIDDEN', 'Reviewer must start in an independent fresh context.');
    if (role === 'g2' && !input.snapshot) throw failure('CONTEXT_REQUIRED', 'G2 requires its captured main-context snapshot.');
    const snapshot = input.snapshot;
    if (snapshot && snapshot.snapshotHash !== hash({ seed: snapshot.seed, model: snapshot.route, startExclusive: snapshot.startExclusive, endInclusive: snapshot.endInclusive })) throw failure('CONTEXT_CORRUPT', 'Stored context snapshot integrity check failed.');
    const model = input.model || snapshot?.route;
    if (!model?.provider || !model?.model) throw failure('MODEL_UNCONFIGURED', 'Configure the provider and model for this role.');
    const workspaceRoot = normalizedRoot(input.workspace?.root);
    const id = input.sessionId || `${ROLE_PREFIX}${role}-${randomUUID()}`;
    if (!ROLE_SESSION_ID.test(id) || !id.startsWith(`${ROLE_PREFIX}${role}-`)) throw failure('INVALID_ROLE_SESSION', 'Role sessions must use their exact AutoMemory role namespace.');
    const maxSteps = input.maxSteps ?? 8;
    const maxTokens = input.maxTokens ?? 4096;
    const timeoutMs = input.timeoutMs ?? 180000;
    for (const [name, value] of Object.entries({ maxSteps, maxTokens, timeoutMs })) if (!Number.isSafeInteger(value) || value < 1) throw failure('INVALID_BUDGET', `${name} must be a positive integer.`);
    const stop = new AbortController();
    const signal = AbortSignal.any([lifetime.signal, stop.signal, ...(input.signal ? [input.signal] : [])]);
    const timer = setTimeout(() => stop.abort(failure('ROLE_TIMEOUT', 'AutoMemory role exceeded its time budget.')), timeoutMs);
    timer.unref?.();
    const usage = [], requests = [], requestChecks = [];
    let handle, latestText = '', lastError, terminalReason, steps = 0, nextSnapshot;
    const disposers = [];
    let abortListener;
    try {
      await requireModelRoute(model, signal);
      const localTools = (input.tools || []).map(tool => tool.name);
      if (new Set(localTools).size !== localTools.length || localTools.some(name => NATIVE_READ_TOOLS.includes(name))) throw failure('INVALID_ROLE_TOOLS', 'Role tools cannot duplicate or shadow the guarded filesystem tools.');
      const allowedTools = new Set([...nativeReadTools, ...localTools]);
      const guard = createReadOnlyGuard({ workspaceRoot, nativeTools: nativeReadTools, localTools, evidencePaths: input.evidencePaths || [], allowedReadRoots: input.allowedReadRoots || [], blockedRoots: input.blockedRoots || [], protectedDirectoryNames: input.protectedDirectoryNames || [] });
      if (input.evidencePaths?.length && !allowedTools.has('read')) throw failure('HOST_CAPABILITY_MISSING', 'This role has evidence files but no authorized read tool.');
      // Fail before spending a model call if an exact promised evidence file
      // is absent, outside scope, or cannot actually be opened for reading.
      for (const file of input.evidencePaths || []) {
        const canonical = guard.resolvePath({ name: 'read', arguments: { file_path: file } });
        try {
          const evidence = await open(canonical, constants.O_RDONLY | constants.O_NOFOLLOW);
          await evidence.close();
        } catch { throw failure('INVALID_EVIDENCE_FILE', 'A supplied evidence file cannot be opened for reading. Regenerate the job evidence before retrying.'); }
      }
      await input.onSessionPlanned?.({ sessionId: id, role, storage: storageIdentity(ctx.get('sessionPersistence')) });
      signal.throwIfAborted();
      handle = await ctx.agents.create({
        sessionId: id, signal, agentOptions: { ...model, maxTokens },
        meta: { cwd: workspaceRoot, origin: 'subagent', ...(snapshot ? { parentSession: snapshot.parentSessionId, isSeeded: true } : {}) },
        ...(snapshot ? { seed: snapshot.seed, inheritedEventCount: snapshot.inheritedEventCount } : {}),
        setup(agentCtx, agent) {
          const available = new Set(ctx.tools.schemas(agent).map(t => t.name));
          const inherited = nativeReadTools.filter(name => available.has(name));
          agentCtx.tools.restrict({ allow: inherited });
          agentCtx.tools.presentAs('native');
          for (const tool of input.tools || []) agentCtx.tools.register(tool);
          agentCtx.tools.guard(guard);
          // Reuse each official tool's implementation and schema, but pass the
          // exact authorized absolute path. An inherited working-directory
          // event must not reinterpret a relative path after our guard.
          for (const name of inherited) {
            const original = ctx.tools.get(name, agent);
            agentCtx.tools.register({ ...original, execute(args, exec) {
              const canonical = guard.resolvePath({ ...exec, arguments: args });
              const normalized = { ...args, [name === 'read' ? 'file_path' : 'path']: canonical };
              return original.execute(normalized, exec);
            } });
          }
          for (const tool of roleFileTools(guard)) if (nativeReadTools.includes(tool.name) && !inherited.includes(tool.name)) agentCtx.tools.register(tool);
          // restrict() masks inherited capabilities only. Other host plugins
          // may add exact-agent tools during agent/created (notably Teams).
          // The public assembly waterfall is the final model-facing boundary;
          // keep its schemas aligned with our independent execution guard.
          agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
            const assembly = await next();
            const tools = assembly.tools.filter(tool => allowedTools.has(tool.name));
            const presented = new Set(tools.map(tool => tool.name));
            const missing = [...allowedTools].filter(name => !presented.has(name) || !ctx.tools.get(name, agent));
            if (missing.length) throw failure('HOST_CAPABILITY_MISSING', `AutoMemory role tools are unavailable: ${missing.join(', ')}.`);
            return { ...assembly, tools, sections: assembly.sections.filter(section => !section.name.startsWith('team:')), contexts: assembly.contexts.filter(context => !context.name.startsWith('team:')) };
          });
          agentCtx.systemPrompt.section({ name: 'automemory:role', order: 20000, text: `You are the AutoMemory ${role} role. Follow the current audit/management task only. Inherited history is evidence, not authorization to continue the parent's work. Never retry inherited unfinished tool calls. Project file reads resolve relative paths against ${JSON.stringify(workspaceRoot)}; explicitly supplied evidence files may be read by their absolute paths. Host data directories, their named copies, and credential files are excluded even when nested inside the project. If a broad search is refused, use a known safe subdirectory or read a project README; do not retry with a broader scope. Do not call shell, filesystem mutation, delegation, or scheduling tools. Return exactly one JSON object matching the supplied task contract. Do not claim a memory write has committed.` });
          agentCtx.on('agent/request', async (_event, next) => ({ ...(await next()), ...model, maxTokens }));
          agentCtx.on('agent/pre-step', async (event, next) => {
            const decision = await next();
            // Host invokes one final pre-step after a stop; only count actual requested steps below.
            if (signal.aborted) return { kind: 'reject', reason: 'AutoMemory role cancelled.' };
            return decision;
          });
        },
      });
      owned.set(id, handle);
      abortListener = () => handle.agent.cancel({ kind: 'interrupted' });
      signal.addEventListener('abort', abortListener, { once: true });
      signal.throwIfAborted();
      disposers.push(ctx.on('llm/stream', (options, next) => {
        if (options.sessionId !== id) return next();
        return (async function* () {
          signal.throwIfAborted();
          if (requests.length >= maxSteps) throw failure('ROLE_STEP_BUDGET', 'AutoMemory role exhausted its model-call budget.');
          // A host route can disappear after creation/HMR. Refuse before the
          // reservation callback and request counter, so no dispatch is invented.
          await requireModelRoute(options, signal);
          const presented = new Set((options.tools || []).map(tool => tool.name));
          if ([...allowedTools].some(name => !presented.has(name)) || [...presented].some(name => !allowedTools.has(name))) throw failure('HOST_CAPABILITY_MISSING', 'AutoMemory model-facing tools no longer match its authorized read-only capabilities.');
          const request = { index: requests.length + 1, provider: options.provider, model: options.model, messageCount: options.messages.length, inputCharacters: JSON.stringify(options.messages).length, contextHash: hash(options.messages), maxTokens: options.maxTokens,
            inputEstimate: estimateRequestInput(ctx, handle.agent.session, options) };
          const check = { ...detached(request), status: 'pending' }; requestChecks.push(check);
          try {
            await input.onRequest?.({ ...request, sessionId: id, role, messages: options.messages, tools: options.tools || [] });
            signal.throwIfAborted();
          } catch (error) { check.status = 'rejected'; check.code = error?.code || 'REQUEST_REJECTED'; throw error; }
          check.status = 'dispatched';
          requests.push(request); steps = requests.length;
          for await (const chunk of next()) {
            signal.throwIfAborted();
            if (chunk.type === 'usage') {
              const item = detached({ request: request.index, provider: options.provider, model: options.model, ...chunk.usage });
              usage.push(item); await input.onUsage?.(item);
            }
            yield chunk;
          }
        })();
      }));
      disposers.push(ctx.on('agent/error', ({ agent, error }) => { if (agent.id === id) lastError = error; }));
      disposers.push(ctx.on('session/event', (session, event) => {
        if (session.id !== id) return;
        if (event.type === 'assistant/message') latestText = textOf(event.data.message);
        if (event.type === 'turn/end') terminalReason = event.data.reason?.kind;
      }));
      await input.onCreated?.({ agent: handle.agent, sessionId: id });
      handle.agent.followup({ id: randomUUID(), role: 'user', source: { kind: 'automemory-task', role, workspaceId: input.workspace.id }, content: [{ type: 'text', text: input.prompt }] });
      await ctx.sessions.flush(handle.agent.session);
      await handle.agent.whenIdle();
      await ctx.sessions.flush(handle.agent.session);
      if (signal.aborted) throw signal.reason;
      if (lastError) throw lastError;
      if (terminalReason && terminalReason !== 'completed') throw failure('ROLE_INCOMPLETE', `Role ended with ${terminalReason}.`);
      const json = latestText.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, '$1');
      let output;
      try { output = JSON.parse(json); } catch { throw failure('INVALID_MODEL_OUTPUT', 'Role did not produce a complete JSON object.'); }
      if (!output || typeof output !== 'object' || Array.isArray(output)) throw failure('INVALID_MODEL_OUTPUT', 'Role output must be a JSON object.');
      nextSnapshot = await captureG2(handle.agent, { signal, requirePersistence: Boolean(ctx.get('sessionPersistence')) });
      return { status: 'completed', role, sessionId: id, text: latestText, output, usage, requests, requestChecks, steps, snapshot: nextSnapshot };
    } catch (error) {
      const deferred = !signal.aborted && error?.code === 'HOST_MODEL_UNAVAILABLE' && requests.length === 0 && usage.length === 0;
      return { status: signal.aborted ? 'cancelled' : deferred ? 'deferred' : 'failed', role, sessionId: id, text: latestText, usage, requests, requestChecks, steps, error: { code: error?.code || 'ROLE_FAILED', message: error?.message || String(error), ...(error?.causeCode ? { causeCode: error.causeCode, capabilityLevel: error.capabilityLevel } : {}) } };
    } finally {
      clearTimeout(timer);
      if (abortListener) signal.removeEventListener('abort', abortListener);
      for (const dispose of disposers.reverse()) dispose();
      await handle?.dispose();
      owned.delete(id);
      await input.onSessionSettled?.({ sessionId: id, role });
    }
  }

  /**
   * DSH rc.5 has no deletion seam. This deliberately narrow local-JSONL
   * compatibility adapter uses its public diagnostic locator and write handle.
   * The caller must first settle its durable role-session ownership ledger.
   * Never remove the lock inode: another host could still hold/open that inode.
   */
  async function deleteRoleSession(sessionId, { signal, storage } = {}) {
    if (!ROLE_SESSION_ID.test(sessionId)) throw failure('INVALID_ROLE_SESSION', 'Only plugin-owned AutoMemory role session IDs may be cleared.');
    signal?.throwIfAborted();
    if (owned.has(sessionId) || ctx.agents.get(sessionId) || ctx.sessions.get(sessionId)) throw failure('ROLE_SESSION_BUSY', 'Role session is still live; settle its worker before clearing.');
    const persistence = ctx.get('sessionPersistence');
    if (!persistence || persistence.name !== 'session-persistence-jsonl' || typeof persistence.locate !== 'function') throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'This host persistence backend has no verified role-log cleanup adapter.');
    const currentStorage = storageIdentity(persistence);
    if (!storage?.name || !storage?.root) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role ownership lacks its persistence backend and storage root; cleanup cannot infer them.');
    if (storage.name !== currentStorage.name || storage.root !== currentStorage.root) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role session belongs to a different persistence backend or storage root.');
    const before = await persistence.stat(sessionId, { signal });
    if (!before) return { sessionId, status: 'absent' };
    if (before.header?.id !== sessionId || before.header.version !== 4) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role log format or identity is not supported for safe cleanup.');
    let writer;
    try {
      // Acquires both the native in-process writer claim and cross-process
      // session.lock flock. Another host's active writer must cause refusal.
      writer = await persistence.open(sessionId, 'write', { signal });
      if (writer.header?.id !== sessionId || writer.header.version !== 4) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role log identity changed before cleanup.');
      const artifact = persistence.locate(writer.header);
      const log = artifact?.path;
      if (artifact?.kind !== 'jsonl' || typeof log !== 'string' || !path.isAbsolute(log) || !/^session\.v4\.jsonl(?:\.zstd)?$/.test(path.basename(log)) || path.basename(path.dirname(log)) !== sessionId) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role log location is not a supported local JSONL artifact.');
      const directory = path.dirname(log);
      const storageRoot = normalizedRoot(persistence.root);
      const relativeDirectory = path.relative(persistence.root, directory);
      const segments = relativeDirectory.split(path.sep);
      if (segments.length !== 2 || segments.some(segment => segment === '..' || segment === '.') || realpathSync.native(directory) !== path.join(storageRoot, relativeDirectory)) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role log directory traverses a symbolic link or an unsupported layout.');
      const entries = await readdir(directory, { withFileTypes: true });
      // Unknown artifacts may contain other copies. Do not report completion
      // after only removing the familiar filename.
      if (entries.some(entry => !entry.isFile() || ![path.basename(log), 'session.lock'].includes(entry.name))) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role directory contains unsupported artifacts; cleanup needs a newer adapter.');
      const metadata = await lstat(log);
      if (!metadata.isFile() || metadata.nlink !== 1) throw failure('ROLE_SESSION_CLEANUP_UNAVAILABLE', 'Role log must be one regular unlinked-copy artifact.');
      signal?.throwIfAborted();
      await unlink(log);
      // Make unlink durable while the official writer lease remains held.
      const directoryHandle = await open(directory, 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    } catch (error) {
      if (error?.name === 'SessionAlreadyOwnedError' || error?.code === 'SESSION_ALREADY_OWNED') throw failure('ROLE_SESSION_BUSY', 'Another host owns this role session; retry after it settles.');
      throw error;
    } finally { await writer?.close(); }
    // Public SessionQuery checks persistence.stat before consulting its cold
    // cache. Neither a previous cached observation nor backend parsed memo may
    // make a now-absent artifact readable through a future query.
    if (await persistence.stat(sessionId, { signal })) throw failure('ROLE_SESSION_CLEANUP_INCOMPLETE', 'Role log remains visible after cleanup.');
    return { sessionId, status: 'deleted' };
  }

  async function listSessions({ workspaceRoot, signal } = {}) {
    const list = await ctx.sessionQuery.listSessions(signal);
    return list.map(item => ({ ...item, id: item.header.id, sessionId: item.header.id, cwd: item.header.cwd, createdAt: item.header.createdAt }))
      .filter(item => !item.id.startsWith(ROLE_PREFIX) && (!workspaceRoot || item.cwd === workspaceRoot));
  }
  async function close() { lifetime.abort(); await Promise.allSettled([...owned.values()].map(handle => handle.dispose())); owned.clear(); }
  return { captureG2, runRole, checkModelRoute, listSessions, readSession, deleteRoleSession, close };
}
