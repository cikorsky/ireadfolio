import {chromiumExecutable,createBrowserProfile} from './browser-runtime.mjs';
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {fixturePNG} from './fixture-image.mjs';
const out=process.env.TOOLBAR_E2E_OUT||'evidence/toolbar',records=[],errors=[];
await fs.mkdir(out,{recursive:true});
const profile=await createBrowserProfile('ireadfolio-toolbar-');
const server=http.createServer(async(req,res)=>{if(req.url==='/pixel.png'){res.setHeader('Content-Type','image/png');res.end(fixturePNG);return;}res.setHeader('Content-Type','text/html;charset=utf-8');res.end(await fs.readFile('tests/fixtures/article.html'));});
server.on('error',error=>{throw error;});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const step=async(name,fn)=>{await fn();records.push({name,status:'passed'});console.log('PASS',name);};
let c;
try{
 await step('Chrome与Firefox具有完整彩色图标与正确尺寸',async()=>{for(const browser of ['chrome','firefox']){const root=`dist/${browser}`,m=JSON.parse(await fs.readFile(`${root}/manifest.json`,'utf8'));assert.equal(m.name,JSON.parse(await fs.readFile('package.json','utf8')).displayName||'iReadFolio · i悦读');assert.equal(m.version,JSON.parse(await fs.readFile('package.json','utf8')).version);for(const size of [16,32,48,128]){const png=await fs.readFile(`${root}/${m.icons[size]}`);assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);}assert(m.action.default_icon[16]);assert(m.action.default_icon[32]);for(const size of [16,32]){assert.notEqual(m.action.default_icon[size],m.icons[size]);const action=await fs.readFile(`${root}/${m.action.default_icon[size]}`);assert.equal(action.readUInt32BE(16),size);assert.equal(action.readUInt32BE(20),size);assert(!action.equals(await fs.readFile(`${root}/${m.icons[size]}`)));}}});
 c=await chromium.launchPersistentContext(profile,{headless:true,executablePath:chromiumExecutable(),locale:'zh-CN',viewport:{width:1440,height:1000},acceptDownloads:true,args:[`--disable-extensions-except=${path.resolve('dist/chrome')}`,`--load-extension=${path.resolve('dist/chrome')}`]});
 const w=c.serviceWorkers()[0]||await c.waitForEvent('serviceworker'),origin=w.url().split('/').slice(0,3).join('/');
 const options=await c.newPage();options.on('pageerror',e=>errors.push(e.message));await options.goto(origin+'/options.html');await options.getByRole('dialog',{name:'偏好设置',exact:true}).waitFor();await options.getByRole('button',{name:'工具栏',exact:true}).click();
 const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));const base=`http://127.0.0.1:${server.address().port}/article.html`;
 const openReader=async()=>{await page.goto(base);await page.getByRole('button',{name:'进入阅读模式',exact:true}).click();await page.frameLocator('#circle-reader-frame').locator('.circle-paper').waitFor();};
 await openReader();let ui=page.frameLocator('#circle-reader-frame');
 await step('导出设置集中到工具栏且完整说明文件名字段',async()=>{
  await options.getByRole('button',{name:'高级',exact:true}).click();
  assert.equal(await options.getByRole('textbox',{name:'文件名称模板',exact:true}).count(),0);
  await options.getByRole('button',{name:'工具栏',exact:true}).click();
  const section=options.locator('.circle-setting-group').filter({has:options.getByRole('heading',{name:'默认导出格式',exact:true})});
  assert.equal(await section.getByRole('switch').count(),1);
  assert.match(await section.innerText(),/\[title\]/);assert.match(await section.innerText(),/\[node:title\]/);assert.match(await section.innerText(),/\[date\]/);
  for(const label of ['导出时内嵌图片','编辑内容','移除内容块','隐藏 / 显示图片'])await options.getByRole('checkbox',{name:'显示 '+label,exact:true}).check();
 });
 const tool=name=>ui.locator('.circle-toolbar').getByRole('button',{name,exact:true});
 const pressed=async(name,value)=>{await ui.locator('.circle-toolbar').getByRole('button',{name,exact:true,pressed:value}).waitFor();await page.frames().find(f=>f.url().startsWith(origin+'/reader.html')).waitForFunction(({name,value})=>{const el=[...document.querySelectorAll('.circle-toolbar button')].find(b=>b.getAttribute('aria-label')===name);return !!el&&(getComputedStyle(el).backgroundColor==='rgb(66, 108, 219)')===value;},{name,value});};
 await step('工具栏内嵌图片按钮切换状态、与设置双向同步且控制真实下载',async()=>{
  await tool('导出时内嵌图片').waitFor();await pressed('导出时内嵌图片',true);
  await tool('导出时内嵌图片').click();await pressed('导出时内嵌图片',false);
  await options.waitForFunction(()=>!document.querySelector('[data-setting-label="导出时内嵌图片"] input[role="switch"]').checked);
  await options.getByRole('combobox',{name:'默认导出格式',exact:true}).selectOption('markdown');
  await options.getByRole('textbox',{name:'文件名称模板',exact:true}).fill('[date]-[node:title]-[title]');
  await options.getByRole('textbox',{name:'文件名称模板',exact:true}).blur();
  let download;[download]=await Promise.all([page.waitForEvent('download'),tool('导出 Markdown').click()]);
  assert(download.suggestedFilename().startsWith(new Date().toISOString().slice(0,10)+'-水库安全监测的日常工作-水库安全监测的日常工作'));
  await download.saveAs(`${out}/images-linked.md`);assert.match(await fs.readFile(`${out}/images-linked.md`,'utf8'),/!\[.*\]\(http:\/\/127\.0\.0\.1:/);
  await options.getByRole('switch',{name:'导出时内嵌图片',exact:true}).check();await pressed('导出时内嵌图片',true);
  [download]=await Promise.all([page.waitForEvent('download'),tool('导出 Markdown').click()]);await download.saveAs(`${out}/images-embedded.md`);
  assert.match(await fs.readFile(`${out}/images-embedded.md`,'utf8'),/!\[.*\]\(data:image\/png;base64,/);
  await options.reload();await options.getByRole('button',{name:'工具栏',exact:true}).click();
  assert.equal(await options.getByRole('switch',{name:'导出时内嵌图片',exact:true}).isChecked(),true);assert.equal(await options.getByRole('checkbox',{name:'显示 导出时内嵌图片',exact:true}).isChecked(),true);
  await options.getByRole('textbox',{name:'文件名称模板',exact:true}).fill('[title]');await options.getByRole('textbox',{name:'文件名称模板',exact:true}).blur();
  await options.getByRole('combobox',{name:'默认导出格式',exact:true}).selectOption('docx');
 });
 await step('持续操作启用时蓝底、关闭后恢复且暴露正确按压状态',async()=>{
  for(const [off,on] of [['文章大纲','文章大纲'],['自动滚动','停止滚动'],['编辑内容','完成编辑'],['移除内容块','完成移除'],['隐藏 / 显示图片','隐藏 / 显示图片']]){
   await pressed(off,false);await tool(off).click();await pressed(on,true);await tool(on).click();await pressed(off,false);
  }
  await tool('偏好设置').click();await pressed('偏好设置',true);await ui.getByRole('button',{name:'关闭偏好设置',exact:true}).click();await pressed('偏好设置',false);
  await tool('查找内容').click();await pressed('查找内容',true);await ui.getByRole('button',{name:'关闭查找',exact:true}).click();await pressed('查找内容',false);
  await tool('批注').click();await pressed('批注',true);await ui.locator('.circle-notes header button').click();await pressed('批注',false);
  await tool('全屏查看').click();await pressed('全屏查看',true);await tool('全屏查看').click();await pressed('全屏查看',false);
  await page.screenshot({path:`${out}/toolbar-states.png`,animations:'disabled'});
 });
 await step('导出提示位于按钮侧边且工具栏移到左边时自动换侧',async()=>{
  const direct=tool('导出 Word DOCX');assert.equal(await direct.getAttribute('title'),null);
  await direct.hover();let tip=ui.getByRole('tooltip',{name:'直接导出 Word DOCX',exact:true});await tip.waitFor();
  const box=await direct.boundingBox(),popup=await tip.boundingBox();assert(popup.x+popup.width<=box.x+2,'左侧提示不得覆盖按钮');
  await page.screenshot({path:`${out}/tooltip-left.png`,animations:'disabled'});
  await page.mouse.move(200,20);
  const drag=tool('拖动工具栏'),before=await drag.boundingBox();await page.mouse.move(before.x+18,before.y+18);await page.mouse.down();await page.mouse.move(40,32,{steps:10});await page.mouse.up();
  await direct.hover();tip=ui.getByRole('tooltip',{name:'直接导出 Word DOCX',exact:true});await tip.waitFor();
  const moved=await direct.boundingBox(),right=await tip.boundingBox();assert(right.x>=moved.x+moved.width-2,'左缘工具栏的提示应出现在右侧');
  await page.screenshot({path:`${out}/tooltip-right.png`,animations:'disabled'});
  await drag.focus();await page.keyboard.press('Home');await page.mouse.move(200,20);
 });
 await step('导出格式与更多菜单展开时按钮保持蓝色且收起后恢复',async()=>{
  for(const name of ['选择导出格式','更多工具']){
   await tool(name).click();assert.equal(await tool(name).getAttribute('aria-expanded'),'true');assert.match(await tool(name).getAttribute('class'),/circle-tool-active/);
   await tool(name).click();assert.equal(await tool(name).getAttribute('aria-expanded'),'false');assert(!/circle-tool-active/.test(await tool(name).getAttribute('class')));await ui.getByRole('menu').waitFor({state:'hidden'});
  }
  // Reset optional buttons for the existing visibility and more-menu regression journey.
  for(const label of ['导出时内嵌图片','编辑内容','移除内容块','隐藏 / 显示图片'])await options.getByRole('checkbox',{name:'显示 '+label,exact:true}).uncheck();
 });
 await step('直接点击默认导出按钮下载DOCX而无需打开菜单',async()=>{const [d]=await Promise.all([page.waitForEvent('download'),ui.getByRole('button',{name:'导出 Word DOCX',exact:true}).click()]);assert(d.suggestedFilename().endsWith('.docx'));await d.saveAs(`${out}/default.docx`);assert((await fs.stat(`${out}/default.docx`)).size>1000);});
 await step('全部导出和更多菜单选项配有图标',async()=>{await ui.getByRole('button',{name:'选择导出格式',exact:true}).click();const items=ui.getByRole('menuitem');assert.equal(await items.count(),9);for(const item of await items.all())assert(await item.locator('svg').count()>0,await item.innerText());await page.screenshot({animations:'disabled',path:`${out}/export-menu.png`});await ui.getByRole('button',{name:'选择导出格式',exact:true}).click();await ui.getByRole('menuitem',{name:'纯文本',exact:true}).waitFor({state:'hidden'});await ui.getByRole('button',{name:'更多工具',exact:true}).click();for(const item of await ui.getByRole('menuitem').all())assert(await item.locator('svg').count()>0,await item.innerText());await page.screenshot({animations:'disabled',path:`${out}/more-menu.png`});await ui.getByRole('button',{name:'更多工具',exact:true}).click();await ui.getByRole('menu').waitFor({state:'hidden'});});
 await step('默认格式即时修改持久化且临时菜单选择不覆盖默认值',async()=>{
  await options.getByRole('combobox',{name:'默认导出格式',exact:true}).selectOption('markdown');await ui.getByRole('button',{name:'导出 Markdown',exact:true}).waitFor();
  const [d]=await Promise.all([page.waitForEvent('download'),ui.getByRole('button',{name:'导出 Markdown',exact:true}).click()]);assert(d.suggestedFilename().endsWith('.md'));await d.saveAs(`${out}/default.md`);
  await ui.getByRole('button',{name:'选择导出格式',exact:true}).click();const [temporary]=await Promise.all([page.waitForEvent('download'),ui.getByRole('menuitem',{name:'Word DOCX',exact:true}).click()]);assert(temporary.suggestedFilename().endsWith('.docx'));
  await options.reload();await options.getByRole('button',{name:'工具栏',exact:true}).click();assert.equal(await options.getByRole('combobox',{name:'默认导出格式',exact:true}).inputValue(),'markdown');
 });
 await step('主工具栏及辅助按钮显隐即时生效且重载保留',async()=>{
  await options.getByRole('checkbox',{name:'显示 打印 / 保存 PDF',exact:true}).uncheck();await ui.getByRole('button',{name:'打印 / 保存 PDF',exact:true}).waitFor({state:'detached'});
  await options.getByRole('checkbox',{name:'显示 编辑内容',exact:true}).check();await ui.getByRole('button',{name:'编辑内容',exact:true}).waitFor();
  for(const name of ['拖动工具栏','更多工具','返回顶部','跳到末尾']){await options.getByRole('checkbox',{name:'显示 '+name,exact:true}).uncheck();await ui.getByRole('button',{name,exact:true}).waitFor({state:'detached'});}
  await options.reload();await options.getByRole('button',{name:'工具栏',exact:true}).click();assert.equal(await options.getByRole('checkbox',{name:'显示 编辑内容',exact:true}).isChecked(),true);assert.equal(await options.getByRole('checkbox',{name:'显示 更多工具',exact:true}).isChecked(),false);await options.screenshot({animations:'disabled',path:`${out}/visibility-settings.png`});
 });
 await step('启用全部按钮均有图标且手机布局无横向溢出',async()=>{
  for(const box of await options.getByRole('checkbox',{name:/^显示 /}).all())await box.check();
  await ui.getByRole('button',{name:'拖动工具栏',exact:true}).waitFor();await ui.getByRole('button',{name:'导出 JPEG 图片',exact:true}).waitFor({state:'attached'});
  const buttons=ui.locator('.circle-toolbar button');assert(await buttons.count()>25);assert(await ui.locator('.circle-toolbar').evaluate(n=>n.scrollHeight>n.clientHeight));for(const b of await buttons.all()){assert(await b.locator('svg').count()>0,await b.getAttribute('aria-label'));assert((await b.boundingBox()).height>=32,'工具栏按钮不应被压缩');}
  await page.setViewportSize({width:390,height:844});const drag=ui.getByRole('button',{name:'拖动工具栏',exact:true});await drag.focus();for(let i=0;i<50;i++)await page.keyboard.press('ArrowRight');const toolbarBox=await ui.locator('.circle-toolbar').boundingBox();assert(toolbarBox.x+toolbarBox.width<=390,'拖动后工具栏应完整位于视口内');assert.equal(await ui.locator('.circle-reader').evaluate(n=>n.scrollWidth>n.clientWidth),false);await page.screenshot({animations:'disabled',path:`${out}/all-tools-mobile.png`});await page.setViewportSize({width:1440,height:1000});
 });
 await step('隐藏全部按钮后仍可用快捷键找回设置',async()=>{
  for(const box of await options.getByRole('checkbox',{name:/^显示 /}).all())await box.uncheck();
  await ui.locator('.circle-toolbar button').last().waitFor({state:'detached'});assert.equal(await ui.locator('.circle-toolbar button').count(),0);
  await ui.locator('.article-title').click();await page.keyboard.press('s');await page.keyboard.press('t');await ui.getByRole('dialog',{name:'偏好设置',exact:true}).waitFor();await ui.getByRole('button',{name:'关闭偏好设置',exact:true}).click();
  await options.getByRole('checkbox',{name:'显示 偏好设置',exact:true}).check();await options.getByRole('checkbox',{name:'显示 默认格式导出',exact:true}).check();await ui.getByRole('button',{name:'偏好设置',exact:true}).waitFor();
 });
 await step('默认格式模块关闭时禁用下载且菜单不提供该格式',async()=>{
  await options.getByRole('combobox',{name:'默认导出格式',exact:true}).selectOption('docx');await options.getByRole('button',{name:/应用市场/}).click();await options.getByRole('switch',{name:'导出为 Word',exact:true}).uncheck();
  const direct=ui.getByRole('button',{name:'导出 Word DOCX',exact:true});await direct.waitFor();await options.getByRole('button',{name:'工具栏',exact:true}).click();await options.getByRole('status').filter({hasText:'当前默认格式对应模块已关闭'}).waitFor();assert.equal(await direct.isDisabled(),true);
  await ui.getByRole('button',{name:'选择导出格式',exact:true}).click();assert.equal(await ui.getByRole('menuitem',{name:'Word DOCX',exact:true}).count(),0);assert.equal(await ui.getByRole('menuitem',{name:'Word DOC',exact:true}).count(),0);await ui.getByRole('button',{name:'选择导出格式',exact:true}).click();
  const stored=await w.evaluate(async()=> (await chrome.storage.local.get('circle.replica.settings'))['circle.replica.settings']);assert.equal(stored.defaultExportFormat,'docx');assert.equal(stored.modules.export_word,false);await page.screenshot({animations:'disabled',path:`${out}/disabled-default.png`});
 });
 assert.deepEqual(errors,[]);
}catch(e){records.push({name:'failure',status:'failed',error:String(e)});console.error(e);process.exitCode=1;}
finally{await fs.writeFile(`${out}/results.json`,JSON.stringify({at:new Date().toISOString(),records,errors},null,2));await c?.close();await fs.rm(profile,{recursive:true,force:true});server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
