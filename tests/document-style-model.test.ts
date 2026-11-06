import {beforeEach,describe,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {defaults,builtInReadingStyles} from '../src/defaults';
import {captureReadingStyle,saveReadingStyle,setDefaultReadingStyle} from '../src/styles';
import {exportBackup,getArticles,getSettings,importBackup,saveArticle,saveSettings,validateAppearance,validateSettings} from '../src/core/storage';
import type {Article} from '../src/types';

beforeEach(()=>{vi.unstubAllGlobals();vi.stubGlobal('localStorage',new JSDOM('',{url:'https://document-styles.test'}).window.localStorage);});
const article:Article={id:'signature',url:'https://example.com/policy',title:'公文标题',author:'来源网站',published:'2025-06-17',signature:'新华社北京6月26日电',signedDate:'2025年6月17日',excerpt:'',html:'<p>正文。</p>',text:'正文。',savedAt:1,tags:[],category:'',archived:false};

describe('署名、表格与页码样式模型',()=>{
 it('浏览器存储跨realm返回的普通对象仍能校验与保存',async()=>{
  const other=new JSDOM('',{runScripts:'outside-only'});
  try{
   const metadata=other.window.JSON.parse(JSON.stringify(defaults.appearance.metadata));
   expect(Object.getPrototypeOf(metadata)).not.toBe(Object.prototype);
   const settings=validateSettings({appearance:{metadata}});await saveSettings(settings);
   expect((await getSettings()).appearance.metadata).toEqual(defaults.appearance.metadata);
  }finally{other.window.close();}
 });
 it('公文预设保留原编号、使用楷体居中署名及宋体14磅页码',()=>{
  expect(builtInReadingStyles.find(style=>style.id==='policy-document')?.name).toBe('江河公文');
  expect(defaults.appearance.metadata).toMatchObject({fontSize:64/3,fontWeight:400,fontStyle:'normal',color:'#1b1b1b',lineHeight:112/3,textAlign:'center',letterSpacing:-.4,showStats:false});
  expect(defaults.appearance.metadata.fontFamily).toContain('KaiTi');
  expect(defaults.appearance.pageNumber).toMatchObject({enabled:true,fontSize:56/3,align:'right',format:'dash',start:1,firstPage:true,marginBottom:1417/15});
  expect(defaults.appearance.pageNumber.fontFamily).toContain('SimSun');
  expect(defaults.appearance.table).toMatchObject({fontSize:56/3,borderStyle:'solid',borderWidth:1,width:'full',striped:false});
 });
 it('嵌套设置部分字段合并，返回对象及命名快照互不共享',async()=>{
  const settings=validateSettings({appearance:{metadata:{fontSize:24},table:{borderWidth:2,striped:true},pageNumber:{start:8,format:'page-total'}}});
  expect(settings.appearance.metadata.fontFamily).toBe(defaults.appearance.metadata.fontFamily);
  expect(settings.appearance.table.headerBackground).toBe(defaults.appearance.table.headerBackground);
  const saved=saveReadingStyle(settings,'我的表格与署名');await saveSettings(setDefaultReadingStyle(saved,saved.savedStyles[0].id));
  const read=await getSettings();expect(read.appearance.table.borderWidth).toBe(2);expect(read.appearance.pageNumber.start).toBe(8);
  read.appearance.metadata.fontSize=33;read.appearance.table.headerColor='#123456';
  expect(read.savedStyles[0].values.appearance.metadata.fontSize).toBe(24);
  expect((await getSettings()).appearance.table.headerColor).toBe(defaults.appearance.table.headerColor);
 });
 it('0.2设置与已存样式缺少新块时补齐且保留ID、默认引用和旧排版',async()=>{
  const current=saveReadingStyle({...structuredClone(defaults),fontSize:26},'我的旧版大字样式');
  const raw=JSON.parse(JSON.stringify(setDefaultReadingStyle(current,current.savedStyles[0].id)));
  for(const key of ['metadata','table','pageNumber']){delete raw.appearance[key];delete raw.savedStyles[0].values.appearance[key];}
  localStorage.setItem('circle.replica.settings',JSON.stringify(raw));
  const upgraded=await getSettings();expect(upgraded.defaultStyleId).toBe(raw.defaultStyleId);expect(upgraded.fontSize).toBe(26);expect(upgraded.savedStyles[0].id).toBe(raw.savedStyles[0].id);expect(upgraded.savedStyles[0].values.appearance.metadata).toEqual(defaults.appearance.metadata);
  await saveSettings(upgraded);expect((await getSettings()).appearance.pageNumber).toEqual(defaults.appearance.pageNumber);
 });
 it('嵌套块拒绝未知字段、异常类型、非法范围、字体注入和枚举',()=>{
  const invalid=[
   {metadata:null},{table:[]},{pageNumber:'yes'},
   {metadata:{madeUp:true}},{metadata:{fontFamily:'Arial;}body{display:none'}},{metadata:{fontWeight:400.5}},{metadata:{fontSize:7}},{metadata:{lineHeight:Infinity}},{metadata:{letterSpacing:-11}},{metadata:{color:'red;display:none'}},{metadata:{showStats:'false'}},{metadata:{textAlign:'justify'}},
   {table:{headerFontFamily:'<script>'}},{table:{borderWidth:-1}},{table:{cellPaddingY:81}},{table:{striped:1}},{table:{cellVerticalAlign:'right'}},{table:{borderStyle:'double'}},{table:{headerBackground:'url(https://evil.test)'}},{table:{width:'100%'}},
   {pageNumber:{enabled:'true'}},{pageNumber:{start:0}},{pageNumber:{start:1.5}},{pageNumber:{start:100000}},{pageNumber:{marginBottom:-1}},{pageNumber:{fontSize:NaN}},{pageNumber:{format:'script'}},{pageNumber:{firstPage:null}},
  ];
  for(const value of invalid)expect(()=>validateAppearance(value)).toThrow();
 });
 it('样式快照仍要求既有排版字段，新块可部分兼容补齐',()=>{
  const saved=saveReadingStyle(structuredClone(defaults),'不完整旧字段');
  const raw=JSON.parse(JSON.stringify(saved));delete raw.savedStyles[0].values.appearance.titleFont;
  expect(()=>validateSettings(raw)).toThrow('不完整');
  const partial=JSON.parse(JSON.stringify(saved));partial.savedStyles[0].values.appearance.table={fontSize:22};
  expect(validateSettings(partial).savedStyles[0].values.appearance.table).toMatchObject({fontSize:22,borderWidth:1});
  expect(captureReadingStyle(defaults).appearance).not.toHaveProperty('toolbarX');
 });
 it('完整备份往返保存新块、署名及成文日期，非法块导入前后数据不变',async()=>{
  const changed=structuredClone(defaults);changed.appearance.metadata.fontSize=24;changed.appearance.table.striped=true;changed.appearance.pageNumber.format='page-total';await saveSettings(changed);await saveArticle(article);
  const backup=await exportBackup();localStorage.clear();await importBackup(backup);
  expect((await getArticles())[0]).toMatchObject({signature:article.signature,signedDate:article.signedDate});expect((await getSettings()).appearance).toEqual(changed.appearance);
  const before=localStorage.getItem('circle.replica.settings');
  await expect(importBackup({...backup,settings:{...backup.settings,appearance:{...backup.settings.appearance,table:{...backup.settings.appearance.table,headerColor:'javascript:bad'}}}})).rejects.toThrow();
  expect(localStorage.getItem('circle.replica.settings')).toBe(before);expect((await getArticles())[0].signature).toBe(article.signature);
 });
 it('署名字段是有界可选文本，旧文章仍可读，异常备份不会修改本地数据',async()=>{
  await saveArticle(article);const backup=await exportBackup();
  for(const bad of [false,[],{},'x'.repeat(2001)])await expect(importBackup({...backup,articles:[{...article,signature:bad}]})).rejects.toThrow();
  for(const bad of [false,{},'x'.repeat(201)])await expect(importBackup({...backup,articles:[{...article,signedDate:bad}]})).rejects.toThrow();
  expect((await getArticles())[0].signedDate).toBe(article.signedDate);
  const old={...article};delete old.signature;delete old.signedDate;await saveArticle(old);expect((await getArticles())[0]).not.toHaveProperty('signature');
 });
});
