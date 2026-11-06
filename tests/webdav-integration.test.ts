import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import type {AddressInfo} from 'node:net';
import {createWebDAVTestServer} from '../scripts/webdav-test-server.mjs';
import {handleSyncMessage} from '../src/sync';
let store:Record<string,unknown>;
const sender={id:'webdav-test',url:'chrome-extension://webdav-test/options.html'} as chrome.runtime.MessageSender;
const reader={id:'webdav-test',url:'chrome-extension://webdav-test/reader.html#session=local-test',tab:{id:42}} as chrome.runtime.MessageSender;
const call=(type:string,fields:Record<string,unknown>={},source=sender)=>handleSyncMessage({type,...fields},source);
beforeEach(()=>{store={};vi.stubGlobal('chrome',{runtime:{id:'webdav-test',getURL:(path:string)=>'chrome-extension://webdav-test/'+path},storage:{local:{get:async(key:string)=>({[key]:store[key]}),set:async(data:Record<string,unknown>)=>Object.assign(store,data),remove:async(key:string)=>{delete store[key];}}}});});
afterEach(()=>vi.unstubAllGlobals());
describe('real local WebDAV protocol',()=>{
 it('tests a collection, creates versioned UTF-8 backups, lists and restores without overwriting or leaking credentials',async()=>{
  const fixture=createWebDAVTestServer({username:'测试用户',password:'密码 😀'});await new Promise<void>((resolve,reject)=>{fixture.server.once('error',reject);fixture.server.listen(0,'127.0.0.1',()=>{fixture.server.off('error',reject);resolve();});});
  try{
   const address=fixture.server.address() as AddressInfo,url=`http://127.0.0.1:${address.port}/dav/`;
   expect(await call('WEBDAV_CONFIG_SAVE',{baseUrl:url,enabled:true,authType:'password',username:'测试用户',password:'密码 😀',allowInsecureHttp:false})).toMatchObject({ok:false});
   expect(await call('WEBDAV_CONFIG_SAVE',{baseUrl:url,enabled:true,authType:'password',username:'测试用户',password:'密码 😀',allowInsecureHttp:true})).toMatchObject({ok:true});
   expect(await call('WEBDAV_TEST')).toMatchObject({ok:true,data:{connected:true}});
   const backup={version:1,createdAt:Date.now(),settings:{defaultExportFormat:'docx'},articles:[{title:'中文备份😀',html:'<p>水资源保护</p>'}],annotations:[]};
   const first=await call('WEBDAV_PUSH',{backup},reader) as {ok:boolean;data:{id:string;lastBackupAt:number}};
   expect(first.ok).toBe(true);expect(fixture.files.get(first.data.id)).toBe(JSON.stringify(backup));
   const next={...backup,articles:[{title:'第二份独立版本',html:'<p>不覆盖旧版</p>'}]};expect(await call('WEBDAV_PUSH',{backup:next},reader)).toMatchObject({ok:true});expect(fixture.files.size).toBe(2);
   const list=await call('WEBDAV_LIST') as {ok:boolean;data:{versions:{id:string}[]}};expect(list.ok).toBe(true);expect(list.data.versions).toHaveLength(2);
   expect(await call('WEBDAV_RESTORE',{id:first.data.id})).toEqual({ok:true,data:backup});expect(await call('WEBDAV_PULL')).toMatchObject({ok:true,data:next});
   const config=await call('WEBDAV_CONFIG_GET');expect(config).toMatchObject({ok:true,data:{username:'测试用户',hasPassword:true,lastBackupAt:expect.any(Number)}});expect(JSON.stringify(config)).not.toContain('密码 😀');
   expect(fixture.requests.every(req=>req.authenticated)).toBe(true);expect(fixture.requests.filter(req=>req.method==='PROPFIND').map(req=>req.depth)).toEqual(expect.arrayContaining(['0','1']));expect(fixture.requests.filter(req=>req.method==='PUT').every(req=>req.ifNoneMatch==='*')).toBe(true);expect(fixture.requests.filter(req=>req.method==='MKCOL')).toHaveLength(2);
   await call('WEBDAV_CONFIG_SAVE',{clear:true});expect(fixture.files.size).toBe(2);
  }finally{fixture.server.closeAllConnections();await new Promise<void>((resolve,reject)=>fixture.server.close(error=>error?reject(error):resolve()));}
 },15000);
});
