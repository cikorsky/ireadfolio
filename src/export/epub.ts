import {signatureLines} from '../document-style';
import JSZip from 'jszip';
import type { Article } from '../types';
import {articleDocument,escapeXML,sourceURL} from './content';
import {loadImage} from './images';
export async function buildEpub(article: Article): Promise<Blob> {
  const zip = new JSZip();
  zip.file('mimetype','application/epub+zip',{compression:'STORE'});
  zip.file('META-INF/container.xml','<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles></container>');
  const doc=articleDocument(article);const manifest:string[]=[];const cached=new Map<string,string>();let i=0;
  for (const img of doc.querySelectorAll('img')) {
    const src=img.getAttribute('src');if (!src) continue;
    let path=cached.get(src);
    if (!path) {const data=await loadImage(src);path=`images/image-${i++}.${data.extension}`;cached.set(src,path);zip.file(`OEBPS/${path}`,data.bytes);manifest.push(`<item id="image-${i}" href="${path}" media-type="${data.mime}"/>`);}
    img.setAttribute('src',path);img.removeAttribute('srcset');
  }
  const headings = [...doc.querySelectorAll('h1,h2,h3,h4,h5,h6')];
  headings.forEach((h,index)=>h.id=`heading-${index}`);
  const title=escapeXML(article.title);const source=escapeXML(sourceURL(article.url));
  const serialize=(node:Node):string=>new XMLSerializer().serializeToString(node);
  const content=[...doc.body.childNodes].map(serialize).join('');
  const base=`xmlns="http://www.w3.org/1999/xhtml" lang="zh-CN" xml:lang="zh-CN"`;
  zip.file('OEBPS/article.xhtml',`<?xml version="1.0" encoding="UTF-8"?><html ${base}><head><title>${title}</title><style>body{line-height:1.8}img{max-width:100%}pre{white-space:pre-wrap}table{border-collapse:collapse}td,th{border:1px solid #999;padding:.4em}</style></head><body><h1>${title}</h1>${signatureLines(article).map(line=>`<p>${escapeXML(line)}</p>`).join('')}<p>来源：<a href="${source}">${source}</a></p>${content}</body></html>`);
  const toc=headings.length?headings.map((h,index)=>`<li><a href="article.xhtml#heading-${index}">${escapeXML(h.textContent || '')}</a></li>`).join(''):`<li><a href="article.xhtml">${title}</a></li>`;
  zip.file('OEBPS/nav.xhtml',`<?xml version="1.0" encoding="UTF-8"?><html ${base} xmlns:epub="http://www.idpf.org/2007/ops"><head><title>目录</title></head><body><nav epub:type="toc"><h1>目录</h1><ol>${toc}</ol></nav></body></html>`);
  const properties=/<svg[\s>]/i.test(content)?' properties="svg"':'';
  zip.file('OEBPS/content.opf',`<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${crypto.randomUUID()}</dc:identifier><dc:title>${title}</dc:title><dc:language>zh-CN</dc:language><dc:creator>${escapeXML(article.signature||article.author)}</dc:creator><dc:source>${source}</dc:source><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/,'Z')}</meta></metadata><manifest><item id="article" href="article.xhtml" media-type="application/xhtml+xml"${properties}/><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${manifest.join('')}</manifest><spine><itemref idref="article"/></spine></package>`);
  return zip.generateAsync({type:'blob',mimeType:'application/epub+zip',compression:'DEFLATE'});
}
