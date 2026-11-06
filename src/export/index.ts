import {signatureLines} from '../document-style';
import {toPng,toJpeg} from 'html-to-image';
import type {Article,ExportFormat,Settings} from '../types';
import {articleDocument,articleHTML,articleMarkdown,safeFilename} from './content';
import {embedImages} from './images';
import {buildDocx} from './word';
import {buildEpub} from './epub';
import {formatFilenameTemplate} from './filename';
export {articleHTML,articleMarkdown,safeFilename,buildDocx,buildEpub};

export function downloadBlob(blob:Blob,filename:string):void {
  const url=URL.createObjectURL(blob);const link=document.createElement('a');
  link.href=url;link.download=filename;link.style.display='none';document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function withImages(article:Article,enabled:boolean):Promise<Article> {
  if(!enabled)return article;
  const doc=articleDocument(article);await embedImages(doc);
  return {...article,html:doc.body.innerHTML};
}
export async function copyArticle(article:Article,format:'text'|'markdown'|'html'):Promise<void> {
  if(!navigator.clipboard)throw new Error('当前页面不允许访问剪贴板，请改用导出文件');
  if(format==='html') {
    if(typeof ClipboardItem==='undefined'||!navigator.clipboard.write)throw new Error('当前浏览器不支持复制富文本，请选择复制 Markdown');
    await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([articleHTML(article)],{type:'text/html'}),'text/plain':new Blob([article.text],{type:'text/plain'})})]);
  }else await navigator.clipboard.writeText(format==='markdown'?articleMarkdown(article):article.text);
}
export async function printArticle(article:Article,settings?:Settings):Promise<void> {
  const frame=document.createElement('iframe');frame.title='文章打印预览';frame.style.cssText='position:fixed;width:1px;height:1px;bottom:0;left:0;border:0';
  document.body.append(frame);
  try {
    const doc=frame.contentDocument;if(!doc||!frame.contentWindow)throw new Error('无法打开打印预览');
    doc.open();doc.write(articleHTML(article,settings));doc.close();
    await doc.fonts?.ready;
    await Promise.all([...doc.images].map(img=>img.complete?Promise.resolve():new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('打印图片加载超时')),15000);img.onload=()=>{clearTimeout(timer);resolve()};img.onerror=()=>{clearTimeout(timer);reject(new Error('打印图片加载失败'))}})));
    frame.contentWindow.focus();frame.contentWindow.print();
    setTimeout(()=>frame.remove(),60000);
  }catch(error){frame.remove();throw error;}
}
async function screenshot(element:HTMLElement,format:'png'|'jpeg'):Promise<Blob> {
  if(element.scrollHeight>24000||element.scrollWidth*element.scrollHeight>40000000)throw new Error('文章过长，超出单张图片范围，请改用 PDF 或分段导出');
  const image=format==='png'?await toPng(element,{pixelRatio:1,backgroundColor:getComputedStyle(element).backgroundColor||'#fff'}):await toJpeg(element,{pixelRatio:1,quality:.92,backgroundColor:'#fff'});
  const response=await fetch(image);return response.blob();
}
export async function exportArticle(article:Article,format:ExportFormat,settings:Settings,element?:HTMLElement):Promise<void> {
  const template=settings.filenameTemplate || '[title]';
  const name=safeFilename(formatFilenameTemplate(template,article.title));
  let blob:Blob;let extension:string=format;
  if(format==='pdf'){await printArticle(await withImages(article,settings.imageEmbed),settings);return;}
  if(format==='png'||format==='jpeg') {
    if(!element)throw new Error('请在阅读界面打开文章后再导出图片');
    blob=await screenshot(element,format);
  } else if(format==='docx') blob=await buildDocx(article,settings);
  else if(format==='epub') blob=await buildEpub(article);
  else if(format==='txt') blob=new Blob([`${article.title}\n\n${signatureLines(article).join('\n')}\n来源：${article.url}\n\n${article.text}`],{type:'text/plain;charset=utf-8'});
  else {
    const prepared=await withImages(article,settings.imageEmbed);
    if(format==='markdown'){blob=new Blob([articleMarkdown(prepared)],{type:'text/markdown;charset=utf-8'});extension='md';}
    else blob=new Blob(['\ufeff',articleHTML(prepared,settings)],{type:format==='doc'?'application/msword':'text/html;charset=utf-8'});
  }
  downloadBlob(blob,`${name}.${extension}`);
}
