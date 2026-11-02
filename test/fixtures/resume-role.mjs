import { readFile } from 'node:fs/promises';
import { harness, text } from './harness.mjs';
import { createHostAdapter } from '../../src/host/index.js';

const snapshot=JSON.parse(await readFile(process.argv[2],'utf8'));
const h=await harness(()=>text({audit_completion:'complete',operations:[],issues:[],explanation:'restored exact snapshot'}));
const adapter=createHostAdapter(h.ctx);
try {
  const result=await adapter.runRole({role:'g2',snapshot,workspace:{id:'fresh-process-workspace',root:snapshot.cwd},prompt:'Audit the frozen window.'});
  console.log(JSON.stringify({status:result.status,error:result.error,inherited:JSON.stringify(h.calls[0]?.messages).includes('FRESH_PROCESS_EVIDENCE'),requests:h.calls.length}));
} finally {await adapter.close();await h.close();}
