import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import type { Article, Rule } from '../types';
import {detectPolicyHeadings,recoverPolicyMetadata} from './policy-structure';

export interface ExtractOptions {detectHeadings?:boolean}

/** Sanitization is repeated at import/render boundaries; original DOM is never modified. */
export function sanitizeHTML(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, mathMl: true, svg: true },
    FORBID_TAGS: ['script','style','iframe','object','embed','form','input','button','textarea','select','link','meta','base','foreignObject','use'],
    FORBID_ATTR: ['style','srcdoc','formaction','autofocus'],
    ALLOW_DATA_ATTR: false, ADD_ATTR:['data-circle-source'],
  });
}
function absolute(value: string, base: string, image = false): string | undefined {
  try {
    const url = new URL(value, base);
    if (['http:','https:','file:'].includes(url.protocol) || (image && /^data:image\/(png|jpeg|gif|webp);base64,/i.test(value))) return url.href;
    if (!image && ['mailto:','tel:'].includes(url.protocol)) return url.href;
  } catch { /* Invalid resource URLs are discarded. */ }
}
function query(root: Document | Element, selector: string): Element | null {
  try { return root.querySelector(selector); } catch { throw new Error(`规则选择器无效：${selector}`); }
}
function normalizedUrl(url: string): string { const u = new URL(url); u.hash = ''; return u.href; }
export function articleId(url: string): string {
  const text = normalizedUrl(url); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `article-${(hash >>> 0).toString(16)}-${text.length}`;
}
export function matchesPattern(url: string, pattern: string): boolean {
  const p = pattern.trim(); if (!p || p.length > 2048) return false;
  try {
    if (p.startsWith('[') && p.endsWith(']')) return new RegExp(p.slice(1,-1), 'i').test(url);
    const u = new URL(url);
    if (!p.includes('/') && !p.includes('*')) return u.hostname === p || u.hostname.endsWith(`.${p}`);
    const regex = p.split('*').map(s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*');
    return new RegExp(`^${regex}$`, 'i').test(url);
  } catch { return false; }
}
export function findNextUrl(doc: Document, url: string, rule?: Rule): string | undefined {
  const rel = doc.querySelector('link[rel="next"],a[rel="next"]');
  const explicit = rule?.next ? query(doc, rule.next) : rel;
  const links = explicit ? [explicit] : Array.from(doc.querySelectorAll('a[href]')).filter(a => /^(下一[页頁章篇]|下页|next(?:\s*page)?|次のページ)[\s»›>]*$/i.test((a.textContent || a.getAttribute('title') || '').trim()));
  for (const link of links) {
    const href = absolute(link.getAttribute('href') || '',url);
    if (href && /^https?:/.test(href) && normalizedUrl(href) !== normalizedUrl(url)) return href;
  }
}
function sourceSelector(element:Element):string {
 const parts:string[]=[];let node:Element|null=element;
 while(node&&node.tagName!=='HTML'){
  if(node.id){parts.unshift('#'+Array.from(node.id).map(c=>'\\'+c.codePointAt(0)!.toString(16)+' ').join(''));break;}
  const siblings=node.parentElement?[...node.parentElement.children].filter(e=>e.tagName===node!.tagName):[];
  parts.unshift(node.tagName.toLowerCase()+(siblings.length>1?`:nth-of-type(${siblings.indexOf(node)+1})`:''));node=node.parentElement;if(parts.length>20)return '';
 }
 return parts.join(' > ');
}
function prepare(doc: Document, url: string, rule?: Rule,keepSources=false): void {
  if(!keepSources)Array.from(doc.querySelectorAll('p,h1,h2,h3,h4,h5,h6,table,pre,blockquote,li,figure,img')).slice(0,10000).forEach(el=>el.setAttribute('data-circle-source',sourceSelector(el)));

  const author=doc.querySelector('meta[name=author]')?.getAttribute('content');if(author)doc.querySelectorAll('.byline,[rel=author]').forEach(e=>{if(e.textContent?.includes(author))e.remove();});
  doc.querySelectorAll('script,style,nav,footer,aside,[aria-hidden="true"],.advertisement,.ads,.cookie-banner').forEach(e=>e.remove());
  if (rule?.remove) {
    try { doc.querySelectorAll(rule.remove).forEach(e=>e.remove()); } catch { throw new Error(`规则移除选择器无效：${rule.remove}`); }
  }
  doc.querySelectorAll('img').forEach(img=>{
    const src = img.getAttribute('data-src') || img.getAttribute('data-original') || img.getAttribute('data-lazy-src') || img.getAttribute('src');
    const href = src && absolute(src,url,true);
    if (href) img.setAttribute('src',href); else img.removeAttribute('src');
    img.removeAttribute('srcset'); img.removeAttribute('loading');
    img.removeAttribute('width'); img.removeAttribute('height');
  });
  doc.querySelectorAll('a[href]').forEach(a=>{
    const href = absolute(a.getAttribute('href') || '',url);
    if (href) { a.setAttribute('href',href); a.setAttribute('rel','noopener noreferrer'); }
    else a.removeAttribute('href');
  });
}
function meta(doc: Document, selector: string): string { return doc.querySelector(selector)?.getAttribute('content')?.trim() || ''; }
function makeArticle(doc: Document, url: string, html: string, info: Partial<Article>, nextUrl?: string,options:ExtractOptions={}): Article {
  const holder = doc.createElement('div'); holder.innerHTML = sanitizeHTML(html);
  const normalizeTitle=(value:string)=>value.replace(/\s+/g,'').trim();
  const firstHeading=holder.querySelector('h1,h2');if(firstHeading&&info.title&&normalizeTitle(firstHeading.textContent||'')===normalizeTitle(info.title))firstHeading.remove();
  holder.querySelectorAll('.byline,[rel=author]').forEach(el=>{if(info.author&&(el.textContent||'').includes(info.author))el.remove();});
  const policyMetadata=recoverPolicyMetadata(holder,info.title||'');
  if(options.detectHeadings!==false)detectPolicyHeadings(holder);
  const clean=holder.innerHTML;
  const text = holder.textContent?.trim() || '';
  if (!text && !holder.querySelector('img,table,math')) throw new Error('未识别到正文，请使用手动选择正文。');
  const excerpt=info.excerpt?.trim()||'';
  return {id:articleId(url),url,title:info.title?.trim() || doc.title || '未命名文章',author:info.author || '',published:info.published || '',excerpt:excerpt&&normalizedContent(text).includes(normalizedContent(excerpt))?'':excerpt,...policyMetadata,html:clean,text,nextUrl,savedAt:Date.now(),tags:[],category:'',archived:false};
}
export function extractArticle(original: Document, url: string, rule?: Rule,options:ExtractOptions={}): Article {
  const doc = original.cloneNode(true) as Document;
  const next = findNextUrl(doc,url,rule);
  const title = (rule?.title ? query(doc,rule.title)?.textContent : undefined) || meta(doc,'meta[property="og:title"]') || doc.querySelector('h1')?.textContent || doc.title;
  const author=meta(doc,'meta[name="author"]');
  const editor=author&&[...doc.querySelectorAll('.zrbj,[class*="editor"],[class*="Editor"]')].some(el=>/(责任编辑|编辑|editor)/i.test(el.textContent||'')&&(el.textContent||'').includes(author));
  if(editor)doc.querySelector('meta[name="author"]')?.remove();
  const govPublished=meta(doc,'meta[name="firstpublishedtime"]');
  const info = { title:title || '',author:editor?'':author,published:meta(doc,'meta[property="article:published_time"]') || doc.querySelector('time')?.getAttribute('datetime') || govPublished.replace(/^(\d{4}-\d{2}-\d{2})-(\d{2}:\d{2}:\d{2})$/,'$1T$2'),excerpt:meta(doc,'meta[name="description"]')};
  prepare(doc,url,rule);
  if (rule?.content) {
    const element = query(doc,rule.content); if (!element) throw new Error('站点规则未找到正文，请检查选择器或手动选择。');
    return makeArticle(doc,url,element.innerHTML,info,next,options);
  }
  // The government publisher exposes its complete policy body explicitly.
  // Prefer that stable boundary to heuristic extraction and retain every clause.
  const govContent=/(?:^|\.)gov\.cn$/i.test(new URL(url).hostname)?doc.querySelector('#UCAP-CONTENT'):null;
  if(govContent)return makeArticle(doc,url,govContent.innerHTML,info,next,options);
  if ((doc.body.textContent?.trim().length || 0) < 20 && !doc.body.querySelector('img,table,math')) throw new Error('未识别到正文，请使用手动选择正文。');
  const parsed = new Readability(doc.cloneNode(true) as Document, { charThreshold: 100, keepClasses: false }).parse();
  if (parsed?.content && parsed.textContent?.trim()) {
    let html = parsed.content;
    // Readability flattens one-cell tables and may discard formula markup. Keep
    // a tightly matching semantic article intact when that would lose structure.
    const semantic = doc.querySelector('article,main,[role="main"]');
    if (semantic && (semantic.textContent?.length || 0) <= parsed.textContent.length * 1.5) {
      const extracted = doc.createElement('div'); extracted.innerHTML = html;
      if (['table','math'].some(tag => semantic.querySelectorAll(tag).length > extracted.querySelectorAll(tag).length)) html = semantic.innerHTML;
    }
    return makeArticle(doc,url,html,{...info,title:info.title || parsed.title || '',author:info.author || (editor?'':parsed.byline) || '',excerpt:info.excerpt || parsed.excerpt || ''},next,options);
  }
  const fallback = doc.querySelector('article,main,[role="main"]');
  if (fallback && (fallback.textContent?.trim().length || 0) >= 30) return makeArticle(doc,url,fallback.innerHTML,info,next,options);
  throw new Error('未识别到正文，请使用手动选择正文。');
}
export function extractSelection(element: Element, url: string,options:ExtractOptions={}): Article {
  const original = element.ownerDocument; const doc = original.implementation.createHTMLDocument(original.title);
  const clone=element.cloneNode(true) as Element;const sources=[element,...element.querySelectorAll('*')],targets=[clone,...clone.querySelectorAll('*')];targets.forEach((el,i)=>el.setAttribute('data-circle-source',sourceSelector(sources[i])));doc.body.append(clone);prepare(doc,url,undefined,true);
  return makeArticle(doc,url,doc.body.innerHTML,{title:element.querySelector('h1')?.textContent || original.querySelector('h1')?.textContent || original.title},undefined,options);
}
function normalizedContent(text: string): string {
  return text.normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]+/g,'');
}
/** A deterministic comparison fingerprint, not a cryptographic digest. */
export function contentFingerprint(text: string): string {
  const normalized=normalizedContent(text);let hash=2166136261;
  for(let i=0;i<normalized.length;i++)hash=Math.imul(hash^normalized.charCodeAt(i),16777619);
  return `${(hash>>>0).toString(16)}-${normalized.length}`;
}
export function appendPage(current: Article, next: Article): Article {
  const normalizedNext=normalizedContent(next.text), normalizedCurrent=normalizedContent(current.text);
  const fingerprint=contentFingerprint(next.text);
  const currentDoc=new DOMParser().parseFromString(current.html,'text/html');
  const matchingPage=Array.from(currentDoc.querySelectorAll('section[data-page-url]')).some(section=>{
    const url=section.getAttribute('data-page-url');
    return section.getAttribute('data-page-fingerprint')===fingerprint || (url&&normalizedUrl(url)===normalizedUrl(next.url)) || contentFingerprint(section.textContent||'')===fingerprint;
  });
  if(normalizedUrl(current.url)===normalizedUrl(next.url)||!normalizedNext||matchingPage||normalizedCurrent.includes(normalizedNext))throw new Error('下一页内容重复，已停止追加。');
  const heading=currentDoc.createElement('h2');heading.textContent=next.title;
  const escapedUrl=next.url.replace(/&/g,'&amp;').replace(/"/g,'&quot;');
  return {...current,html:`${current.html}<section data-page-url="${escapedUrl}" data-page-fingerprint="${fingerprint}">${heading.outerHTML}${sanitizeHTML(next.html)}</section>`,text:`${current.text}\n\n${next.text}`,nextUrl:next.nextUrl};
}
