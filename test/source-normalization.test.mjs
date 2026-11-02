import test from 'node:test'; import assert from 'node:assert/strict';
import { normalizeSources } from '../lib/index.js';
test('unverified model timestamps are omitted and temporary evidence aliases become stable session ranges',()=>{
 const source={source_kind:'project_file',locator:'/private/data/job-evidence/J1/s1.jsonl#L3',observed_at:'2026-10-30T11:16:51.617Z'};
 const draft={operations:[{source_refs:[source],content:{payload:{references:[source],text:'A dated user fact 2026-10-30 stays untouched.'}}}]};
 const actual=normalizeSources(draft,[{path:'/private/data/job-evidence/J1/s1.jsonl',locator:'session-1#events:4-8',version:'frozen-through-event:8'}]);
 const normalized=actual.operations[0].source_refs[0];
 assert.deepEqual(normalized,{source_kind:'session_event',locator:'session-1#events:4-8',version_hint:'frozen-through-event:8'});
 assert.deepEqual(actual.operations[0].content.payload.references[0],normalized);
 assert.equal(source.observed_at,'2026-10-30T11:16:51.617Z');
 assert.match(actual.operations[0].content.payload.text,/2026-10-30/);
});
