export interface FontOption {fontId:string;displayName:string}

/** Only browser-provided, CSS-safe names are exposed to the selector. */
export function normalizeSystemFonts(value:unknown):FontOption[]{
 if(!Array.isArray(value)||value.length>20000)throw Error('系统字体列表格式无效。');
 const fonts=new Map<string,FontOption>();
 for(const entry of value){
  if(!entry||typeof entry!=='object')continue;
  const {fontId,displayName}=entry as Record<string,unknown>;
  if(typeof fontId!=='string'||!fontId.trim()||fontId.length>300||/[";{}<>\\]/.test(fontId)||Array.from(fontId).some(char=>char.charCodeAt(0)<32||char.charCodeAt(0)===127))continue;
  const id=fontId.trim();
  const name=typeof displayName==='string'&&displayName.trim()&&displayName.length<=300?displayName.trim():id;
  if(!fonts.has(id))fonts.set(id,{fontId:id,displayName:name});
 }
 return [...fonts.values()].sort((a,b)=>a.displayName.localeCompare(b.displayName,'zh-CN')||a.fontId.localeCompare(b.fontId));
}

export function fontFamilyFor(fontId:string):string{
 const font=normalizeSystemFonts([{fontId,displayName:fontId}])[0];
 if(!font)throw Error('字体名称无效。');
 return `"${font.fontId}", serif`;
}

/** Called only in the extension background; it never changes browser font settings. */
export async function querySystemFonts():Promise<FontOption[]>{
 if(typeof chrome==='undefined'||!chrome.fontSettings?.getFontList)throw Error('当前浏览器未提供系统字体列表。可保留当前样式或选择通用字体。');
 const result=normalizeSystemFonts(await chrome.fontSettings.getFontList());
 if(!result.length)throw Error('浏览器没有返回可用的系统字体。可保留当前样式或选择通用字体。');
 return result;
}

let cached:Promise<FontOption[]>|undefined;
export function requestSystemFonts(refresh=false):Promise<FontOption[]>{
 if(refresh)cached=undefined;
 if(!cached)cached=(async()=>{
  if(typeof chrome==='undefined'||!chrome.runtime?.id||!chrome.runtime.sendMessage)throw Error('当前环境未提供系统字体列表。可保留当前样式或选择通用字体。');
  const response:unknown=await chrome.runtime.sendMessage({type:'FONT_LIST'});
  if(!response||typeof response!=='object')throw Error('未能读取系统字体列表，请重试。');
  const result=response as Record<string,unknown>;
  if(result.ok!==true)throw Error(typeof result.error==='string'?result.error:'未能读取系统字体列表，请重试。');
  const fonts=normalizeSystemFonts(result.fonts);
  if(!fonts.length)throw Error('浏览器没有返回可用的系统字体。');
  return fonts;
 })().catch(error=>{cached=undefined;throw error;});
 return cached;
}
