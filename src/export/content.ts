import DOMPurify from 'dompurify';
import TurndownService from 'turndown';
import type { Article,Settings } from '../types';
import {articleTypographyCSS} from './typography';
import {signatureLines} from '../document-style';

export function escapeXML(value: string): string {
  return value.replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[char]!));
}
export function cleanContent(html: string): string {
  return DOMPurify.sanitize(html, { USE_PROFILES: {html:true, mathMl:true, svg:true}, FORBID_TAGS:['script','style','iframe','form','input','button','object','embed'] });
}
export function sourceURL(value: string): string {
  try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''; } catch { return ''; }
}
export function articleDocument(article: Article): Document {
  const doc = new DOMParser().parseFromString(cleanContent(article.html), 'text/html');
  for (const element of doc.querySelectorAll('[src],[href]')) {
    for (const attr of ['src','href']) {
      const value = element.getAttribute(attr);
      if (!value) continue;
      try {
        const url = new URL(value, article.url);
        if (['http:','https:','data:','mailto:'].includes(url.protocol)) element.setAttribute(attr,url.href);
        else element.removeAttribute(attr);
      } catch { element.removeAttribute(attr); }
    }
    if (element instanceof HTMLImageElement) { element.removeAttribute('srcset'); element.removeAttribute('loading'); }
  }
  return doc;
}
export function articleMarkdown(article: Article): string {
  const td = new TurndownService({headingStyle:'atx',codeBlockStyle:'fenced',bulletListMarker:'-'});
  td.addRule('table',{filter:'table',replacement:(_content,node) => {
    const rows = Array.from((node as HTMLTableElement).rows);
    if (!rows.length) return '';
    const count = Math.max(...rows.map(row => row.cells.length));
    const result = rows.map(row => '| ' + Array.from({length:count},(_,i)=>(row.cells[i]?.textContent || '').trim().replace(/\|/g,'\\|').replace(/\n/g,' ')).join(' | ') + ' |');
    result.splice(1,0,'| '+Array(count).fill('---').join(' | ')+' |');
    return '\n\n'+result.join('\n')+'\n\n';
  }});
  const metadata = [article.signature||article.author,article.signedDate||article.published,`来源：${article.url}`].filter(Boolean).join('\n\n');
  return `# ${article.title}\n\n${metadata}\n\n${td.turndown(articleDocument(article).body.innerHTML)}\n`;
}
export function articleHTML(article: Article,settings?:Settings): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeXML(article.title)}</title><style>body{font:20px/1.8 system-ui,sans-serif;color:#222;max-width:860px;margin:48px auto;padding:24px}h1{line-height:1.4}img,svg{max-width:100%;height:auto}table{border-collapse:collapse;max-width:100%}td,th{border:1px solid #ccc;padding:8px}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#f5f5f5;padding:16px}a{color:#4169c1}.metadata{font-size:14px;color:#666}${settings?articleTypographyCSS(settings):''}@media print{body{margin:0;max-width:none}pre,figure{break-inside:avoid}}</style></head><body><header><h1>${escapeXML(article.title)}</h1><div class="article-meta">${signatureLines(article).map(line=>`<p>${escapeXML(line)}</p>`).join('')}${settings?.appearance.metadata.showStats?`<small>共 ${article.text.replace(/\s/g,'').length} 字 · 阅读需 ${Math.max(1,Math.ceil(article.text.length/500))} 分钟</small>`:''}</div></header><main>${articleDocument(article).body.innerHTML}</main><footer class="article-source">来源：<a href="${escapeXML(sourceURL(article.url))}">${escapeXML(article.url)}</a></footer></body></html>`;
}
export function safeFilename(value: string): string {
  return Array.from(value, char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127 ? '_' : char).join('').replace(/[/\\:*?"<>|]/g,'_').replace(/\.{2,}/g,'').replace(/^\.+/,'').replace(/[. ]+$/,'').trim().slice(0,120) || '文章';
}
