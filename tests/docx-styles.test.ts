import {describe,it,expect,vi} from 'vitest';
import JSZip from 'jszip';
import {buildDocx} from '../src/export/word';
import {defaults} from '../src/defaults';
import * as wordImages from '../src/export/word-images';
import type {Article,Settings} from '../src/types';

const article:Article={id:'styles',url:'https://example.org/policy',title:'江河保护治理意见',author:'中共中央办公厅 国务院办公厅',published:'2025-06-12',excerpt:'',html:'<h1><strong>一、总体要求</strong></h1><h2>（一）工作目标</h2><p>正文<strong>重点</strong>文字</p><table><tr><th>项目</th><th>目标</th></tr><tr><td colspan="2">水资源保护</td></tr></table>',text:'正文',savedAt:0,tags:[],category:'',archived:false};
async function unpack(settings?:Settings,value:Article=article){
 const blob=await buildDocx(value,settings);
 const bytes=await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(blob)});
 const zip=await JSZip.loadAsync(bytes);
 const xml=async(path:string)=>new DOMParser().parseFromString(await zip.file(path)!.async('string'),'application/xml');
 return {zip,doc:await xml('word/document.xml'),styles:await xml('word/styles.xml'),xml};
}
const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function el(root:ParentNode,tag:string){return [...root.querySelectorAll('*')].find(node=>node.localName===tag)}
function attr(root:ParentNode,tag:string,name='val'){return el(root,tag)?.getAttributeNS(ns,name)}
function paragraph(doc:Document,text:string){return [...doc.getElementsByTagNameNS(ns,'p')].find(p=>p.textContent?.includes(text))!}
function style(doc:Document,id:string){return [...doc.getElementsByTagNameNS(ns,'style')].find(p=>p.getAttributeNS(ns,'styleId')===id)!}

describe('DOCX reading style preservation',()=>{
 it('writes the policy title, body and heading settings instead of Office theme defaults',async()=>{
  const {doc,styles}=await unpack();
  expect(attr(style(styles,'Title'),'sz')).toBe('44');
  expect(attr(style(styles,'Normal'),'sz')).toBe('32');
  expect(attr(style(styles,'Normal'),'spacing','line')).toBe('560');
  expect(attr(style(styles,'Normal'),'spacing','lineRule')).toBe('exact');
  expect(attr(paragraph(doc,'江河保护治理意见'),'pStyle')).toBe('Title');
  const heading=paragraph(doc,'一、总体要求');
  expect(attr(heading,'pStyle')).toBe('Heading1');
  expect(attr(heading,'sz')).toBe('32');
  expect(attr(heading,'color')).toBe('1b1b1b');
  expect(attr(heading,'b')).toBe('false');
  expect(attr(heading,'rFonts','eastAsia')).toBe('SimHei');
  for(let level=1;level<=6;level++){expect(attr(style(styles,`Heading${level}`),'sz')).toBe('32');expect(attr(style(styles,`Heading${level}`),'color')).toBe('1b1b1b');}
  expect(attr(paragraph(doc,'正文重点文字'),'ind','firstLine')).toBe('640');
  expect(attr(paragraph(doc,'中共中央办公厅'),'pStyle')).toBe('Signature');
  expect(doc.documentElement.textContent?.indexOf('来源：')).toBeGreaterThan(doc.documentElement.textContent!.indexOf('水资源保护'));
 });
 it('matches the retained template footer distance instead of placing page numbers at the paper edge',async()=>{
  const {doc,zip,xml}=await unpack();
  const margins=el(doc,'pgMar')!;
  // Values read from the reference document's sectPr/pgMar: 25mm and 35mm.
  expect(margins.getAttributeNS(ns,'footer')).toBe('1417');
  expect(margins.getAttributeNS(ns,'bottom')).toBe('1984');
  const numbered=await xml(Object.keys(zip.files).find(path=>/^word\/footer\d+\.xml$/.test(path))!);
  expect(numbered.documentElement.textContent).toContain('PAGE');
  expect(attr(numbered,'sz')).toBe('28');
 });
 it('honors custom footer distances above the previous cap and reserves space for larger page-number text',async()=>{
  const settings=structuredClone(defaults);settings.appearance.pageNumber.marginBottom=120;settings.appearance.pageNumber.fontSize=64;
  const {doc}=await unpack(settings);const margins=el(doc,'pgMar')!;
  expect(margins.getAttributeNS(ns,'footer')).toBe('1800');
  expect(Number(margins.getAttributeNS(ns,'bottom'))).toBeGreaterThanOrEqual(1800+64*15);
  settings.appearance.pageNumber.marginBottom=0;
  const zero=await unpack(settings);expect(el(zero.doc,'pgMar')!.getAttributeNS(ns,'footer')).toBe('0');
 });
 it('maps custom fonts, units, table settings and native page fields',async()=>{
  const settings=structuredClone(defaults);settings.fontSize=24;settings.fontFamily='"Custom Body", serif';settings.lineHeight=2;settings.appearance.lineHeightMode='multiple';settings.appearance.titleSize=40;settings.appearance.titleColor='#123456';
  Object.assign(settings.appearance.table,{headerBackground:'#abc123',cellPaddingX:12,borderWidth:2,borderStyle:'dashed',striped:true,stripeColor:'#efefef'});
  Object.assign(settings.appearance.pageNumber,{format:'page-total',start:3,firstPage:false,fontSize:20});
  const {doc,styles,zip,xml}=await unpack(settings);
  expect(attr(style(styles,'Normal'),'sz')).toBe('36');expect(attr(style(styles,'Normal'),'rFonts','eastAsia')).toBe('Custom Body');
  expect(attr(style(styles,'Normal'),'spacing','line')).toBe('480');expect(attr(style(styles,'Normal'),'spacing','lineRule')).toBe('auto');
  expect(attr(style(styles,'Title'),'sz')).toBe('60');expect(attr(style(styles,'Title'),'color')).toBe('123456');
  const table=el(doc,'tbl')!;expect(attr(table,'shd','fill')).toBe('abc123');expect(attr(el(table,'tcMar')!,'left','w')).toBe('180');expect(attr(table,'top','sz')).toBe('12');expect(attr(table,'top')).toBe('dashed');
  expect(attr(table,'gridSpan')).toBe('2');expect(attr(paragraph(doc,'水资源保护'),'ind','firstLine')).toBe('0');
  expect(attr(doc,'pgNumType','start')).toBe('3');expect(el(doc,'titlePg')).toBeTruthy();
  const footers=await Promise.all(Object.keys(zip.files).filter(path=>/^word\/footer\d+\.xml$/.test(path)).map(xml));
  const numbered=footers.find(f=>f.documentElement.textContent?.includes('NUMPAGES'))!;
  expect(numbered.documentElement.textContent).toContain('PAGE');expect(attr(numbered,'sz')).toBe('30');expect(footers.some(f=>!f.documentElement.textContent?.includes('PAGE'))).toBe(true);
  expect(attr(style(styles,'TableHeader'),'sz')).toBe('28');expect(attr(style(styles,'TableBody'),'rFonts','eastAsia')).toBe('FangSong_GB2312');
 });
 it('resolves a CSS font stack against the browser system font list',async()=>{
  vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage:async()=>({ok:true,fonts:[{fontId:'FangSong',displayName:'仿宋'},{fontId:'KaiTi',displayName:'楷体'}]})}});
  try {const {styles}=await unpack();expect(attr(style(styles,'Normal'),'rFonts','eastAsia')).toBe('FangSong');expect(attr(style(styles,'Signature'),'rFonts','eastAsia')).toBe('KaiTi');}finally{vi.unstubAllGlobals()}
 });
 it('omits native footers when page numbers are disabled',async()=>{
  const settings=structuredClone(defaults);settings.appearance.pageNumber.enabled=false;
  const {zip}=await unpack(settings);expect(Object.keys(zip.files).filter(path=>/^word\/footer\d+\.xml$/.test(path))).toHaveLength(0);
 });
 it('keeps merged cells, image height and dash page fields without Office defaults',async()=>{
  const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
  const value={...article,html:`<p><img src="${png}" width="100" height="100"></p><table><tr><td rowspan="2">合并单元格</td><td>首行</td></tr><tr><td>次行</td></tr></table>`};
  const {doc,zip,xml}=await unpack(undefined,value);
  const imageParagraph=[...doc.getElementsByTagNameNS(ns,'p')].find(p=>el(p,'drawing'))!;
  expect(attr(imageParagraph,'spacing','lineRule')).toBe('atLeast');
  expect([...doc.getElementsByTagNameNS(ns,'vMerge')].map(node=>node.getAttributeNS(ns,'val'))).toEqual(['restart','continue']);
  const path=Object.keys(zip.files).find(path=>/^word\/footer\d+\.xml$/.test(path))!;
  const foot=await xml(path);expect(foot.documentElement.textContent).toContain('— ');expect(foot.documentElement.textContent).toContain('PAGE');expect(foot.documentElement.textContent).not.toContain('NUMPAGES');
  const hidden=structuredClone(defaults);hidden.appearance.hideImages=true;
  const result=await unpack(hidden,value);expect(Object.keys(result.zip.files).filter(path=>path.startsWith('word/media/')&&!path.endsWith('/'))).toHaveLength(0);
 });
 it.each([1,2])('fits linked images to the actual %i-column content width and keeps them visible',async(columns)=>{
  const image=vi.spyOn(wordImages,'prepareWordImage').mockResolvedValue({bytes:new Uint8Array([137,80,78,71]),type:'png',width:2000,height:1000});
  try{
   const settings=structuredClone(defaults);settings.width=500;settings.pagePadding=100;settings.columns=columns;settings.appearance.imageAlign='center';
   const {doc}=await unpack(settings,{...article,html:'<p><a href="https://example.org/image"><img src="https://example.org/image.png"></a></p>'});
   const extent=el(doc,'extent')!;
   const width=Number(extent.getAttribute('cx'))/9525;
   const height=Number(extent.getAttribute('cy'))/9525;
   expect(width).toBeLessThanOrEqual((300-(columns-1)*24)/columns);
   expect(width/height).toBeCloseTo(2,1);
   const p=[...doc.getElementsByTagNameNS(ns,'p')].find(p=>el(p,'drawing'))!;
   expect(attr(p,'spacing','lineRule')).toBe('atLeast');expect(attr(p,'jc')).toBe('center');expect(attr(p,'ind','firstLine')).toBe('0');
  }finally{image.mockRestore()}
 });
 it('starts table stripes at each tbody second row independently of the header',async()=>{
  const settings=structuredClone(defaults);settings.appearance.table.striped=true;settings.appearance.table.stripeColor='#abcdef';
  const {doc}=await unpack(settings,{...article,html:'<table><thead><tr><th>表头</th></tr></thead><tbody><tr><td>第一行</td></tr><tr><td>第二行</td></tr></tbody><tbody><tr><td>下一组第一行</td></tr><tr><td>下一组第二行</td></tr></tbody></table>'});
  const cells=[...doc.getElementsByTagNameNS(ns,'tc')];
  expect(cells.map(cell=>attr(cell,'shd','fill'))).toEqual(['f3f3f3',undefined,'abcdef',undefined,'abcdef']);
 });
 it('bounds untrusted table spans and the total grid before passing them to docx',async()=>{
  const {doc}=await unpack(undefined,{...article,html:'<table><tr><td colspan="1000000000" rowspan="1000000000">极值</td></tr><tr><td>续行</td></tr></table><table><tr><td colspan="Infinity" rowspan="-5">无效</td><td colspan="1.5">小数</td></tr></table>'});
  const spans=[...doc.getElementsByTagNameNS(ns,'gridSpan')].map(node=>Number(node.getAttributeNS(ns,'val')));
  expect(spans.every(value=>Number.isInteger(value)&&value>=1&&value<=100)).toBe(true);
  const tables=[...doc.getElementsByTagNameNS(ns,'tbl')];
  expect(tables.every(table=>table.getElementsByTagNameNS(ns,'gridCol').length<=100)).toBe(true);
  expect(doc.getElementsByTagNameNS(ns,'vMerge')).toHaveLength(2);
 });
});
