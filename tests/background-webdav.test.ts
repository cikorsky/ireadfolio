import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
type Listener=(message:unknown,sender:chrome.runtime.MessageSender,reply:(result:unknown)=>void)=>void;
let listener:Listener,local:Record<string,unknown>,sessions:Record<string,unknown>;
const id='12345678-1234-1234-1234-123456789abc';
const source=(suffix:string,tabId=42)=>({id:'webdav-test',url:'chrome-extension://webdav-test/reader.html'+suffix,tab:{id:tabId}} as chrome.runtime.MessageSender);
const call=(sender:chrome.runtime.MessageSender)=>new Promise<unknown>(resolve=>listener({type:'WEBDAV_STATUS'},sender,resolve));
beforeEach(async()=>{
 vi.resetModules();local={};sessions={};const event={addListener:vi.fn()};
 vi.stubGlobal('chrome',{runtime:{id:'webdav-test',getURL:(path:string)=>'chrome-extension://webdav-test/'+path,onInstalled:event,onMessage:{addListener:(fn:Listener)=>{listener=fn;}}},storage:{local:{get:async(key:string)=>({[key]:local[key]})},session:{get:async(key:string)=>({[key]:sessions[key]})},onChanged:event},tabs:{onRemoved:event},action:{onClicked:event},contextMenus:{onClicked:event},commands:{onCommand:event}});
 await import('../src/background');
});
afterEach(()=>vi.unstubAllGlobals());
describe('WebDAV reader session routing',()=>{
 it('requires a current same-tab session for reader URLs with and without a query',async()=>{
  for(const prefix of ['','?layout=wide']){
   expect(await call(source(prefix+'#session='+id))).toMatchObject({ok:false,error:expect.stringContaining('会话')});
   sessions['circle.reader.'+id]={tabId:42,article:{url:'https://example.org/'},createdAt:Date.now()};
   expect(await call(source(prefix+'#session='+id))).toMatchObject({ok:true,data:{configured:false}});
   expect(await call(source(prefix+'#session='+id,43))).toMatchObject({ok:false,error:expect.stringContaining('标签页')});
   delete sessions['circle.reader.'+id];
  }
 });
 it('rejects missing sessions and foreign reader origins before returning backup status',async()=>{
  for(const suffix of ['?layout=wide','#session=bad','?layout=wide#session=bad'])expect(await call(source(suffix))).toMatchObject({ok:false});
  expect(await call({...source('#session='+id),url:'https://example.org/reader.html?layout=wide#session='+id})).toMatchObject({ok:false});
 });
});
