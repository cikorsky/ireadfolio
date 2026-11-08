import {exportFormats} from '../toolbar';
import { defaults,legacyAppearance,builtInReadingStyles } from '../defaults';
import {captureReadingStyle,applyDefaultReadingStyle,readingStyleKeys,toolbarAppearanceKeys} from '../styles';
import type { Article, Annotation, Settings, Backup, Rule, Appearance, Taxonomy, ReadingStyle } from '../types';
import { sanitizeHTML } from './parser';
const PREFIX='circle.replica.';
const SETTINGS=PREFIX+'settings';
const TAXONOMY=PREFIX+'taxonomy';
function isObject(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function clone<T>(value:T):T{return JSON.parse(JSON.stringify(value)) as T;}
function native(){return typeof chrome!=='undefined'&&chrome.storage?.local;}
async function readAll():Promise<Record<string,unknown>>{
  const api=native(); if(api)return api.get(null);
  const result:Record<string,unknown>={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith(PREFIX)){try{result[key]=JSON.parse(localStorage.getItem(key)||'null');}catch{throw new Error('本地数据损坏，请导出备份后检查。');}}}return result;
}
async function write(items:Record<string,unknown>):Promise<void>{const api=native();if(api){await api.set(items);return;}const before=new Map(Object.keys(items).map(k=>[k,localStorage.getItem(k)]));try{for(const[k,v]of Object.entries(items))localStorage.setItem(k,JSON.stringify(v));}catch(error){for(const[k,v]of before)if(v===null)localStorage.removeItem(k);else localStorage.setItem(k,v);throw error;}}
async function remove(keys:string[]):Promise<void>{const api=native();if(api){await api.remove(keys);return;}keys.forEach(k=>localStorage.removeItem(k));}
const numberRanges:Partial<Record<keyof Settings,[number,number]>>={fontSize:[10,80],lineHeight:[1,4],paragraphSpace:[0,160],width:[280,3000],pagePadding:[0,300],pageMargin:[0,300],columns:[1,4],scrollSpeed:[1,500],speechRate:[0.1,10],speechPitch:[0,2]};
function stringList(value:unknown):value is string[]{return Array.isArray(value)&&value.length<10000&&value.every(v=>typeof v==='string'&&v.length<=100000);}
function ruleValid(v:unknown):v is Rule{return isObject(v)&&['id','pattern','title','content','next','remove'].every(k=>typeof v[k]==='string');}
const appearanceRanges:Partial<Record<keyof Appearance,[number,number]>>={fontWeight:[100,900],letterSpacing:[-10,10],textIndent:[0,10],paragraphBefore:[0,160],fixedLineHeight:[10,240],titleSize:[10,160],titleWeight:[100,900],titleLineHeight:[10,240],titleSpaceBefore:[0,240],titleSpaceAfter:[0,240],titleIndent:[0,10],codeSize:[12,50],codeLineHeight:[1,3],toolbarItemGap:[0,50],toolbarGroupGap:[0,50],toolbarX:[-10000,10000],toolbarY:[-10000,10000]};
function validColor(value:unknown):value is string{return typeof value==='string'&&/^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);}
function validFont(value:unknown):value is string{return typeof value==='string'&&!!value.trim()&&value.length<=300&&!/[;{}<>\\\n\r]/.test(value);}
function six(value:unknown,test:(item:unknown)=>boolean){return Array.isArray(value)&&value.length===6&&value.every(test);}
const documentBlockKeys=['metadata','table','pageNumber'] as const;
function validateDocumentBlock<K extends typeof documentBlockKeys[number]>(kind:K,input:unknown):Appearance[K]{
 // Firefox storage can return plain records from another JavaScript realm.
 // Validate their data fields, rather than comparing realm-specific prototypes.
 if(!isObject(input)||Object.prototype.toString.call(input)!=='[object Object]')throw new Error(`${kind} 样式格式无效。`);
 const out=clone(defaults.appearance[kind]),fields=out as unknown as Record<string,unknown>;
 const ranges:Record<string,[number,number]>={fontSize:[8,100],headerFontSize:[8,100],fontWeight:[100,900],headerFontWeight:[100,900],lineHeight:[10,240],spaceBefore:[0,240],spaceAfter:[0,240],letterSpacing:[-10,10],borderWidth:[0,10],cellPaddingX:[0,80],cellPaddingY:[0,80],start:[1,99999],marginBottom:[0,240]};
 // Existing snapshots retain uniform footers until the duplex option is selected.
 if(kind==='pageNumber'&&input.differentOddEven===undefined)Object.assign(out,{differentOddEven:false});
 const enums:Record<string,string[]>={fontStyle:['normal','italic'],textDecoration:['none','underline','line-through'],textAlign:['left','center','right'],align:['left','center','right'],evenAlign:['left','center','right'],borderStyle:['solid','dashed','none'],width:['auto','full'],cellVerticalAlign:['top','middle','bottom'],format:['dash','plain','page-total']};
 for(const [key,value]of Object.entries(input)){
  if(!Object.hasOwn(fields,key))throw new Error(`未知 ${kind} 样式设置：${key}`);
  const range=ranges[key];
  if(range){if(typeof value!=='number'||!Number.isFinite(value)||value<range[0]||value>range[1]||(['fontWeight','headerFontWeight','start'].includes(key)&&!Number.isInteger(value)))throw new Error(`${kind} 样式 ${key} 超出有效范围。`);}
  else if(key==='fontFamily'||key==='headerFontFamily'){if(!validFont(value))throw new Error(`${kind} 字体格式无效。`);}
  else if(['color','headerColor','headerBackground','borderColor','stripeColor'].includes(key)){if(!validColor(value))throw new Error(`${kind} 颜色格式无效。`);}
  else if(enums[key]){if(typeof value!=='string'||!enums[key].includes(value))throw new Error(`${kind} 样式 ${key} 无效。`);}
  else if(typeof fields[key]==='boolean'){if(typeof value!=='boolean')throw new Error(`${kind} 样式 ${key} 应为开关。`);}
  else throw new Error(`${kind} 样式 ${key} 格式无效。`);
  fields[key]=clone(value);
 }
 return out;
}
export function validateAppearance(input:unknown):Appearance{
 if(!isObject(input))throw new Error('外观设置格式无效。');
 const result=clone(defaults.appearance);
 for(const key of Object.keys(input)){
  if(!Object.hasOwn(result,key))throw new Error(`未知外观设置：${key}`);
  const value=input[key],range=appearanceRanges[key as keyof Appearance];
  if((documentBlockKeys as readonly string[]).includes(key)){Object.assign(result,{[key]:validateDocumentBlock(key as typeof documentBlockKeys[number],value)});continue;}
  if(range){if(typeof value!=='number'||!Number.isFinite(value)||value<range[0]||value>range[1]||(['fontWeight','titleWeight'].includes(key)&&!Number.isInteger(value)))throw new Error(`外观设置 ${key} 超出有效范围。`);}
  else if(['textAlign','titleAlign','imageAlign'].includes(key)){if(!['default','left','center','right','justify'].includes(String(value))||typeof value!=='string')throw new Error(`外观设置 ${key} 对齐方式无效。`);}
  else if(key==='toolbarAnchor'){if(value!=='page')throw new Error('工具栏锚定方式无效。');}
  else if(key==='hideImages'||key==='toolbarAutoHide'){if(typeof value!=='boolean')throw new Error(`外观设置 ${key} 应为开关。`);}
  else if(key==='headingSizes'||key==='headingWeights'){const min=key==='headingSizes'?.1:100,max=key==='headingSizes'?5:900;if(!Array.isArray(value)||value.length!==6||!value.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max&&(key==='headingSizes'||Number.isInteger(v))))throw new Error('各级标题样式必须包含6项有效数值。');}
  else if(key==='headingColors'){if(!Array.isArray(value)||value.length!==6||!value.every(validColor))throw new Error('各级标题颜色必须包含6项有效颜色。');}
  else if(['linkColor','selectionColor','selectionBackground','titleColor'].includes(key)){if(!validColor(value))throw new Error(`外观设置 ${key} 颜色无效。`);}
  else if(key==='codeFont'||key==='titleFont'){if(!validFont(value))throw new Error('字体格式无效。');}
  else if(key==='fontStyle'||key==='titleStyle'){if(!['normal','italic'].includes(String(value))||typeof value!=='string')throw new Error('字体样式无效。');}
  else if(key==='textDecoration'||key==='titleDecoration'){if(!['none','underline','line-through'].includes(String(value))||typeof value!=='string')throw new Error('文字装饰无效。');}
  else if(key==='lineHeightMode'){if(value!=='multiple'&&value!=='fixed')throw new Error('行距模式无效。');}
  else if(key==='headingFonts'){if(!six(value,validFont))throw new Error('各级标题字体必须包含6项有效字体。');}
  else if(key==='headingStyles'){if(!six(value,v=>v==='normal'||v==='italic'))throw new Error('各级标题字体样式必须包含6项有效值。');}
  else if(key==='headingDecorations'){if(!six(value,v=>v==='none'||v==='underline'||v==='line-through'))throw new Error('各级标题文字装饰必须包含6项有效值。');}
  else if(key==='headingAligns'){if(!six(value,v=>typeof v==='string'&&['default','left','center','right','justify'].includes(v)))throw new Error('各级标题对齐方式必须包含6项有效值。');}
  else if(['headingLineHeights','headingSpaceBefore','headingSpaceAfter','headingIndents'].includes(key)){const min=key==='headingLineHeights'?10:0,max=key==='headingIndents'?10:240;if(!six(value,v=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max))throw new Error('各级标题段落样式必须包含6项有效数值。');}
  else if(key==='backgroundImage'){if(typeof value!=='string'||value.length>3_000_000||(value!==''&&!/^https?:\/\/[^\s"'<>\\]+$/i.test(value)&&!/^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value)))throw new Error('背景图须为HTTP(S)网址或PNG/JPEG/GIF/WebP图片。');}
  Object.assign(result,{[key]:clone(value)});
 }
 // Prior versions persisted viewport coordinates; migrate them once to page anchoring.
 if(input.toolbarAnchor===undefined){result.toolbarX=-1;result.toolbarY=-1;}
 return result;
}
function validateSettingsBase(input:unknown):Settings{
  if(!isObject(input))throw new Error('设置数据格式无效。');
  const out=clone(defaults);
  for(const key of Object.keys(defaults) as (keyof Settings)[]){
    const v=input[key];if(v===undefined)continue;
    if(key==='savedStyles'||key==='defaultStyleId')continue;
    if(key==='defaultExportFormat'){if(!exportFormats.some(([format])=>format===v))throw new Error('默认导出格式无效。');out.defaultExportFormat=v as Settings['defaultExportFormat'];continue;}
    if(key==='toolbarExtras'){if(!isObject(v)||Object.entries(v).some(([name,value])=>!Object.hasOwn(out.toolbarExtras,name)||typeof value!=='boolean'))throw new Error('工具栏附加按钮设置无效。');out.toolbarExtras={...out.toolbarExtras,...v};continue;}
    if(key==='appearance'){out.appearance=validateAppearance(v);continue;}
    if(key==='fontFamily'){if(!validFont(v))throw new Error('正文字体格式无效。');out.fontFamily=v;continue;}
    const range=numberRanges[key];
    if(range){if(typeof v!=='number'||!Number.isFinite(v)||v<range[0]||v>range[1]||(key==='columns'&&!Number.isInteger(v)))throw new Error(`设置 ${key} 超出有效范围。`);Object.assign(out,{[key]:v});continue;}
    if(['whitelist','blacklist','toolbar'].includes(key)){if(!stringList(v))throw new Error(`设置 ${key} 格式无效。`);Object.assign(out,{[key]:v});continue;}
    if(key==='rules'){if(!Array.isArray(v)||!v.every(ruleValid))throw new Error('站点规则格式无效。');out.rules=clone(v);continue;}
    if(key==='modules'||key==='shortcuts'){if(!isObject(v)||!Object.values(v).every(x=>typeof x===(key==='modules'?'boolean':'string')))throw new Error('模块或快捷键格式无效。');Object.assign(out,{[key]:{...out[key],...v}});continue;}
    if(typeof v!==typeof defaults[key]||(typeof v==='string'&&v.length>100000))throw new Error(`设置 ${key} 格式无效。`);
    Object.assign(out,{[key]:v});
  }
  out.modules.parse=true;out.modules.render=true;out.modules.manual=true;
  return out;
}
export function validateSettings(input:unknown):Settings{
 const out=validateSettingsBase(input);
 if(isObject(input)&&(input.defaultStyleId===undefined||input.defaultStyleId==='policy-document')&&isObject(input.appearance)&&input.appearance.toolbarAnchor===undefined&&isObject(input.appearance.pageNumber)){
  const prior={...defaults.appearance.pageNumber,marginBottom:24};
  const candidate=input.appearance.pageNumber;
  const priorFields=Object.entries(prior).filter(([key])=>!['differentOddEven','evenAlign'].includes(key));
  if(Object.keys(candidate).every(key=>Object.hasOwn(prior,key))&&priorFields.every(([key,value])=>candidate[key]===value))out.appearance.pageNumber.marginBottom=defaults.appearance.pageNumber.marginBottom;
 }
 if(!isObject(input))throw new Error('设置数据格式无效。');
 if(input.savedStyles!==undefined){
  if(!Array.isArray(input.savedStyles)||input.savedStyles.length>100)throw new Error('自定义样式最多保存100个。');
  out.savedStyles=input.savedStyles.map(validateReadingStyle);
  const all=[...builtInReadingStyles,...out.savedStyles];
  if(new Set(all.map(style=>style.id)).size!==all.length||new Set(all.map(style=>style.name.toLocaleLowerCase())).size!==all.length)throw new Error('样式编号和名称不能重复。');
 }
 if(input.defaultStyleId!==undefined){if(typeof input.defaultStyleId!=='string'||input.defaultStyleId.length>100)throw new Error('默认样式编号无效。');out.defaultStyleId=input.defaultStyleId;}
 if(![...builtInReadingStyles,...out.savedStyles].some(style=>style.id===out.defaultStyleId))throw new Error('默认样式不存在。');
 return out;
}
function validateReadingStyle(input:unknown):ReadingStyle{
 if(!isObject(input)||Object.keys(input).some(key=>!['id','name','values'].includes(key)))throw new Error('阅读样式格式无效。');
 if(typeof input.id!=='string'||!input.id||input.id.length>100||typeof input.name!=='string'||!input.name.trim()||input.name!==input.name.trim()||input.name.length>80)throw new Error('样式编号或名称无效。');
 const values=input.values;
 if(!isObject(values)||Object.keys(values).length!==readingStyleKeys.length||Object.keys(values).some(key=>!(readingStyleKeys as readonly string[]).includes(key))||readingStyleKeys.some(key=>values[key]===undefined))throw new Error('阅读样式字段不完整或包含未知字段。');
 const appearanceKeys=Object.keys(defaults.appearance).filter(key=>!(toolbarAppearanceKeys as readonly string[]).includes(key));
 const requiredAppearanceKeys=appearanceKeys.filter(key=>!(documentBlockKeys as readonly string[]).includes(key));
 // Version 0.2 snapshots predate document blocks; keep every saved ID and prior value.
 if(!isObject(values.appearance)||Object.keys(values.appearance).some(key=>!appearanceKeys.includes(key))||requiredAppearanceKeys.some(key=>(values.appearance as Record<string,unknown>)[key]===undefined))throw new Error('阅读样式外观字段不完整或包含工具栏设置。');
 const checked=validateSettingsBase({...values,appearance:values.appearance});
 return {id:input.id,name:input.name,values:captureReadingStyle(checked)};
}
function textField(obj:Record<string,unknown>,key:string):string{if(typeof obj[key]!=='string')throw new Error(`数据字段 ${key} 应为文本。`);return obj[key] as string;}
function validateArticle(input:unknown):Article{
  if(!isObject(input))throw new Error('文章格式无效。');
  const a:Article={id:textField(input,'id'),url:textField(input,'url'),title:textField(input,'title'),author:textField(input,'author'),published:textField(input,'published'),excerpt:textField(input,'excerpt'),html:sanitizeHTML(textField(input,'html')),text:textField(input,'text'),savedAt:0,tags:[],category:textField(input,'category'),archived:false};
  if(!a.id||a.id.length>200||!stringList(input.tags)||typeof input.archived!=='boolean'||typeof input.savedAt!=='number'||!Number.isFinite(input.savedAt))throw new Error('文章字段无效。');
  let url:URL;try{url=new URL(a.url);}catch{throw new Error('文章网址无效。');}if(!['http:','https:','file:','about:','chrome-extension:','moz-extension:'].includes(url.protocol))throw new Error('不支持该文章网址。');
  a.tags=clone(input.tags);a.archived=input.archived;a.savedAt=input.savedAt;
  for(const key of ['signature','signedDate'] as const){if(input[key]!==undefined){const value=textField(input,key);if(value.length>(key==='signature'?2000:200))throw new Error(`文章字段 ${key} 过长。`);a[key]=value;}}
  if(input.deletedAt!==undefined){if(typeof input.deletedAt!=='number'||!Number.isFinite(input.deletedAt))throw new Error('删除日期无效。');a.deletedAt=input.deletedAt;}
  if(input.nextUrl!==undefined){const u=new URL(textField(input,'nextUrl'),a.url);if(!/^https?:$/.test(u.protocol))throw new Error('下一页网址无效。');a.nextUrl=u.href;}
  return a;
}
function validateAnnotation(input:unknown):Annotation{
  if(!isObject(input))throw new Error('批注格式无效。');
  const a:Annotation={id:textField(input,'id'),articleId:textField(input,'articleId'),quote:textField(input,'quote'),prefix:textField(input,'prefix'),suffix:textField(input,'suffix'),note:textField(input,'note'),color:textField(input,'color'),createdAt:0};
  if(!a.id||a.id.length>200||!a.articleId||typeof input.createdAt!=='number'||!Number.isFinite(input.createdAt))throw new Error('批注字段无效。');a.createdAt=input.createdAt;return a;
}
export async function getSettings():Promise<Settings>{
 const data=await readAll(),raw=data[SETTINGS];
 if(raw===undefined)return clone(defaults);
 const settings=validateSettings(raw);
 if(isObject(raw)&&raw.savedStyles===undefined&&raw.defaultStyleId===undefined){
  // Reading does not write: content scripts and the reader may load concurrently.
  // The next ordinary settings save persists this one-time, deterministic migration.
  const prior=clone(settings),appearance=isObject(raw.appearance)?raw.appearance:{};
  prior.appearance=validateAppearance({...legacyAppearance,titleFont:prior.fontFamily,titleSize:prior.fontSize*2,titleLineHeight:Math.min(240,prior.fontSize*2*1.35),headingFonts:Array(6).fill(prior.fontFamily),...appearance});
  // Old relative headings can produce more pixels than the new explicit spacing limit.
  prior.appearance.headingLineHeights=prior.appearance.headingSizes.map(size=>Math.max(10,Math.min(240,size*prior.fontSize*1.5)));
  prior.appearance.headingSpaceBefore=prior.appearance.headingSizes.map(size=>Math.min(240,size*prior.fontSize*1.5));
  prior.appearance.headingSpaceAfter=prior.appearance.headingSizes.map(size=>Math.min(240,size*prior.fontSize*.7));
  settings.savedStyles=[{id:'pre-template',name:'升级前阅读样式',values:captureReadingStyle(prior)}];
  return applyDefaultReadingStyle(settings);
 }
 return settings;
}
export async function saveSettings(settings:Settings):Promise<void>{await write({[SETTINGS]:validateSettings(settings)});}
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export async function getArticles():Promise<Article[]>{
  const data=await readAll();
  const articles=Object.entries(data).filter(([k])=>k.startsWith(PREFIX+'article.')).map(([,v])=>validateArticle(v));
  const expired=new Set(articles.filter(a=>a.deletedAt!==undefined&&Date.now()-a.deletedAt>=TRASH_RETENTION_MS).map(a=>a.id));
  if(expired.size){
    const keys=[...expired].map(id=>PREFIX+'article.'+id);
    for(const[key,value]of Object.entries(data))if(key.startsWith(PREFIX+'annotation.')&&isObject(value)&&typeof value.articleId==='string'&&expired.has(value.articleId))keys.push(key);
    await remove(keys);
  }
  return articles.filter(a=>!expired.has(a.id)).sort((a,b)=>b.savedAt-a.savedAt);
}
export async function saveArticle(article:Article):Promise<void>{
 const a=validateArticle(article),data=await readAll();
 const taxonomy=data[TAXONOMY]===undefined?{categories:[],tags:[]}:validateTaxonomy(data[TAXONOMY]);
 if(a.category&&!taxonomy.categories.includes(a.category))taxonomy.categories.push(a.category);
 for(const tag of a.tags)if(!taxonomy.tags.includes(tag))taxonomy.tags.push(tag);
 await write({[PREFIX+'article.'+a.id]:a,[TAXONOMY]:validateTaxonomy(taxonomy)});
}
/** Capture updates content while preserving organization previously set in the library. */
export async function saveCapturedArticle(article:Article):Promise<Article>{
  const candidate=validateArticle(article);
  const normalized=(value:string)=>{const url=new URL(value);url.hash='';return url.href;};
  const old=(await getArticles()).find(a=>normalized(a.url)===normalized(candidate.url));
  const saved=old?{...candidate,id:old.id,tags:old.tags,category:old.category,archived:old.archived,deletedAt:old.deletedAt}:candidate;
  await saveArticle(saved);return saved;
}
export async function getAnnotations(articleId?:string):Promise<Annotation[]>{const data=await readAll();return Object.entries(data).filter(([k])=>k.startsWith(PREFIX+'annotation.')).map(([,v])=>validateAnnotation(v)).filter(a=>!articleId||a.articleId===articleId).sort((a,b)=>a.createdAt-b.createdAt);}
export async function saveAnnotation(annotation:Annotation):Promise<void>{const a=validateAnnotation(annotation);await write({[PREFIX+'annotation.'+a.id]:a});}
export async function deleteAnnotation(id:string):Promise<void>{await remove([PREFIX+'annotation.'+id]);}
export async function deleteArticle(id:string,permanent=false):Promise<void>{
  const article=(await getArticles()).find(a=>a.id===id);if(!article)return;
  if(!permanent){await saveArticle({...article,deletedAt:Date.now()});return;}
  const annotations=await getAnnotations(id);await remove([PREFIX+'article.'+id,...annotations.map(a=>PREFIX+'annotation.'+a.id)]);
}
export async function exportBackup():Promise<Backup>{return{version:1,createdAt:Date.now(),settings:await getSettings(),articles:await getArticles(),annotations:await getAnnotations(),taxonomy:await getTaxonomy()};}
function mergeSavedStyles(current:Settings,incoming:Settings):ReadingStyle[]{
 const merged=clone(current.savedStyles);
 const names=new Set([...builtInReadingStyles,...merged].map(style=>style.name.toLocaleLowerCase()));
 for(const style of incoming.savedStyles){
  const existing=merged.find(item=>item.id===style.id);
  if(existing){
   if(JSON.stringify(existing.values)!==JSON.stringify(style.values))throw new Error(`样式“${style.name}”的编号与本地快照冲突，未导入任何数据。`);
   continue;
  }
  if(merged.length>=100)throw new Error('合并后自定义样式超过100个，未导入任何数据。');
  let name=style.name,index=2;
  while(names.has(name.toLocaleLowerCase())){const suffix=`（导入${index++}）`;name=style.name.slice(0,80-suffix.length)+suffix;}
  merged.push({...clone(style),name});names.add(name.toLocaleLowerCase());
 }
 return merged;
}
export async function importBackup(input:unknown,mode:'merge'|'replace'='merge'):Promise<void>{
  if(isObject(input)&&(Object.keys(input).some(key=>/^(?:option_|apps_|node_)/.test(key))||(typeof input.version==='string'&&isObject(input.data))))throw new Error('备份格式不兼容，请使用iReadFolio · i悦读完整备份；未修改本地数据。');
  if(!isObject(input)||input.version!==1||!Array.isArray(input.articles)||!Array.isArray(input.annotations)||input.articles.length>50000||input.annotations.length>200000)throw new Error('备份格式无效或版本不支持。');
  // Validate every item before the first write. A rejected backup never changes storage.
  let settings=validateSettings(input.settings);const articles=input.articles.map(validateArticle),annotations=input.annotations.map(validateAnnotation);
  const incomingTaxonomy=input.taxonomy===undefined?undefined:validateTaxonomy(input.taxonomy);
  if(new Set(articles.map(a=>a.id)).size!==articles.length||new Set(annotations.map(a=>a.id)).size!==annotations.length)throw new Error('备份包含重复记录。');
  const current=await readAll();
  if(mode==='merge'&&current[SETTINGS]!==undefined)settings=validateSettings({...settings,savedStyles:mergeSavedStyles(validateSettings(current[SETTINGS]),settings)});
  const items:Record<string,unknown>={[SETTINGS]:settings};
  const existingTaxonomy=mode==='merge'&&current[TAXONOMY]!==undefined?validateTaxonomy(current[TAXONOMY]):{categories:[],tags:[]};
  const taxonomy:Taxonomy={categories:[...new Set([...existingTaxonomy.categories,...incomingTaxonomy?.categories||[]])],tags:[...new Set([...existingTaxonomy.tags,...incomingTaxonomy?.tags||[]])]};
  const combinedArticles=mode==='merge'?[...Object.entries(current).filter(([key])=>key.startsWith(PREFIX+'article.')).map(([,v])=>validateArticle(v)),...articles]:articles;
  for(const a of combinedArticles){if(a.category&&!taxonomy.categories.includes(a.category))taxonomy.categories.push(a.category);for(const tag of a.tags)if(!taxonomy.tags.includes(tag))taxonomy.tags.push(tag);}
  items[TAXONOMY]=validateTaxonomy(taxonomy);
  for(const a of articles){const key=PREFIX+'article.'+a.id;const old=current[key];items[key]=mode==='merge'&&isObject(old)&&typeof old.savedAt==='number'&&old.savedAt>a.savedAt?old:a;}
  for(const a of annotations){const key=PREFIX+'annotation.'+a.id;const old=current[key];items[key]=mode==='merge'&&isObject(old)&&typeof old.createdAt==='number'&&old.createdAt>a.createdAt?old:a;}
  await write(items);
  if(mode==='replace')await remove(Object.keys(current).filter(k=>k.startsWith(PREFIX)&&!Object.hasOwn(items,k)));
}

export function validateTaxonomy(input:unknown):Taxonomy{
 if(!isObject(input))throw new Error('分类和标签数据格式无效。');
 const result:Taxonomy={categories:[],tags:[]};
 for(const kind of ['categories','tags'] as const){
  const list=input[kind];
  if(!Array.isArray(list)||list.length>10000||!list.every(name=>typeof name==='string'&&name.trim()===name&&name.length>0&&name.length<=200)||new Set(list).size!==list.length)throw new Error('分类和标签必须为不重复的非空名称列表（名称不超过200字）。');
  result[kind]=[...list];
 }
 return result;
}
export async function getTaxonomy():Promise<Taxonomy>{
 const data=await readAll(),stored=data[TAXONOMY]===undefined?{categories:[],tags:[]}:validateTaxonomy(data[TAXONOMY]);
 for(const a of await getArticles()){
  if(a.category&&!stored.categories.includes(a.category))stored.categories.push(a.category);
  for(const tag of a.tags)if(!stored.tags.includes(tag))stored.tags.push(tag);
 }
 return stored;
}
export async function saveTaxonomy(input:Taxonomy):Promise<void>{await write({[TAXONOMY]:validateTaxonomy(input)});}
export async function renameTaxonomyItem(kind:keyof Taxonomy,name:string,replacement:string):Promise<void>{
 const taxonomy=await getTaxonomy();if(!taxonomy[kind].includes(name))throw new Error('分类或标签不存在，请刷新重试。');
 const newName=replacement.trim();if(taxonomy[kind].includes(newName)&&newName!==name)throw new Error('该名称已存在。');
 taxonomy[kind]=taxonomy[kind].map(n=>n===name?newName:n);validateTaxonomy(taxonomy);
 const items:Record<string,unknown>={[TAXONOMY]:taxonomy};
 for(const a of await getArticles()){
  if(kind==='categories'&&a.category===name)items[PREFIX+'article.'+a.id]={...a,category:newName};
  if(kind==='tags'&&a.tags.includes(name))items[PREFIX+'article.'+a.id]={...a,tags:a.tags.map(t=>t===name?newName:t)};
 }
 await write(items);
}
export async function deleteTaxonomyItem(kind:keyof Taxonomy,name:string):Promise<void>{
 const taxonomy=await getTaxonomy();taxonomy[kind]=taxonomy[kind].filter(n=>n!==name);
 const items:Record<string,unknown>={[TAXONOMY]:taxonomy};
 for(const a of await getArticles()){
  if(kind==='categories'&&a.category===name)items[PREFIX+'article.'+a.id]={...a,category:''};
  if(kind==='tags'&&a.tags.includes(name))items[PREFIX+'article.'+a.id]={...a,tags:a.tags.filter(t=>t!==name)};
 }
 await write(items);
}
