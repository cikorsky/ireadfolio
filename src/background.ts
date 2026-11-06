import {handleSyncMessage,webDAVSenderURL} from './sync';
import {querySystemFonts} from './fonts';
import type {Article} from './types';
const api=chrome;
interface ReaderSession {article:Article;tabId:number;createdAt:number}
const sessionKey=(id:string)=>`circle.reader.${id}`;
async function session(id:unknown,sender:chrome.runtime.MessageSender):Promise<ReaderSession>{
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw Error('阅读会话无效');
 const item=(await api.storage.session.get(sessionKey(id)))[sessionKey(id)] as ReaderSession|undefined;
 if(!item||item.tabId!==sender.tab?.id)throw Error('阅读会话已过期或不属于此标签页');return item;
}
async function menus(){const data=await api.storage.local.get('circle.replica.settings'),saved=data['circle.replica.settings'];let enabled=true;if(saved&&typeof saved==='object'&&'modules'in saved){const modules=saved.modules;if(modules&&typeof modules==='object'&&'menu'in modules)enabled=modules.menu!==false;}api.contextMenus.removeAll(()=>{if(!enabled)return;for(const[id,title]of [['toggle','进入 / 退出阅读模式'],['manual','手动选择正文'],['settings','偏好设置'],['library','稍后阅读']])api.contextMenus.create({id,title,contexts:['page','selection']});});}
api.runtime.onInstalled.addListener(()=>void menus());
api.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes['circle.replica.settings'])void menus();});
api.tabs.onRemoved.addListener(id=>{void api.storage.session.get(null).then(data=>api.storage.session.remove(Object.entries(data).filter(([key,value])=>key.startsWith('circle.reader.')&&(value as ReaderSession).tabId===id).map(([key])=>key)));});
api.action.onClicked.addListener(tab=>{if(tab.id)void api.tabs.sendMessage(tab.id,{type:'TOGGLE'}).catch(()=>api.action.setBadgeText({tabId:tab.id,text:'!'}));});
api.contextMenus.onClicked.addListener((info,tab)=>{if(tab?.id)void api.tabs.sendMessage(tab.id,{type:String(info.menuItemId).toUpperCase()}).catch(()=>{});});
api.commands.onCommand.addListener(async()=>{const[tab]=await api.tabs.query({active:true,currentWindow:true});if(tab?.id)void api.tabs.sendMessage(tab.id,{type:'TOGGLE'}).catch(()=>{});});
async function handle(message:Record<string,unknown>,sender:chrome.runtime.MessageSender):Promise<unknown>{
 if(sender.id!==api.runtime.id)throw Error('消息来源无效');
 if(typeof message.type!=='string')throw Error('消息格式无效');
 if(message.type==='FONT_LIST'){
  const url=sender.url?new URL(sender.url):undefined;
  const root=new URL(api.runtime.getURL(''));
  if(!url||url.protocol!==root.protocol||url.host!==root.host||!['/options.html','/reader.html','/index.html'].includes(url.pathname))throw Error('系统字体仅供扩展设置页选择');
  if(url.pathname==='/reader.html')await session(new URLSearchParams(url.hash.slice(1)).get('session'),sender);
  return {ok:true,fonts:await querySystemFonts()};
 }
 if(message.type.startsWith('WEBDAV_')){const url=webDAVSenderURL(sender);if(url?.pathname==='/reader.html')await session(new URLSearchParams(url.hash.slice(1)).get('session'),sender);return handleSyncMessage(message,sender);}
 if(message.type==='OPEN_LIBRARY'){await api.tabs.create({url:api.runtime.getURL('options.html#library')});return {ok:true};}
 if(message.type==='READER_CREATE'){
  if(!sender.tab?.id||!/^https?:|^file:/.test(sender.url||''))throw Error('只能从网页创建阅读会话');
  const article=message.article as Article;if(!article||typeof article.html!=='string'||article.html.length>5_000_000||typeof article.url!=='string')throw Error('文章数据无效或过大');
  if(new URL(article.url).origin!==new URL(sender.url!).origin)throw Error('文章来源与当前页面不一致');
  const id=crypto.randomUUID();await api.storage.session.set({[sessionKey(id)]:{article,tabId:sender.tab.id,createdAt:Date.now()}});return {ok:true,session:id,url:api.runtime.getURL(`reader.html#session=${id}`)};
 }
 if(message.type==='READER_DETACH'){const item=await session(message.session,sender);const tab=await api.tabs.create({url:'about:blank'});if(!tab.id)throw Error('无法打开阅读标签页');await api.storage.session.set({[sessionKey(String(message.session))]:{...item,tabId:tab.id}});const panel=['settings','library'].includes(String(message.panel))?'&panel='+message.panel:'';await api.tabs.update(tab.id,{url:api.runtime.getURL('reader.html#session='+message.session+panel)});return {ok:true};}
 if(message.type==='READER_GET'){
  if(!sender.url?.startsWith(api.runtime.getURL('reader.html')+'#'))throw Error('只能在隔离阅读界面读取正文');
  const item=await session(message.session,sender);return {ok:true,article:item.article};
 }
 if(message.type==='READER_REMOVE'){await session(message.session,sender);await api.storage.session.remove(sessionKey(String(message.session)));return {ok:true};}
 if(message.type==='FETCH'||message.type==='FETCH_IMAGE'){
  let source=sender.url||'';if(source.startsWith(api.runtime.getURL('reader.html')+'#')){const id=new URLSearchParams(new URL(source).hash.slice(1)).get('session');source=(await session(id,sender)).article.url;}
  if(sender.url?.startsWith(api.runtime.getURL(''))&&typeof message.articleId==='string'){const key='circle.replica.article.'+message.articleId;const article=(await api.storage.local.get(key))[key] as Article|undefined;if(article?.url)source=article.url;}
  const origin=new URL(source).origin,url=new URL(String(message.url));if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('仅支持无凭据的 HTTP/HTTPS 地址');
  const image=message.type==='FETCH_IMAGE';if(!image&&url.origin!==origin)throw Error('多页正文只允许加载与原文同源的页面');
  const response=await fetch(url.href,{credentials:url.origin===origin?'include':'omit',redirect:'error',signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error(`请求失败 (${response.status})`);
  const mime=response.headers.get('content-type')||'';if(image&&!/^image\//i.test(mime))throw Error('图片地址返回了非图片内容');
  const limit=image?15_000_000:10_000_000;if(Number(response.headers.get('content-length'))>limit)throw Error('内容过大');
  const reader=response.body?.getReader();if(!reader)throw Error('响应没有可读内容');const chunks:Uint8Array[]=[];let size=0;try{while(true){const item=await reader.read();if(item.done)break;size+=item.value.byteLength;if(size>limit){await reader.cancel();throw Error('内容过大');}chunks.push(item.value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  if(image){let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {ok:true,dataUrl:`data:${mime.split(';')[0]};base64,${btoa(binary)}`};}
  const head=String.fromCharCode(...bytes.subarray(0,2048));const encoding=/charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(mime)?.[1]||/<meta[^>]+charset\s*=\s*["']?([a-zA-Z0-9_-]+)/i.exec(head)?.[1]||'utf-8';let text:string;try{text=new TextDecoder(encoding).decode(bytes);}catch{text=new TextDecoder().decode(bytes);}
  return {ok:true,text};
 }
 throw Error('未知操作');
}
api.runtime.onMessage.addListener((message,sender,reply)=>{if(!message||typeof message!=='object'){reply({ok:false,error:'消息无效'});return;}void handle(message,sender).then(reply).catch(error=>reply({ok:false,error:error.message}));return true;});
