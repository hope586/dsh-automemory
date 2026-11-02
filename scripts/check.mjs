import fs from 'node:fs'; import { execFileSync } from 'node:child_process';
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(x=>x.isDirectory()?walk(dir+'/'+x.name):[dir+'/'+x.name]); }
for(const file of walk('src').filter(x=>x.endsWith('.js'))) execFileSync(process.execPath,['--check',file]);
console.log('All source syntax checks passed.');
