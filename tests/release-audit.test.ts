// @vitest-environment node
import {afterEach,describe,expect,it} from 'vitest';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,symlinkSync} from 'node:fs';
import {execFileSync,spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import JSZip from 'jszip';
const script=fileURLToPath(new URL('../scripts/release-audit.mjs',import.meta.url));
const roots:string[]=[];
const fakeCredential=['ghp','A'.repeat(36)].join('_');
afterEach(()=>{for(const root of roots.splice(0))rmSync(root,{recursive:true,force:true});});
async function fixture(packagedSecret=false){
 const root=mkdtempSync(path.join(os.tmpdir(),'ireadfolio-audit-'));roots.push(root);
 const pkg={version:'0.0.0',displayName:'Synthetic Audit Fixture'};
 writeFileSync(path.join(root,'package.json'),JSON.stringify(pkg));writeFileSync(path.join(root,'README.md'),'Synthetic public fixture');
 execFileSync('git',['init','-q'],{cwd:root});execFileSync('git',['add','README.md'],{cwd:root});mkdirSync(path.join(root,'releases'));
 for(const browser of ['chrome','firefox']){
  const zip=new JSZip();zip.file('manifest.json',JSON.stringify({name:pkg.displayName,version:pkg.version}));
  for(const name of ['LICENSE','NOTICE','THIRD_PARTY_LICENSES.txt'])zip.file(name,'Synthetic license fixture');
  zip.file('background.js',packagedSecret?fakeCredential:'// synthetic public script');
  const data=await zip.generateAsync({type:'nodebuffer'}),file=path.join(root,'releases',`ireadfolio-${browser}-v0.0.0.zip`);writeFileSync(file,data);
  if(browser==='firefox')writeFileSync(file.replace(/\.zip$/,'.xpi'),data);
 }
 return root;
}
function audit(root:string){return spawnSync(process.execPath,[script],{cwd:root,encoding:'utf8'});}
describe('publication boundary audit',()=>{
 it('accepts a staged synthetic source and matching licensed browser archives',async()=>{
  const result=audit(await fixture());expect(result.status).toBe(0);expect(result.stdout).toContain('Publication audit passed');
 });
 it('rejects credentials in the index even after the working copy has been cleaned',async()=>{
  const root=await fixture(),file=path.join(root,'README.md');writeFileSync(file,fakeCredential);execFileSync('git',['add','README.md'],{cwd:root});writeFileSync(file,'clean worktree');
  const result=audit(root);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Potential credential found');expect(result.stderr).not.toContain(fakeCredential);
 });
 it('rejects credential text inside a browser archive',async()=>{
  const result=audit(await fixture(true));expect(result.status).not.toBe(0);expect(result.stderr).toContain('Potential credential packaged');
 });
 it('rejects a selected image symlink rather than skipping it as binary',async()=>{
  const root=await fixture();symlinkSync('README.md',path.join(root,'image.png'));execFileSync('git',['add','image.png'],{cwd:root});
  const result=audit(root);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Symlink or submodule selected');
 });
 it('rejects differing Firefox ZIP and XPI payloads',async()=>{
  const root=await fixture();writeFileSync(path.join(root,'releases','ireadfolio-firefox-v0.0.0.xpi'),'different payload');
  const result=audit(root);expect(result.status).not.toBe(0);expect(result.stderr).toContain('Firefox ZIP/XPI contents differ');
 });
});
