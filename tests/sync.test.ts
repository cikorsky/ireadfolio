import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {handleSyncMessage,validateSyncURL,parseWebDAVVersions} from '../src/sync';
let store:Record<string,unknown>;
const options:chrome.runtime.MessageSender={id:'testid',url:'chrome-extension://testid/options.html'};
const content={id:'testid',url:'https://example.org/article',tab:{id:1}} as chrome.runtime.MessageSender;
const reader={id:'testid',url:'chrome-extension://testid/reader.html#session=123',tab:{id:1}} as chrome.runtime.MessageSender;
const backup={version:1,createdAt:1,settings:{},articles:[],annotations:[]};
const secret='测试 password 😀';
const values={enabled:true,baseUrl:'https://example.org/dav/',authType:'password',username:'测试用户',password:secret,allowInsecureHttp:false};
const call=(type:string,fields:Record<string,unknown>={},sender=options)=>handleSyncMessage({type,...fields},sender);
beforeEach(()=>{store={};vi.stubGlobal('chrome',{runtime:{id:'testid',getURL:(path:string)=>`chrome-extension://testid/${path}`},storage:{local:{get:async(key:string|null)=>key===null?store:({[key]:store[key]}),set:async(value:Record<string,unknown>)=>Object.assign(store,value),remove:async(key:string)=>{delete store[key]}}}})});
afterEach(()=>vi.unstubAllGlobals());
const file='iyuedu-1793851200000-12345678-1234-1234-1234-123456789abc.json';
const xml=(href:string,status='200 OK')=>`<d:multistatus xmlns:d="DAV:"><d:response><d:href>${href}</d:href><d:propstat><d:prop><d:getcontentlength>100</d:getcontentlength></d:prop><d:status>HTTP/1.1 ${status}</d:status></d:propstat></d:response></d:multistatus>`;
describe('WebDAV backup boundaries',()=>{
 it('requires explicit opt-in before accepting any unencrypted HTTP endpoint',()=>{
  expect(validateSyncURL('https://example.org/dav')).toBe('https://example.org/dav/');expect(validateSyncURL('http://127.0.0.1:8787',true)).toBe('http://127.0.0.1:8787/');expect(validateSyncURL('http://example.org/dav',true)).toBe('http://example.org/dav/');
  for(const url of ['http://127.0.0.1','http://example.org','file:///tmp','https://u:p@example.org','https://example.org/?token=secret'])expect(()=>validateSyncURL(url)).toThrow();
 });
 it('persists user fields while keeping passwords out of every reply and rejecting webpage/reader configuration access',async()=>{
  expect(await call('WEBDAV_CONFIG_SAVE',values)).toMatchObject({ok:true});const result=await call('WEBDAV_CONFIG_GET');expect(result).toMatchObject({ok:true,data:{configured:true,enabled:true,baseUrl:values.baseUrl,username:values.username,hasPassword:true,authType:'password'}});expect(JSON.stringify(result)).not.toContain(secret);
  expect(store['iyuedu.webdav.config']).toMatchObject({password:secret});for(const sender of [content,reader,{...options,id:'foreign'},{...options,url:'https://example.org/options.html'},{...options,url:'chrome-extension://evil/options.html'}]){expect(await call('WEBDAV_CONFIG_GET',{},sender)).toMatchObject({ok:false});expect(await call('WEBDAV_CONFIG_SAVE',values,sender)).toMatchObject({ok:false});}
  expect(await call('WEBDAV_STATUS',{},reader)).toMatchObject({ok:true,data:{configured:true,enabled:true}});expect(JSON.stringify(await call('WEBDAV_STATUS',{},reader))).not.toMatch(/password|baseUrl|测试用户/);
  expect(await call('WEBDAV_PUSH',{backup},content)).toMatchObject({ok:false});
 });
 it('retains blank password only for the same saved connection and leaves old service settings untouched',async()=>{
  store['circle.sync.config']={baseUrl:'https://old.example/',token:'old-private-token'};
  expect(await call('WEBDAV_STATUS')).toMatchObject({data:{configured:false}});await call('WEBDAV_CONFIG_SAVE',values);
  expect(await call('WEBDAV_CONFIG_SAVE',{...values,password:''})).toMatchObject({ok:true});expect(store['iyuedu.webdav.config']).toMatchObject({password:secret});
  expect(await call('WEBDAV_CONFIG_SAVE',{...values,baseUrl:'https://other.example/dav/',password:''})).toMatchObject({ok:false});expect(await call('WEBDAV_CONFIG_SAVE',{...values,username:'another',password:''})).toMatchObject({ok:false});
  await call('WEBDAV_CONFIG_SAVE',{clear:true});expect(store['iyuedu.webdav.config']).toBeUndefined();expect(store['circle.sync.config']).toMatchObject({token:'old-private-token'});
 });
 it('uses Basic UTF-8 credentials, standard PROPFIND Depth and rejects network redirects by contract',async()=>{
  await call('WEBDAV_CONFIG_SAVE',values);const fetcher=vi.fn().mockResolvedValue(new Response(xml('/dav/'),{status:207}));vi.stubGlobal('fetch',fetcher);
  expect(await call('WEBDAV_TEST')).toEqual({ok:true,data:{connected:true}});expect(fetcher.mock.calls[0][0]).toBe(values.baseUrl);const init=fetcher.mock.calls[0][1];expect(init).toMatchObject({method:'PROPFIND',redirect:'error',credentials:'omit',headers:{Depth:'0'}});expect(new TextDecoder().decode(Uint8Array.from(atob(init.headers.Authorization.slice(6)),c=>c.charCodeAt(0)))).toBe(values.username+':'+secret);
  vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('redirect')));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('不允许重定向')});
 });
 it('omits authorization for anonymous servers and requires a WebDAV multistatus response',async()=>{
  expect(await call('WEBDAV_CONFIG_SAVE',{...values,authType:'none',username:'',password:''})).toMatchObject({ok:true,data:{hasPassword:false,username:''}});
  const fetcher=vi.fn().mockResolvedValue(new Response(xml('/dav/'),{status:207}));vi.stubGlobal('fetch',fetcher);
  expect(await call('WEBDAV_TEST')).toMatchObject({ok:true});expect(fetcher.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>sign in</html>',{status:200})));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('207')});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>sign in</html>',{status:207})));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('有效的目录列表')});
 });
 it('rejects disabled operations and invalid outgoing backups before contacting a server',async()=>{
  const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);await call('WEBDAV_CONFIG_SAVE',{...values,enabled:false});expect(await call('WEBDAV_PUSH',{backup})).toMatchObject({ok:false,error:expect.stringContaining('未启用')});await call('WEBDAV_CONFIG_SAVE',values);expect(await call('WEBDAV_PUSH',{backup:{}})).toMatchObject({ok:false});expect(fetcher).not.toHaveBeenCalled();
 });
 it('reports authentication, missing parent and invalid JSON without reflecting server contents or credentials',async()=>{
  await call('WEBDAV_CONFIG_SAVE',values);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('secret echoed', {status:401})));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('鉴权失败')});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(null,{status:409})));expect(await call('WEBDAV_PUSH',{backup})).toMatchObject({ok:false,error:expect.stringContaining('已存在')});
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('<html>not json</html>')));expect(await call('WEBDAV_RESTORE',{id:file})).toMatchObject({ok:false,error:expect.stringContaining('有效 JSON')});
  expect(await call('WEBDAV_RESTORE',{id:'../../outside.json'})).toMatchObject({ok:false});
 });
 it('accepts only own backup files within the same collection and rejects unsafe XML declarations',()=>{
  const base='https://example.org/dav/i-yuedu/';expect(parseWebDAVVersions(xml('/dav/i-yuedu/'+file),base)).toEqual([{id:file,createdAt:1793851200000,bytes:100}]);
  for(const href of ['https://evil.example/dav/i-yuedu/'+file,'/outside/'+file,'/dav/i-yuedu/../'+file,'/dav/i-yuedu/sub/'+file,'/dav/i-yuedu/%2e%2e/'+file,'/dav/i-yuedu/%252e%252e/'+file,'/dav/i-yuedu/'+file+'?secret=x','/dav/i-yuedu/'+file+'#fragment'])expect(parseWebDAVVersions(xml(href),base)).toEqual([]);
  expect(parseWebDAVVersions(xml('/dav/i-yuedu/'+file,'404 Not Found'),base)).toEqual([]);expect(()=>parseWebDAVVersions('<!DOCTYPE x [<!ENTITY a SYSTEM "file:///etc/passwd">]>'+xml('&a;'),base)).toThrow('不允许');expect(()=>parseWebDAVVersions(xml('&unsupported;'),base)).toThrow('实体');
 });
 it('rejects unpaired, nested and excessive XML response blocks without wildcard backtracking',()=>{
  const base='https://example.org/dav/i-yuedu/',open='<d:multistatus xmlns:d="DAV:">',close='</d:multistatus>';
  for(const body of ['<d:response>','</d:response>','<d:response>'.repeat(100),'<d:response><d:href>'.repeat(100)+'</d:response>'])expect(()=>parseWebDAVVersions(open+body+close,base)).toThrow('响应块');
  expect(()=>parseWebDAVVersions(open+'<d:response></d:response>'.repeat(2001)+close,base)).toThrow('数量过多');
  expect(()=>parseWebDAVVersions(open+'<d:response><d:href>broken</d:response>'+close,base)).toThrow('属性未闭合');
 });
 it('decodes XML entities once and rejects large malformed ampersand input with bounded scanning',()=>{
  const base='https://example.org/dav/a&b/i-yuedu/',expected=[{id:file,createdAt:1793851200000,bytes:100}];
  expect(parseWebDAVVersions(xml('/dav/a&amp;b/i-yuedu/'+file),base)).toEqual(expected);
  expect(parseWebDAVVersions(xml('/dav/a&#38;b/i-yuedu/'+file),base)).toEqual(expected);
  expect(parseWebDAVVersions(xml('/dav/a&#x26;b/i-yuedu/'+file),base)).toEqual(expected);
  expect(parseWebDAVVersions(xml('/dav/a&amp;amp;b/i-yuedu/'+file),'https://example.org/dav/a&amp;b/i-yuedu/')).toEqual(expected);
  expect(parseWebDAVVersions(xml('<![CDATA[/dav/a&b/i-yuedu/'+file+']]>'),base)).toEqual(expected);
  for(const href of ['&'.repeat(250_000),'&','a&b','&&amp;','&amp','&'+'a'.repeat(100)+';','&#0;','&#x110000;'])expect(()=>parseWebDAVVersions(xml(href),base)).toThrow('实体');
  expect(()=>parseWebDAVVersions(xml('<![CDATA['.repeat(100)),base)).toThrow('CDATA');
 });
 it('enforces response size limits and serializes simultaneous transfers',async()=>{
  await call('WEBDAV_CONFIG_SAVE',values);vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('x',{headers:{'content-length':String(51*1024*1024)}})));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('50 MB')});
  let complete!:(value:Response)=>void;vi.stubGlobal('fetch',vi.fn().mockImplementation(()=>new Promise<Response>(resolve=>{complete=resolve;})));const first=call('WEBDAV_TEST');await vi.waitFor(()=>expect(complete).toBeTypeOf('function'));expect(await call('WEBDAV_TEST')).toMatchObject({ok:false,error:expect.stringContaining('正在进行')});complete(new Response(xml('/dav/'),{status:207}));await expect(first).resolves.toMatchObject({ok:true});
 });
});
