import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path'; import {execFileSync} from 'node:child_process';
import {workspaceIdentity} from '../src/identity.js';
test('actual Git worktrees share one owner, separate clones stay isolated and aliases canonicalize',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'automemory-identity-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const main=path.join(dir,'main'),wt=path.join(dir,'worktree'),clone=path.join(dir,'clone');
 const git=(...args)=>execFileSync('git',args,{stdio:'pipe'});
 git('init',main);git('-C',main,'-c','user.name=AutoMemory Fixture','-c','user.email=fixture@invalid.test','-c','core.hooksPath=/dev/null','commit','--allow-empty','-m','fixture');
 git('-C',main,'worktree','add','-b','fixture-branch',wt);git('clone','--local',main,clone);
 const a=workspaceIdentity(main),b=workspaceIdentity(wt),c=workspaceIdentity(clone);
 assert.equal(a.id,b.id);assert.equal(a.root,b.root);assert.notEqual(a.currentRoot,b.currentRoot);assert.notEqual(a.id,c.id);
 fs.symlinkSync(main,path.join(dir,'alias'));assert.equal(workspaceIdentity(path.join(dir,'alias')).id,a.id);
});
test('non-Git project directories remain separate',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'automemory-nongit-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const a=path.join(dir,'a'),b=path.join(dir,'b');fs.mkdirSync(a);fs.mkdirSync(b);assert.notEqual(workspaceIdentity(a).id,workspaceIdentity(b).id);
});
