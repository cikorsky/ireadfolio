import {describe,it,expect} from 'vitest';
import {defaults} from '../src/defaults';
import {signatureLines,pageNumberLabel,printPageCSS,pageFooterLayout} from '../src/document-style';
import {articleHTML,articleMarkdown} from '../src/export/content';
import {buildDocx} from '../src/export/word';
import {buildEpub} from '../src/export/epub';
import JSZip from 'jszip';
import type {Article} from '../src/types';
import {extractSelection} from '../src/core/parser';
const article:Article={id:'policy',title:'公文标题',url:'https://example.com/policy',author:'',published:'2025-06-26T18:07:00',signature:'新华社北京6月26日电',signedDate:'2025年6月17日',excerpt:'',html:'<h1>一、总体要求</h1><table><tr><th>事项</th></tr><tr><td><p>内容</p></td></tr></table><p>正文。</p>',text:'正文。',savedAt:0,tags:[],category:'',archived:false};
async function bytes(blob:Blob):Promise<ArrayBuffer>{return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob);});}

describe('署名表格与页码实际导出契约',()=>{
 it('uses separate print margin boxes for odd and even page numbers, including an even starting number',()=>{
  const settings=structuredClone(defaults);
  let css=printPageCSS(settings);
  const right=()=>/@page:right\{(.*?)\}\}/.exec(css)?.[1];
  const left=()=>/@page:left\{(.*?)\}\}/.exec(css)?.[1];
  expect(right()).toContain('@bottom-right{content:"— "');
  expect(left()).toContain('@bottom-left{content:"— "');
  settings.appearance.pageNumber.start=2;
  settings.appearance.pageNumber.firstPage=false;
  css=printPageCSS(settings);
  expect(right()).toContain('@bottom-left{content:"— "');
  expect(left()).toContain('@bottom-right{content:"— "');
  expect(css).toMatch(/@page:first\{[^}]*counter-increment:page 2/);
  expect(css).toMatch(/@page:first\{.*@bottom-left\{content:none/);
 });
 it('手动选择正文同样遵守标题识别开关',()=>{
  const doc=new DOMParser().parseFromString('<title>测试</title><article><p>一、总体要求</p><p>这是普通正文。</p></article>','text/html'),element=doc.querySelector('article')!;
  expect(extractSelection(element,'https://example.com/manual',{detectHeadings:false}).html).not.toContain('<h1');
  expect(extractSelection(element,'https://example.com/manual',{detectHeadings:true}).html).toContain('<h1');
  expect(element.querySelector('h1')).toBeNull();
 });
 it('署名与成文日期分行，不混入阅读统计或替换为网页发布时间',()=>{
  expect(signatureLines(article)).toEqual(['新华社北京6月26日电','（2025年6月17日）']);
  const doc=new DOMParser().parseFromString(articleHTML(article,defaults),'text/html');
  expect([...doc.querySelectorAll('.article-meta p')].map(e=>e.textContent)).toEqual(signatureLines(article));
  expect(doc.querySelector('.article-meta')?.textContent).not.toContain('阅读需');
  expect(doc.querySelector('style')?.textContent).toContain('KaiTi_GB2312');
 });
 it('表格字体、边框、表头和底纹独立于正文样式，页脚为原生计数器',()=>{
  const s=structuredClone(defaults);s.appearance.table.borderColor='#234567';s.appearance.table.fontSize=18;s.appearance.table.striped=true;s.appearance.table.stripeColor='#efefef';s.appearance.pageNumber.start=5;s.appearance.pageNumber.firstPage=false;
  const html=articleHTML(article,s);
  expect(html).toMatch(/main :is\(td,th\)\{[^}]*font-size: 18px/);
  expect(html).toContain('1px solid rgb(35, 69, 103)');expect(html).toContain('background-color: rgb(239, 239, 239)');
  expect(printPageCSS(s)).toContain('@bottom-right');expect(printPageCSS(s)).toContain('counter(page)');
  expect(printPageCSS(s)).toContain('counter-increment:page 5');expect(printPageCSS(s)).toContain('content:none');
  expect(pageNumberLabel(5)).toBe('— 5 —');expect(pageNumberLabel(2,8,'page-total')).toBe('第 2 页 / 共 8 页');
 });
 it('打印与DOCX采用同一模板页脚距离，增大下边距使页码上移且不覆盖正文',()=>{
  const layout=pageFooterLayout(defaults.appearance.pageNumber);
  expect(layout.footerTwips).toBe(1417);expect(layout.bottomTwips).toBe(1984);
  const css=printPageCSS(defaults);
  expect(css).toContain('margin:28mm 21mm '+1984/15+'px');
  expect(Number(/padding-bottom: ([\d.]+)px/.exec(css)?.[1])).toBeCloseTo(1417/15,3);
  const custom=structuredClone(defaults);custom.appearance.pageNumber.marginBottom=120;
  expect(printPageCSS(custom)).toContain('padding-bottom: 120px');
  expect(pageFooterLayout(custom.appearance.pageNumber).bottomTwips).toBeGreaterThan(1984);
 });
 it('署名从正文移出后，Markdown、DOCX与EPUB都保留新字段',async()=>{
  expect(articleMarkdown(article)).toContain(article.signature);expect(articleMarkdown(article)).toContain(article.signedDate);
  const docx=await JSZip.loadAsync(await bytes(await buildDocx(article)));
  expect(await docx.file('word/document.xml')!.async('string')).toContain(article.signature);
  expect(await docx.file('word/document.xml')!.async('string')).toContain(article.signedDate);
  const epub=await JSZip.loadAsync(await bytes(await buildEpub(article)));
  expect(await epub.file('OEBPS/article.xhtml')!.async('string')).toContain(article.signature);
  expect(await epub.file('OEBPS/article.xhtml')!.async('string')).toContain(article.signedDate);
 });
});
