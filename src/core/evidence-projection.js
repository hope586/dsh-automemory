import { createHash } from 'node:crypto';
import { assembleAssistantStream, assistantStreamChunks } from '@deepseek-ai/dsh-llm';

const runtimeUserSources = new Set(['runtime-context', 'automemory', 'automemory-superseded', 'skill-catalog', 'time-context']);
const messageTypes = new Set(['user/message', 'assistant/message', 'assistant/attempt', 'tool/result']);
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const copy = value => structuredClone(value);

/** Read-only factual view of an already-authorized native event interval.
 * This is NOT the G2 inherited snapshot or a replacement for native history.
 * Text, tool arguments/results and non-text content are never size-truncated.
 * Unknown user-source kinds are retained; only known runtime injections omit.
 */
export function projectEvidence({ sessionId, events, fragment }) {
  const records = [], omitted = [], omittedBlocks = [], contentGaps = [];
  const base = event => ({ seq: event.seq, type: event.type, time: event.time, source_time_iso: new Date(event.time).toISOString(), locator: `${sessionId}#event:${event.seq}`, ...(event.sourceEventSeqs ? { sourceEventSeqs: copy(event.sourceEventSeqs) } : {}), ...(event.surfaceOp ? { surfaceOp: copy(event.surfaceOp) } : {}) });
  for (const event of events) {
    const data = event.data || {}; let message = data.message || data;
    const injected = event.type === 'user/message' && runtimeUserSources.has(message.source?.kind);
    if (injected || !messageTypes.has(event.type) && event.type !== 'tool/call') {
      omitted.push({ seq: event.seq, type: event.type, ...(injected ? { source_kind: message.source.kind } : {}), reason: injected ? 'known-runtime-injection' : 'runtime-metadata', sha256: digest(event) });
      continue;
    }
    if (event.type === 'tool/call') {
      records.push({ ...base(event), data: copy(Object.fromEntries(['callId', 'name', 'arguments', 'turn', 'step'].filter(key => data[key] !== undefined).map(key => [key, data[key]]))) });
      continue;
    }
    let finish;
    if (Array.isArray(data.stream)) {
      try {
        const reason = assistantStreamChunks(data.stream, 'finish').at(-1)?.reason;
        if (reason) finish = { kind: reason.kind, ...(reason.failure?.code ? { failureCode: reason.failure.code } : {}) };
        if (event.type === 'assistant/attempt') {
          // The public SDK reconstructs partial visible text. An interrupted
          // attempt does not authorize pretending unfinished tool calls ran.
          message = { role: 'assistant', content: assembleAssistantStream(data.stream).interruptedBlocks() };
          omittedBlocks.push({ seq: event.seq, field: 'stream', reason: 'stream-projected-to-visible-incomplete-text-unexecuted-calls-omitted', sha256: digest(data.stream) });
        } else omittedBlocks.push({ seq: event.seq, field: 'stream', reason: 'duplicate-native-stream-message-content-retained', sha256: digest(data.stream) });
      } catch {
        contentGaps.push({ seq: event.seq, type: event.type, reason: 'assistant-stream-could-not-be-projected', sha256: digest(data.stream) });
      }
    }
    if (!Array.isArray(message.content)) {
      // A missing/unknown message shape is not an empty native message. Keep
      // its exact identity in the gap report rather than silently losing it.
      contentGaps.push({ seq: event.seq, type: event.type, reason: 'message-content-unavailable-or-unsupported', sha256: digest(event) });
      continue;
    }
    const content = [];
    for (const [index, block] of message.content.entries()) {
      if (block?.type === 'reasoning') {
        omittedBlocks.push({ seq: event.seq, index, type: block.type, reason: 'internal-reasoning-not-conversation-evidence', sha256: digest(block) });
      } else content.push(copy(block));
    }
    const source = message.source ? copy(message.source) : undefined;
    if (source?.replayState !== undefined) { omittedBlocks.push({ seq: event.seq, field: 'message.source.replayState', reason: 'opaque-provider-replay-state-not-conversation-evidence', sha256: digest(source.replayState) }); delete source.replayState; }
    const value = { ...(message.id ? { id: message.id } : {}), role: message.role || (event.type === 'user/message' ? 'user' : event.type === 'tool/result' ? 'tool' : 'assistant'), ...(source ? { source } : {}), ...(message.isError !== undefined ? { isError: message.isError } : {}), content };
    records.push({ ...base(event), data: { ...Object.fromEntries(['turn', 'step', 'name', 'callId', 'interrupted'].filter(key => data[key] !== undefined).map(key => [key, copy(data[key])])), ...(finish ? { finish } : {}), message: value }, ...(event.type === 'assistant/attempt' ? { delivery: 'incomplete-attempt-not-a-completed-answer' } : data.interrupted ? { delivery: 'interrupted-visible-answer-not-complete' } : {}) });
  }
  const header = { ...fragment, projection: { version: 'conversation-evidence-v1', sourceSessionId: sessionId, originalEventCount: events.length, retainedEventCount: records.length, contentTruncated: false, contentComplete: contentGaps.length === 0, contentGaps, omittedEvents: omitted, omittedBlocks, note: 'User/assistant/tool text is not truncated. Runtime system prompts, request wiring, known automatic injections and internal reasoning are omitted. Incomplete attempts are labelled; any contentGaps prevent a claim of complete evidence. Omission metadata/hashes are not project-fact evidence. Cite retained original event locators. This view does not alter the full G2 inherited snapshot.' } };
  const jsonl = [header, ...records].map(row => JSON.stringify(row)).join('\n');
  return { header, records, jsonl, stats: { originalEvents: events.length, retainedEvents: records.length, omittedEvents: omitted.length, originalEventBytes: Buffer.byteLength(events.map(event => JSON.stringify({ ...event, source_time_iso: new Date(event.time).toISOString() })).join('\n')), projectedBytes: Buffer.byteLength(jsonl) } };
}
