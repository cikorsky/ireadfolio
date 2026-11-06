const KEY='iyuedu.webdav.config',STATE='iyuedu.webdav.state',LIMIT=50*1024*1024;
const FILE=/^iyuedu-(\d{13})-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.json$/;
export interface WebDAVConfig {enabled:boolean;authType:'password'|'none';baseUrl:string;username:string;password:string;allowInsecureHttp:boolean}
export interface WebDAVVersion {id:string;createdAt:number;bytes:number}
function object(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)}
export function validateSyncURL(value:unknown,allowInsecureHttp=false):string {
 if(typeof value!=='string'||!value.trim()||value.length>2048)throw new Error('请输入 WebDAV URL');
 let url:URL;try{url=new URL(value.trim())}catch{throw new Error('WebDAV URL 格式无效')}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Error('WebDAV URL 须为不含内嵌凭据、查询参数和片段的 HTTP(S) 地址');
 if(url.protocol==='http:'&&!allowInsecureHttp)throw new Error('HTTP 不会加密备份和凭据，请先明确允许非加密 HTTP');
 return url.href.replace(/\/+$/,'')+'/';
}
async function config():Promise<WebDAVConfig|undefined>{
 const stored=(await chrome.storage.local.get(KEY))[KEY];
 if(!object(stored)||typeof stored.enabled!=='boolean'||!['password','none'].includes(String(stored.authType))||typeof stored.username!=='string'||typeof stored.password!=='string'||typeof stored.allowInsecureHttp!=='boolean')return;
 return {enabled:stored.enabled,authType:stored.authType as WebDAVConfig['authType'],baseUrl:validateSyncURL(stored.baseUrl,stored.allowInsecureHttp),username:stored.username,password:stored.password,allowInsecureHttp:stored.allowInsecureHttp};
}
function backupValid(value:unknown):boolean{return object(value)&&value.version===1&&object(value.settings)&&Array.isArray(value.articles)&&Array.isArray(value.annotations)}
function collection(current:WebDAVConfig):URL{return new URL('i-yuedu/',current.baseUrl)}
function authentication(current:WebDAVConfig):Record<string,string>{
 if(current.authType==='none')return {};
 const bytes=new TextEncoder().encode(`${current.username}:${current.password}`);let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
 return {Authorization:`Basic ${btoa(binary)}`};
}
async function request(current:WebDAVConfig,url:URL,method:string,body?:string,headers:Record<string,string>={}):Promise<Response>{
 if(url.origin!==new URL(current.baseUrl).origin)throw new Error('拒绝向其他站点发送 WebDAV 凭据');
 let response:Response;try{response=await fetch(url.href,{method,headers:{...authentication(current),...headers},body,redirect:'error',cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(120000)})}catch{throw new Error('WebDAV 连接失败，请检查地址、网络与证书；不允许重定向')}
 if(Number(response.headers.get('content-length'))>LIMIT){await response.body?.cancel();throw new Error('WebDAV 响应超过 50 MB')}
 if(response.status===401||response.status===403){await response.body?.cancel();throw new Error('WebDAV 鉴权失败，请检查用户名、密码及目录权限')}
 return response;
}
async function readText(response:Response,limit=LIMIT):Promise<string>{
 if(Number(response.headers.get('content-length'))>limit){await response.body?.cancel();throw new Error('WebDAV 响应过大')}
 const reader=response.body?.getReader();if(!reader){const text=await response.text();if(new TextEncoder().encode(text).byteLength>limit)throw new Error('WebDAV 响应过大');return text;}
 let text='',size=0;const decoder=new TextDecoder();try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit){await reader.cancel();throw new Error('WebDAV 响应过大')}text+=decoder.decode(item.value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}return text;
}
async function discard(response:Response):Promise<void>{await response.body?.cancel();}
function statusError(response:Response,operation:string):Error{return new Error(`${operation}失败（HTTP ${response.status}）`)}
const propfindBody='<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getcontentlength/><d:getlastmodified/></d:prop></d:propfind>';
async function propfind(current:WebDAVConfig,url:URL,depth:'0'|'1'):Promise<string>{
 const response=await request(current,url,'PROPFIND',propfindBody,{'Content-Type':'application/xml;charset=utf-8',Depth:depth});
 if(!response.ok){await discard(response);throw statusError(response,'读取 WebDAV 目录')}
 if(response.status!==207){await discard(response);throw new Error('服务器未返回 WebDAV 207 Multi-Status，请检查 WebDAV URL')}
 const text=await readText(response,2_000_000);parseWebDAVVersions(text,url.href);return text;
}
/** This parser extracts text-only DAV properties; it never expands custom XML entities. */
function xmlText(value:string):string{
 const known:Record<string,string>={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"},parts:string[]=[];let start=0,index=0;
 while(index<value.length){
  if(value.startsWith('<![CDATA[',index)){
   const end=value.indexOf(']]>',index+9);if(end<0)throw new Error('WebDAV XML CDATA 未闭合');
   parts.push(value.slice(start,index),value.slice(index+9,end));index=end+3;start=index;continue;
  }
  const char=value[index];if(char==='<'||char==='>')throw new Error('WebDAV XML 属性格式无效');
  if(char!=='&'){index++;continue;}
  // A valid supported entity is short. Examine each source character at most once;
  // decoded ampersands are output directly and are never parsed a second time.
  let end=index+1;while(end<value.length&&end-index<=16&&value[end]!==';'&&value[end]!=='&'&&value[end]!=='<'&&value[end]!=='>')end++;
  if(value[end]!==';'||end-index>16)throw new Error('WebDAV XML 实体未闭合或过长');
  const entity=value.slice(index+1,end);let decoded:string;
  if(Object.hasOwn(known,entity))decoded=known[entity];
  else{
   if(!/^#(?:\d+|x[0-9a-f]+)$/i.test(entity))throw new Error('WebDAV XML 包含不支持的实体');
   const n=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));if(!Number.isInteger(n)||n<32||n>0x10ffff||(n>=0xd800&&n<=0xdfff))throw new Error('WebDAV XML 实体无效');decoded=String.fromCodePoint(n);
  }
  parts.push(value.slice(start,index),decoded);index=end+1;start=index;
 }
 parts.push(value.slice(start));return parts.join('').trim();
}
function property(row:string,name:string):string|undefined {
 const opening=new RegExp(`<(?:(?:[A-Za-z_][\\w.-]*):)?${name}\\b[^<>]*>`,'i').exec(row);if(!opening)return;
 const start=opening.index+opening[0].length,rest=row.slice(start),closing=new RegExp(`<\\/(?:(?:[A-Za-z_][\\w.-]*):)?${name}\\s*>`,'i').exec(rest);
 if(!closing)throw new Error('WebDAV XML 属性未闭合');return xmlText(rest.slice(0,closing.index));
}
function responseRows(xml:string):string[]{
 const rows:string[]=[];let start:number|undefined;
 // Match only individual tags: no wildcard spans or backtracking across response blocks.
 for(const token of xml.matchAll(/<[^<>]*>/g)){
  if(/^<(?:(?:[A-Za-z_][\w.-]*):)?response\b/i.test(token[0])){
   if(start!==undefined||rows.length>=2000||/\/\s*>$/.test(token[0]))throw new Error('WebDAV XML 响应块格式无效或数量过多');
   start=token.index+token[0].length;
  }else if(/^<\/(?:(?:[A-Za-z_][\w.-]*):)?response\s*>$/i.test(token[0])){
   if(start===undefined)throw new Error('WebDAV XML 响应块未配对');rows.push(xml.slice(start,token.index));start=undefined;
  }
 }
 if(start!==undefined)throw new Error('WebDAV XML 响应块未闭合');return rows;
}
export function parseWebDAVVersions(xml:string,base:string):WebDAVVersion[]{
 if(xml.length>2_000_000||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('WebDAV XML 包含不允许的声明或内容过大');
 if(!/<(?:(?:[A-Za-z_][\w.-]*):)?multistatus\b/i.test(xml))throw new Error('WebDAV 没有返回有效的目录列表');
 const root=new URL(base),versions=new Map<string,WebDAVVersion>();
 for(const row of responseRows(xml)){
  const href=property(row,'href');if(!href||!/(?:HTTP\/\d(?:\.\d)?\s+200\b)/i.test(row))continue;
  let url:URL;try{url=new URL(href,root)}catch{continue;}
  if(url.origin!==root.origin||url.username||url.password||url.search||url.hash||/%(?:2f|5c|2e)/i.test(url.pathname))continue;
  let pathname:string,rootPath:string;try{pathname=decodeURIComponent(url.pathname);rootPath=decodeURIComponent(root.pathname)}catch{continue;}
  if(!pathname.startsWith(rootPath))continue;const id=pathname.slice(rootPath.length),file=FILE.exec(id);if(!file||pathname!==rootPath+id)continue;
  const createdAt=Number(file[1]),raw=property(row,'getcontentlength'),bytes=raw===undefined?0:Number(raw);if(!Number.isSafeInteger(bytes)||bytes<0||bytes>LIMIT||!Number.isFinite(new Date(createdAt).getTime()))continue;
  versions.set(id,{id,createdAt,bytes});if(versions.size>2000)throw new Error('WebDAV 历史备份数量过多');
 }
 return [...versions.values()].sort((a,b)=>b.createdAt-a.createdAt||b.id.localeCompare(a.id));
}
async function ensureCollection(current:WebDAVConfig):Promise<URL>{
 const url=collection(current),response=await request(current,url,'MKCOL');await discard(response);
 if(response.status!==201&&response.status!==405)throw statusError(response,'创建备份目录（请确认 URL 指向已存在的 WebDAV 目录）');return url;
}
async function list(current:WebDAVConfig):Promise<WebDAVVersion[]>{const url=collection(current);return parseWebDAVVersions(await propfind(current,url,'1'),url.href)}
async function restore(current:WebDAVConfig,id:unknown):Promise<unknown>{
 if(typeof id!=='string'||!FILE.test(id))throw new Error('WebDAV 备份文件名无效');
 const response=await request(current,new URL(id,collection(current)),'GET');if(!response.ok){await discard(response);throw statusError(response,'读取备份')}
 let backup:unknown;try{backup=JSON.parse(await readText(response))}catch(error){if(error instanceof Error&&error.message.includes('响应'))throw error;throw new Error('WebDAV 备份不是有效 JSON')}
 if(!backupValid(backup))throw new Error('WebDAV 备份格式无效');return backup;
}
async function publicStatus(current:WebDAVConfig|undefined){const state=(await chrome.storage.local.get(STATE))[STATE];return {configured:!!current,enabled:!!current?.enabled,lastBackupAt:current&&object(state)&&state.baseUrl===current.baseUrl&&typeof state.lastBackupAt==='number'?state.lastBackupAt:undefined};}
let inProgress=false;
export function webDAVSenderURL(sender:chrome.runtime.MessageSender):URL|undefined{
 if(sender.id!==chrome.runtime.id)return;
 try{const url=new URL(sender.url||''),root=new URL(chrome.runtime.getURL(''));if(url.protocol===root.protocol&&url.host===root.host)return url;}catch{/* Reject malformed and ordinary website origins. */}
}
export async function handleSyncMessage(message:unknown,sender:chrome.runtime.MessageSender):Promise<unknown>{
 try{
  if(!object(message)||typeof message.type!=='string')throw new Error('WebDAV 消息无效');
  if(sender.id!==chrome.runtime.id)throw new Error('WebDAV 请求来源无效');
  const url=webDAVSenderURL(sender),options=url?.pathname==='/options.html',reader=url?.pathname==='/reader.html'&&url.hash.startsWith('#session=')&&typeof sender.tab?.id==='number';
  if(!options&&!reader)throw new Error('WebDAV 仅供扩展配置页和隔离阅读页使用');
  if(message.type==='WEBDAV_CONFIG_GET'){
   if(!options)throw new Error('请在扩展选项页查看 WebDAV 配置');const current=await config();
   return {ok:true,data:{...await publicStatus(current),baseUrl:current?.baseUrl||'',authType:current?.authType||'password',username:current?.username||'',hasPassword:!!current?.password,allowInsecureHttp:!!current?.allowInsecureHttp}};
  }
  if(message.type==='WEBDAV_CONFIG_SAVE'){
   if(!options)throw new Error('请在扩展选项页修改 WebDAV 配置');
   if(message.clear===true){await chrome.storage.local.remove(KEY);return {ok:true,data:{configured:false,enabled:false}}}
   if(typeof message.enabled!=='boolean'||typeof message.allowInsecureHttp!=='boolean'||(message.authType!=='password'&&message.authType!=='none'))throw new Error('WebDAV 配置字段无效');
   const baseUrl=validateSyncURL(message.baseUrl,message.allowInsecureHttp),old=await config();
   const username=message.authType==='none'?'':message.username;
   const keepPassword=message.password===''&&old?.baseUrl===baseUrl&&old.authType===message.authType&&old.username===username;
   const password=message.authType==='none'?'':keepPassword?old?.password:message.password;
   if(typeof username!=='string'||username.length>1000||/[:\r\n]/.test(username))throw new Error('WebDAV 用户名格式无效');
   if(typeof password!=='string'||password.length>4096||/[\r\n]/.test(password)||(message.authType==='password'&&(!username||!password)))throw new Error('请输入 WebDAV 用户名和密码，已保存密码可留空保留');
   const next:WebDAVConfig={enabled:message.enabled,authType:message.authType,baseUrl,username,password,allowInsecureHttp:message.allowInsecureHttp};
   await chrome.storage.local.set({[KEY]:next});return {ok:true,data:{...await publicStatus(next),baseUrl,authType:next.authType,username,hasPassword:!!password,allowInsecureHttp:next.allowInsecureHttp}};
  }
  const current=await config();if(message.type==='WEBDAV_STATUS')return {ok:true,data:await publicStatus(current)};
  if(!current)throw new Error('尚未保存 WebDAV 配置，请打开扩展选项页');
  if(!current.enabled)throw new Error('WebDAV 备份未启用');
  if(inProgress)throw new Error('已有 WebDAV 操作正在进行，请稍候');inProgress=true;
  try{
   if(message.type==='WEBDAV_TEST'){await propfind(current,new URL(current.baseUrl),'0');return {ok:true,data:{connected:true}}}
   if(message.type==='WEBDAV_PUSH'){
    if(!backupValid(message.backup))throw new Error('备份结构无效');const body=JSON.stringify(message.backup);if(new TextEncoder().encode(body).byteLength>LIMIT)throw new Error('备份超过 50 MB');
    const directory=await ensureCollection(current),createdAt=Date.now(),id=`iyuedu-${createdAt}-${crypto.randomUUID()}.json`;
    const response=await request(current,new URL(id,directory),'PUT',body,{'Content-Type':'application/json;charset=utf-8','If-None-Match':'*'});await discard(response);if(!response.ok)throw statusError(response,'上传备份');
    await chrome.storage.local.set({[STATE]:{baseUrl:current.baseUrl,lastBackupAt:createdAt}});return {ok:true,data:{id,createdAt,bytes:new TextEncoder().encode(body).byteLength,lastBackupAt:createdAt}};
   }
   if(message.type==='WEBDAV_LIST')return {ok:true,data:{versions:await list(current)}};
   if(message.type==='WEBDAV_RESTORE'||message.type==='WEBDAV_PULL'){const id=message.type==='WEBDAV_PULL'?(await list(current))[0]?.id:message.id;if(!id)throw new Error('WebDAV 目录中尚无备份');return {ok:true,data:await restore(current,id)}}
   throw new Error('未知 WebDAV 操作');
  }finally{inProgress=false;}
 }catch(error){return {ok:false,error:error instanceof Error?error.message:'WebDAV 备份失败'}}
}
