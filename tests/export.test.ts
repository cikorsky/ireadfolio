import {describe,it,expect,vi} from 'vitest';
import JSZip from 'jszip';
import {loadImage} from '../src/export/images';
import type {Article} from '../src/types';
import {articleHTML,articleMarkdown,safeFilename,buildDocx,buildEpub} from '../src/export';
const article:Article={id:'test',url:'https://example.org/中文/article',title:'水库安全 <测试>',author:'张三',published:'2026-11-03',excerpt:'摘要',html:'<h2>监测范围</h2><p>正文<strong>重要</strong> <a href="/next">链接</a></p><table><tr><th>名称</th><th>数值</th></tr><tr><td>水位</td><td>100</td></tr></table><pre><code>const level = 100;</code></pre><ul><li>第一项</li><li>第二项</li></ul><script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(2)">',text:'监测范围 正文重要 水位100',savedAt:0,tags:[],category:'',archived:false};
async function bytes(blob:Blob):Promise<ArrayBuffer> {return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob)})}
describe('article exports',()=>{
 it('sanitizes executable markup and escapes metadata while retaining tables and code',()=>{const html=articleHTML(article);expect(html).not.toContain('<script');expect(html).not.toContain('onerror');expect(html).not.toContain('javascript:');expect(html).toContain('&lt;测试&gt;');expect(html).toContain('<table>');expect(html).toContain('https://example.org/next')});
 it('does not emit executable source links from imported metadata',()=>{expect(articleHTML({...article,url:'javascript:alert(1)'})).not.toContain('href="javascript:')});
 it('rejects unsafe image URLs and propagates extension download failure',async()=>{await expect(loadImage('file:///private/image.png')).rejects.toThrow('图片地址不支持');vi.stubGlobal('chrome',{runtime:{id:'test-extension',sendMessage:async()=>({ok:false,error:'图片权限不足'})}});try{await expect(loadImage('https://example.org/img.png')).rejects.toThrow('图片权限不足')}finally{vi.unstubAllGlobals()}});
 it('generates Markdown headings, links, table and fenced code',()=>{const md=articleMarkdown(article);expect(md).toContain('## 监测范围');expect(md).toContain('| 名称 | 数值 |');expect(md).toContain('| --- | --- |');expect(md).toContain('```');expect(md).toContain('**重要**');expect(md).not.toContain('alert(')});
 it('prevents paths and reserved filename characters',()=>{expect(safeFilename('../../水库:安全?.')).toBe('__水库_安全_');expect(safeFilename('...')).toBe('文章')});
 it('generates a real DOCX with Chinese text, table, heading and source relationship',async()=>{
  const blob=await buildDocx(article);const zip=await JSZip.loadAsync(await bytes(blob));
  expect(zip.file('[Content_Types].xml')).not.toBeNull();const xml=await zip.file('word/document.xml')!.async('string');expect(xml).toContain('监测范围');expect(xml).toContain('<w:tbl>');expect(xml).toContain('const level = 100;');expect(xml).toContain('第一项');expect(await zip.file('word/_rels/document.xml.rels')!.async('string')).toContain('example.org');
 });
 it('generates a valid EPUB container, nav, manifest and escaped XHTML',async()=>{
  const zip=await JSZip.loadAsync(await bytes(await buildEpub(article)));expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');expect(await zip.file('META-INF/container.xml')!.async('string')).toContain('OEBPS/content.opf');expect(await zip.file('OEBPS/nav.xhtml')!.async('string')).toContain('监测范围');const xml=await zip.file('OEBPS/article.xhtml')!.async('string');expect(xml).toContain('&lt;测试&gt;');expect(new DOMParser().parseFromString(xml,'application/xhtml+xml').querySelector('parsererror')).toBeNull();
 });
 it('embeds an inline PNG in EPUB and Word',async()=>{const src='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';const a={...article,html:`<p>图示</p><img src="${src}" alt="示意图" width="1" height="1">`};for(const [format,blob] of [['epub',await buildEpub(a)],['docx',await buildDocx(a)]] as const){const zip=await JSZip.loadAsync(await bytes(blob));expect(Object.keys(zip.files).some(path=>format==='epub'?path.startsWith('OEBPS/images/image-'):path.startsWith('word/media/')&&!path.endsWith('/'))).toBe(true)}});
});

// Canvas and Image are mocked in these tests. They prove dimensions, sanitization,
// conversion wiring and failure handling, not a browser's actual codec support.
describe('Word image preparation (mocked browser image APIs)',()=>{
 const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
 it('keeps intrinsic aspect ratio and constrains both dimensions',async()=>{
  const {rasterDimensions,fitWordImage}=await import('../src/export/word-images');
  const data=await loadImage(png);expect(rasterDimensions(data.bytes,data.mime)).toEqual({width:1,height:1});
  expect(fitWordImage({width:2000,height:1000})).toEqual({width:560,height:280});
  expect(fitWordImage({width:1000,height:4000})).toEqual({width:190,height:760});
  expect(fitWordImage({width:1000,height:500},200,200)).toEqual({width:200,height:100});
 });
 it('strips active SVG, external references, foreign objects and CSS',async()=>{
  const {safeSVG}=await import('../src/export/word-images');const svg=safeSVG(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300" onload="alert(1)"><script>alert(1)</script><style>@import "https://evil.org";</style><foreignObject><div>active</div></foreignObject><image href="https://evil.org/img"/><use href="https://evil.org/symbol.svg#x"/><rect width="600" height="300" fill="url(https://evil.org/pattern)"/><rect width="20" height="20" fill="red"/></svg>'));
  expect(svg).not.toMatch(/script|onload|foreignObject|<style|<image|evil\.org/);expect(svg).toContain('fill="red"');
 });
 it.each(['svg','webp'] as const)('converts %s to PNG through sanitized data-only image decode',async(format)=>{
  const {prepareWordImage}=await import('../src/export/word-images');let source='';const draw=vi.fn();
  class MockImage {naturalWidth=1200;naturalHeight=600;onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(value:string){source=value;queueMicrotask(()=>this.onload?.())}}
  vi.stubGlobal('Image',MockImage);const getContext=vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockReturnValue({drawImage:draw} as unknown as CanvasRenderingContext2D);const toData=vi.spyOn(HTMLCanvasElement.prototype,'toDataURL').mockReturnValue(png);
  try {const input=format==='svg'?'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="600"><rect width="1200" height="600"/></svg>'):'data:image/webp;base64,UklGRg==';const image=await prepareWordImage(input);expect(image.type).toBe('png');expect(image.width).toBe(1200);expect(image.height).toBe(600);expect(draw).toHaveBeenCalledOnce();expect(source.startsWith('data:image/')).toBe(true);expect(toData).toHaveBeenCalledWith('image/png');}
  finally {getContext.mockRestore();toData.mockRestore();vi.unstubAllGlobals()}
 });
 it('reports browser decoder rejection instead of creating an invalid Word image',async()=>{
  const {prepareWordImage}=await import('../src/export/word-images');class MockImage {onload:(()=>void)|null=null;onerror:(()=>void)|null=null;set src(_value:string){queueMicrotask(()=>this.onerror?.())}}vi.stubGlobal('Image',MockImage);try{await expect(prepareWordImage('data:image/webp;base64,UklGRg==')).rejects.toThrow('浏览器无法解码图片')}finally{vi.unstubAllGlobals()}
 });
});
