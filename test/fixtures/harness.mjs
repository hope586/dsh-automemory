import { Context } from '@deepseek-ai/cordis';
import { SessionStore } from '@deepseek-ai/dsh-session';
import { SessionProjectionRegistry } from '@deepseek-ai/dsh-session-projection';
import { AgentRegistry } from '@deepseek-ai/dsh-agent';
import { AgentLoop } from '@deepseek-ai/dsh-agent-loop';
import { SystemPrompt } from '@deepseek-ai/dsh-system-prompt';
import { ToolRuntime } from '@deepseek-ai/dsh-tools';
import { LlmRuntime, LlmAdapter } from '@deepseek-ai/dsh-llm';
import { SessionQueryEngine } from '@deepseek-ai/dsh-session-query';
import * as Jsonl from '@deepseek-ai/dsh-session-persistence-jsonl';
import * as Checkpoint from '@deepseek-ai/dsh-session-checkpoint-policy';
import LocalFileSystem from '@deepseek-ai/dsh-fs-local';
import WorkingDirectory from '@deepseek-ai/dsh-working-directory';
import LocalSubprocess from '@deepseek-ai/dsh-subprocess-local';
import * as FileTools from '@deepseek-ai/dsh-tool-fs';
import * as SearchTools from '@deepseek-ai/dsh-tool-fs-search';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function tool(name, execute, parameters = { type:'object', properties:{}, additionalProperties:false }) {
  return { name, description: `Fixture ${name}`, parameters, output:{schema:{},render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}]}, execute };
}
export function message(text,id='fixture-prompt') { return { id,role:'user',source:{kind:'user',rpcId:id},content:[{type:'text',text}] }; }
export function text(value) { return [{type:'text',text:typeof value==='string'?value:JSON.stringify(value)}]; }
export function call(name,args={},id='fixture-call') { return [{type:'tool-call',id,name,arguments:JSON.stringify(args)}]; }

/** Real installed DSH services with a deterministic model adapter, no network. */
export async function harness(respond, { root, persistence = true, compression = 'none' } = {}) {
  const temp = root || await mkdtemp(path.join(os.tmpdir(),'dsh-automemory-host-'));
  const ctx = new Context();
  new SessionStore(ctx); new SessionProjectionRegistry(ctx); new AgentRegistry(ctx);
  new SystemPrompt(ctx, {}); new ToolRuntime(ctx); new LlmRuntime(ctx); new SessionQueryEngine(ctx);
  let persistenceFiber;
  if(persistence) {
    persistenceFiber=ctx.plugin(Jsonl,{root:path.join(temp,'sessions'),compression,listConcurrency:2});
    await persistenceFiber;
    ctx.plugin(Checkpoint);
  }
  await ctx.plugin(AgentLoop,{agents:[],maxParallelToolCalls:1});
  const calls=[];
  class Fixture extends LlmAdapter {
    async *stream(options) {
      calls.push({sessionId:options.sessionId,provider:options.provider,model:options.model,messages:options.messages,tools:options.tools});
      const content=await respond(options,calls);
      for(let index=0;index<content.length;index++) {
        const block=content[index];
        yield {type:'block-start',index,blockType:block.type};
        yield {type:'block-end',index,block};
      }
      yield {type:'usage',usage:{inputTokens:10,outputTokens:5}};
      yield {type:'finish',reason:{kind:content.some(x=>x.type==='tool-call')?'tool-calls':'stop'}};
    }
  }
  ctx.llm.registerAdapter(['fixture'],new Fixture());
  const handles=[];
  return {
    ctx,temp,calls,
    async nativeTools() {
      await ctx.plugin(LocalFileSystem,{cwd:temp});
      await ctx.plugin(WorkingDirectory,{});
      await ctx.plugin(LocalSubprocess,{});
      await ctx.plugin(FileTools,{readImage:false});
      await ctx.plugin(SearchTools,{sampleOverCapGlobResults:false});
    },
    async agent(id='parent') {
      const handle=await ctx.agents.create({sessionId:id,agentOptions:{provider:'fixture',model:'fixture-model'},meta:{cwd:temp}});
      handles.push(handle);return handle.agent;
    },
    async close() {
      for(const h of handles)await h.dispose();
      await ctx.fiber.dispose();
      if(!root)await rm(temp,{recursive:true,force:true});
    },
  };
}
