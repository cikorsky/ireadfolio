import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
const privateFile=/(?:^|\/)(?:node_modules|installed|evidence|store|\.codex|\.agents|\.omx)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:pem|key|p12|pfx|crx|sqlite\d*|db|docx|pdf)$/i;
const secret=/(?:gh[opusr]_[A-Za-z0-9_]{24,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[A-Z0-9]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
const personalPath=/\/Users\/[A-Za-z0-9._-]+\//;
let files;
try{files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);}catch{throw new Error('Initialize and stage the allowlisted public source before auditing');}
assert(files.length>0,'No staged public source files');
for(const file of files){
 assert(!privateFile.test(file)&&!file.startsWith('releases/'),`Private or binary history file selected: ${file}`);
 const mode=execFileSync('git',['ls-files','--stage','--',file],{encoding:'utf8'}).split(' ')[0];assert(mode!=='120000'&&mode!=='160000',`Symlink or submodule selected: ${file}`);
 const text=execFileSync('git',['show',':'+file],{encoding:'utf8',maxBuffer:20*1024*1024});
 assert(!secret.test(text),`Potential credential found in ${file}`);
 assert(!personalPath.test(text),`Personal machine path found in ${file}`);
}
for(const browser of ['chrome','firefox']){
 const file=`releases/ireadfolio-${browser}-v${pkg.version}.zip`;
 const zip=await JSZip.loadAsync(await fs.readFile(file));
 for(const name of ['manifest.json','LICENSE','NOTICE','THIRD_PARTY_LICENSES.txt'])assert(zip.file(name),`${file} lacks ${name}`);
 const manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 assert.equal(manifest.name,pkg.displayName);assert.equal(manifest.version,pkg.version);
 for(const [name,entry]of Object.entries(zip.files)){
  assert(!privateFile.test(name)&&!name.startsWith('/')&&!name.split('/').includes('..'),`Unexpected private file in ${file}: ${name}`);
  if(!entry.dir){
   const text=await entry.async('string');assert(!secret.test(text),`Potential credential packaged in ${file}: ${name}`);assert(!personalPath.test(text),`Personal machine path packaged in ${file}: ${name}`);
  }
 }
 if(browser==='firefox')assert((await fs.readFile(file)).equals(await fs.readFile(file.replace(/\.zip$/,'.xpi'))),'Firefox ZIP/XPI contents differ');
}
console.log(`Publication audit passed: ${files.length} selected source files; two licensed browser archives; version ${pkg.version}.`);
