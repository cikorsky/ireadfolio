import { JSDOM } from 'jsdom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { extractArticle, extractSelection, sanitizeHTML, findNextUrl, matchesPattern, appendPage } from '../src/core/parser';
import { getSettings, saveSettings, saveArticle, getArticles, deleteArticle, saveAnnotation, getAnnotations, exportBackup, importBackup } from '../src/core/storage';
function doc(html:string){return new DOMParser().parseFromString(html,'text/html');}
const paragraphs=Array.from({length:7},(_,i)=>`<p>第${i}段。水库安全监测需要结合工程特征设置监测项目，保证数据可追溯，分析与运行管理相互衔接。</p>`).join('');
function article(){return extractArticle(doc(`<title>监测方案</title><meta name="author" content="张三"><nav>首页 广告</nav><article><h1>水库安全监测</h1>${paragraphs}<img data-src="/test.png"><table><tr><td>水位</td><td>42</td></tr></table><pre><code>const a = 1;</code></pre></article><a rel="next" href="/page2">下一页</a>`),'https://example.com/page1');}
beforeEach(()=>{vi.stubGlobal('localStorage',new JSDOM('',{url:'https://test.local'}).window.localStorage);localStorage.clear();});
describe('正文解析',()=>{
 it('提取标题作者正文、表格代码和懒加载图片，不修改原页面',()=>{const original=doc(`<title>文章</title><article><h1>水库安全监测</h1>${paragraphs}<img data-src="/photo.jpg"><table><tr><td>项目</td></tr></table><pre>代码内容</pre></article>`);const before=original.documentElement.outerHTML;const a=extractArticle(original,'https://example.com/news/1');expect(a.title).toBe('水库安全监测');expect(a.html).toContain('https://example.com/photo.jpg');expect(a.html).toContain('<table');expect(a.html).toContain('<pre');expect(original.documentElement.outerHTML).toBe(before);});
 it('解析元信息和下一页',()=>{const a=article();expect(a.author).toBe('张三');expect(a.nextUrl).toBe('https://example.com/page2');expect(a.text).not.toContain('首页 广告');});
 it('支持站点选择器与手动选择',()=>{const d=doc('<title>标题</title><div id="body"><p>手动正文</p><p class="ad">广告</p></div>');const rule={id:'1',pattern:'example.com',title:'title',content:'#body',remove:'.ad',next:''};const a=extractArticle(d,'https://example.com',rule);expect(a.text).toBe('手动正文');expect(extractSelection(d.querySelector('#body')!,'https://example.com').text).toContain('手动正文');expect(()=>extractArticle(d,'https://example.com',{...rule,content:'['})).toThrow('选择器');});
 it('失败时明确提供手动路径',()=>{expect(()=>extractArticle(doc('<body>登录</body>'),'https://example.com')).toThrow('手动选择');});
 it('清理脚本、事件和危险链接并保留公式',()=>{const html=sanitizeHTML('<img src=x onerror=alert(1)><script>alert(1)</script><a href="javascript:alert(1)">链接</a><math><mi>x</mi></math>');expect(html).not.toMatch(/onerror|javascript:|<script/);expect(html).toContain('<math>');});
 it('下一页去重与无效链接过滤',()=>{expect(findNextUrl(doc('<a rel="next" href="#part">下一页</a>'),'https://a.com/x')).toBeUndefined();expect(findNextUrl(doc('<a href="javascript:void(0)">下一页</a>'),'https://a.com/x')).toBeUndefined();expect(findNextUrl(doc('<a href="/2">Next page</a>'),'https://a.com/1')).toBe('https://a.com/2');expect(()=>appendPage(article(),article())).toThrow('重复');});
 it('域名、通配符和正则匹配不会匹配恶意后缀域名',()=>{expect(matchesPattern('https://sub.a.com/1','a.com')).toBe(true);expect(matchesPattern('https://a.com.evil/1','a.com')).toBe(false);expect(matchesPattern('https://a.com/1','https://a.com/*')).toBe(true);expect(matchesPattern('https://a.com/1','[a\\.com/1]')).toBe(true);expect(matchesPattern('https://a.com','[[]')).toBe(false);});
});
describe('本地存储和备份',()=>{
 it('设置隔离并拒绝非法数值',async()=>{const s=await getSettings();s.fontSize=24;await saveSettings(s);expect((await getSettings()).fontSize).toBe(24);s.columns=1.5;await expect(saveSettings(s)).rejects.toThrow('范围');expect((await getSettings()).columns).toBe(1);});
 it('存储多文章，支持回收站、恢复和永久删除关联批注',async()=>{const a=article();await saveArticle(a);await saveAnnotation({id:'note1',articleId:a.id,quote:'水库',prefix:'',suffix:'',note:'检查',color:'#fff000',createdAt:Date.now()});await deleteArticle(a.id);expect((await getArticles())[0].deletedAt).toBeTypeOf('number');await saveArticle({...a,deletedAt:undefined});expect((await getArticles())[0].deletedAt).toBeUndefined();expect(await getAnnotations(a.id)).toHaveLength(1);await deleteArticle(a.id,true);expect(await getArticles()).toHaveLength(0);expect(await getAnnotations()).toHaveLength(0);});
 it('备份往返并在非法条目时保持原数据',async()=>{await saveArticle(article());const backup=await exportBackup();localStorage.clear();await importBackup(backup);expect(await getArticles()).toHaveLength(1);const before=localStorage.getItem('circle.replica.settings');await expect(importBackup({...backup,articles:[...backup.articles,{bad:true}]})).rejects.toThrow();expect(await getArticles()).toHaveLength(1);expect(localStorage.getItem('circle.replica.settings')).toBe(before);});
 it('导入内容清理XSS，合并保留新内容，替换只移除命名空间数据',async()=>{await saveArticle(article());const backup=await exportBackup();backup.articles[0].html+='<img onerror="alert(1)" src="x">';localStorage.setItem('other-app','preserve');await importBackup(backup,'replace');expect((await getArticles())[0].html).not.toContain('onerror');const original=backup.articles[0];await saveArticle({...original,title:'新版',savedAt:original.savedAt+1000});await importBackup(backup,'merge');expect((await getArticles())[0].title).toBe('新版');await importBackup({...backup,articles:[],annotations:[]},'replace');expect(await getArticles()).toHaveLength(0);expect(localStorage.getItem('other-app')).toBe('preserve');});
});

describe('回收站清理与重复采集保护',()=>{
 it('满30天清理回收站文章及关联批注，保留未满期、正常文章和其他数据',async()=>{
  const now=new Date('2026-11-03T10:00:00Z').getTime();vi.useFakeTimers();vi.setSystemTime(now);
  try{
   const a=article();const retention=30*24*60*60*1000;
   await saveArticle({...a,id:'expired',deletedAt:now-retention});await saveArticle({...a,id:'recent',deletedAt:now-retention+1});await saveArticle({...a,id:'live'});
   for(const id of ['expired','recent','live'])await saveAnnotation({id:`note-${id}`,articleId:id,quote:'水库',prefix:'',suffix:'',note:'保留',color:'#fff000',createdAt:now});
   localStorage.setItem('other-app','preserve');
   expect((await getArticles()).map(a=>a.id).sort()).toEqual(['live','recent']);expect((await getAnnotations()).map(a=>a.articleId).sort()).toEqual(['live','recent']);expect(localStorage.getItem('circle.replica.article.expired')).toBeNull();expect(localStorage.getItem('other-app')).toBe('preserve');
  }finally{vi.useRealTimers();}
 });
 it('重新采集同URL保留分类、标签和归档，显式编辑仍可清空',async()=>{
  const {saveCapturedArticle}=await import('../src/core/storage');const a=article();
  await saveArticle({...a,tags:['工程'],category:'技术资料',archived:true});
  await saveCapturedArticle({...a,title:'更新正文',tags:[],category:'',archived:false,savedAt:a.savedAt+100});
  const updated=(await getArticles())[0];expect(updated).toMatchObject({title:'更新正文',tags:['工程'],category:'技术资料',archived:true});
  await saveArticle({...updated,tags:[],category:'',archived:false});expect((await getArticles())[0]).toMatchObject({tags:[],category:'',archived:false});
 });
 it('相同标题不同URL不会合并',async()=>{
  const {saveCapturedArticle}=await import('../src/core/storage');const a=article();await saveCapturedArticle(a);await saveCapturedArticle({...a,id:'another',url:'https://example.com/other'});expect(await getArticles()).toHaveLength(2);
 });
 it('明确拒绝原版存储快照，拒绝前后本地数据不变',async()=>{
  await saveArticle(article());const before=await exportBackup();await expect(importBackup({option_plugins:{id:'plugins',speak:true},option_user:{id:'user',value:'opaque'}})).rejects.toThrow('备份格式不兼容');expect((await exportBackup()).articles).toEqual(before.articles);
 });
 it('追加页通过内容指纹/正文识别异URL重复页和连续第三页重复',()=>{
  const a=article();const b={...a,id:'b',url:'https://example.com/page2',html:'<p>这是第二页新增正文，包含全新的监测数据与分析。</p>',text:'这是第二页新增正文，包含全新的监测数据与分析。'};
  const combined=appendPage(a,b);expect(combined.html).toContain('data-page-fingerprint');expect(()=>appendPage(combined,{...b,url:'https://example.com/page3',text:'这是第二页新增正文， 包含全新的监测数据与分析。'})).toThrow('重复');
 });
});

describe('细分外观设置校验与兼容',()=>{
 it('默认标题字号和粗细按用户公文模板初始化',async()=>{
  const appearance=(await getSettings()).appearance;
  expect(appearance.headingSizes).toEqual([1,1,1,1,1,1]);expect(appearance.headingWeights).toEqual([400,400,400,400,400,400]);expect(appearance.toolbarItemGap).toBe(10);expect(appearance.toolbarGroupGap).toBe(10);expect(appearance.codeSize).toBe(20);
 });
 it('旧复刻版备份缺少appearance时补齐默认值，部分appearance也可合并',async()=>{
  const backup=await exportBackup();const prior:Record<string,unknown>={...backup.settings};delete prior.appearance;
  await importBackup({...backup,settings:prior});expect((await getSettings()).appearance.headingSizes).toEqual([1,1,1,1,1,1]);
  await importBackup({...backup,settings:{...backup.settings,appearance:{fontWeight:700,textAlign:'justify'}}});expect((await getSettings()).appearance).toMatchObject({fontWeight:700,textAlign:'justify',codeLineHeight:1.8});
 });
 it('导入拒绝外观异常类型、数组长度、非法对齐、数值及CSS注入，原设置不变',async()=>{
  const backup=await exportBackup();const invalid=[null,[],{fontWeight:'700'},{fontWeight:9000},{letterSpacing:-11},{hideImages:'false'},{toolbarAutoHide:1},{headingSizes:[1,2]},{headingSizes:[1,1,1,1,1,Infinity]},{headingWeights:[100,100,100,100,100,'700']},{headingColors:['#fff','#fff','#fff','#fff','#fff','red; color:black']},{textAlign:'invalid'},{imageAlign:[]},{codeFont:'monospace;} body {display:none'},{backgroundImage:'javascript:alert(1)'},{backgroundImage:'https://a.test/x");}body{color:red}'},{selectionColor:'url(https://evil.test)'},{madeUpField:true}];
  for(const appearance of invalid)await expect(importBackup({...backup,settings:{...backup.settings,appearance}})).rejects.toThrow();
  expect((await getSettings()).appearance).toEqual(backup.settings.appearance);
 });
 it('合法外观设置和背景图片能够往返备份，返回数组独立',async()=>{
  const settings=await getSettings();settings.appearance={...settings.appearance,headingColors:['#123456','#234567','#345678','#456789','#567890','#678901'],headingSizes:[1.2,.7,1.2,.7,.7,.7],headingWeights:[400,700,400,700,700,700],fontWeight:700,letterSpacing:2,textIndent:2,textAlign:'justify',imageAlign:'center',hideImages:true,codeFont:'Consolas, monospace',backgroundImage:'data:image/png;base64,iVBORw0KGgo=',toolbarAutoHide:true};
  await saveSettings(settings);const backup=await exportBackup();localStorage.clear();await importBackup(backup);const restored=await getSettings();expect(restored.appearance).toEqual(settings.appearance);restored.appearance.headingSizes[0]=5;expect((await getSettings()).appearance.headingSizes[0]).toBe(1.2);
 });
});
