import { randomUUID } from 'node:crypto';
import { storageIdentity } from './index.js';

const failure = (code, message) => Object.assign(new Error(message), { code });
const textOf = message => (message?.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');

/** Native AgentLoop owns messages, tool execution, replay state and durable logs.
 * This adapter only composes the manager scope and observes its native lifecycle.
 * Successful requests resume one session; recovery can fork a clean checkpoint.
 */
export async function runManagementTurn(ctx, input) {
  const { sessionId, model, signal, tools, requestId } = input;
  if (!/^automemory-manager-[A-Za-z0-9_-]{1,128}$/.test(sessionId)) throw failure('INVALID_ROLE_SESSION', 'Invalid manager session identity.');
  if (!ctx.get('sessionPersistence')) throw failure('PERSISTENCE_UNAVAILABLE', 'Memory management requires native session persistence.');
  const allowed = new Set(tools.map(t => t.name)), stops = [];
  let handle, lastError, terminalReason, dispatched = 0, latestText = '', abort;
  const scopedTools = tools.map(definition => ({ ...definition, parallelSafe: false,
    output: { schema: {}, render: (_args, value) => [{ type: 'text', text: JSON.stringify(value) }] },
  }));
  const setup = (agentCtx, agent) => {
    agentCtx.tools.restrict({ allow: [] });
    agentCtx.tools.presentAs('native');
    for (const definition of scopedTools) agentCtx.tools.register(definition);
    agentCtx.tools.guard(exec => {
      if (!allowed.has(exec.name)) { input.onDeniedTool?.(exec); return 'Tool is outside this memory-management scope.'; }
      return input.denial?.();
    });
    agentCtx.systemPrompt.section({ name: 'automemory:manager', order: 20000, complete: true, interpolate: false, text: input.system });
    agentCtx.systemPrompt.suppressRuntimeContext();
    agentCtx.on('system-prompt/assemble', async (_assembly, _context, next) => {
      const assembly = await next();
      const actual = assembly.tools.filter(t => allowed.has(t.name));
      if (actual.length !== allowed.size || actual.some(t => !ctx.tools.get(t.name, agent))) throw failure('HOST_CAPABILITY_MISSING', 'Manager tools are unavailable.');
      return { ...assembly, tools: actual };
    });
    agentCtx.on('agent/request', async (_event, next) => ({ ...(await next()), ...model, maxTokens: input.maxTokens }));
    agentCtx.on('agent/pre-step', async (_event, next) => {
      const decision = await next();
      signal.throwIfAborted();
      const denied = input.denial?.();
      if (denied) return { kind: 'reject', reason: denied };
      return decision;
    });
    agentCtx.on('agent/error', ({ error }) => { lastError = error; });
  };
  try {
    await input.onPlanned({ sessionId, storage: storageIdentity(ctx.get('sessionPersistence')) });
    signal.throwIfAborted();
    handle = input.resume
      ? await ctx.agents.resume({ resumeSessionId: sessionId, signal, agentOptions: model, setup })
      : await ctx.agents.create({ sessionId, signal, agentOptions: model, setup,
        meta: { origin: 'subagent', ...(input.cwd ? { cwd: input.cwd } : {}), ...(input.snapshot ? { parentSession: input.snapshot.parentSessionId, isSeeded: true } : {}) },
        ...(input.snapshot ? { seed: input.snapshot.seed, inheritedEventCount: input.snapshot.inheritedEventCount } : {}),
      });
    abort = () => handle.agent.cancel({ kind: 'interrupted' });
    signal.addEventListener('abort', abort, { once: true });
    signal.throwIfAborted();
    stops.push(ctx.on('session/event', (session, event) => {
      if (session.id !== sessionId) return;
      if (event.type === 'assistant/message') {
        latestText = textOf(event.data.message).trim();
        if (latestText) input.onText?.(latestText);
      }
      if (event.type === 'turn/end') terminalReason = event.data.reason?.kind;
      input.onEvent?.(event);
    }));
    stops.push(ctx.on('llm/stream', (options, next) => {
      if (options.sessionId !== sessionId) return next();
      return (async function* () {
        signal.throwIfAborted();
        if (dispatched >= input.maxSteps) throw failure('MANAGEMENT_STEP_LIMIT', 'Management request reached its model step limit.');
        if ((options.tools || []).length !== allowed.size || options.tools.some(t => !allowed.has(t.name))) throw failure('HOST_CAPABILITY_MISSING', 'Manager tool scope changed.');
        const call = await input.onRequest({ ...options, step: dispatched + 1 });
        dispatched++;
        let usage, finished = false;
        try {
          for await (const chunk of next()) {
            signal.throwIfAborted();
            // Usage is the latest native snapshot, not an additive delta.
            if (chunk.type === 'usage') usage = chunk.usage;
            if (chunk.type === 'finish') {
              finished = true;
              if (!['stop', 'tool-calls'].includes(chunk.reason?.kind)) throw failure(chunk.reason?.failure?.code || 'MODEL_RESPONSE_INCOMPLETE', 'The management model did not complete its response.');
            }
            yield chunk;
          }
          if (!finished) throw failure('MODEL_RESPONSE_INCOMPLETE', 'The management model did not complete its response.');
        } catch (error) {
          // Preserve stage/code for the product, without persisting provider error bodies.
          const safe = input.sanitizeError(error); lastError = safe; throw safe;
        } finally { await input.onSettledUsage(call, usage); }
      })();
    }));
    handle.agent.inject({ id: randomUUID(), role: 'user', source: { kind: 'automemory-management-context', plugin: 'dsh-automemory', requestId }, content: [{ type: 'text', text: input.note }] });
    handle.agent.followup({ id: randomUUID(), role: 'user', source: { kind: 'user', rpcId: requestId }, content: [{ type: 'text', text: input.text }] });
    await ctx.sessions.flush(handle.agent.session);
    await handle.agent.whenIdle();
    await ctx.sessions.flush(handle.agent.session);
    signal.throwIfAborted();
    if (lastError) throw lastError;
    const expectedStop = input.expectedStop?.();
    if (!expectedStop && terminalReason !== 'completed') throw failure('MANAGEMENT_INCOMPLETE', 'The native management turn did not complete.');
    if (!expectedStop && dispatched === 0) throw failure('MANAGEMENT_INCOMPLETE', 'The native manager made no model request.');
    const snapshot = expectedStop ? null : await input.capture(handle.agent);
    return { sessionId, snapshot, latestText, steps: dispatched, terminalReason };
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    for (const stop of stops.reverse()) stop();
    await handle?.dispose();
    await input.onSettled({ sessionId });
  }
}
