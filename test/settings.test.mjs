import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { SettingsStore } from '../src/settings.js';
test('settings and daily budget coordinate independent instances; unknown usage never becomes zero', t => {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'automemory-settings-')); const a=new SettingsStore(dir),b=new SettingsStore(dir);t.after(()=>{a.close();b.close();fs.rmSync(dir,{recursive:true,force:true});});
 a.set({budget:{maxDailyTokens:2000}}); assert.equal(b.get().budget.maxDailyTokens,2000);
 a.reserve('request-a',1500); a.settle('request-a',null,null);
 assert.throws(()=>b.reserve('request-b',1000),{code:'MODEL_BUDGET_EXCEEDED'});
 assert.throws(()=>a.set({dreamIntervalHours:1}),{code:'INVALID_SETTINGS'});
 a.settle('request-a',{inputTokens:300,outputTokens:100},400);b.reserve('request-b',1000);
 assert.throws(()=>b.reserve('request-b',1),{code:'MODEL_REQUEST_REPLAY'});
});
