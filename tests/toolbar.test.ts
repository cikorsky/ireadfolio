import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {act,createElement,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import {JSDOM} from 'jsdom';
import {defaults} from '../src/defaults';
import {getSettings,saveSettings,validateSettings,exportBackup,importBackup} from '../src/core/storage';
import {captureReadingStyle} from '../src/styles';
import {toolbarActions,toolbarExtras,exportFormats,toolbarActionAllowed,canExport,clampToolbarPosition} from '../src/toolbar';
import {ToolIcon} from '../src/ui/ToolIcon';
import {SettingsPanel} from '../src/ui/Settings';
import type {Settings} from '../src/types';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
beforeEach(()=>{vi.stubGlobal('localStorage',new JSDOM('',{url:'https://toolbar.test'}).window.localStorage);});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('工具栏与默认导出配置',()=>{
 it('按包含分体导出按钮的实际宽高钳制拖动和窗口缩小时的位置',()=>{
  expect(clampToolbarPosition(10000,10000,74,420,390,844)).toEqual({x:316,y:424});
  expect(clampToolbarPosition(316,424,74,360,320,400)).toEqual({x:246,y:40});
  expect(clampToolbarPosition(10,-10,74,200,60,180)).toEqual({x:0,y:0});
  expect(clampToolbarPosition(-10,-10,74,420,390,844)).toEqual({x:0,y:0});
  expect(clampToolbarPosition(-1,-1,74,420,390,844,true)).toEqual({x:-1,y:-1});
 });
 it('旧设置保留原按钮顺序并补入DOCX及原有辅助按钮，不写入阅读样式',()=>{
  const old=structuredClone(defaults) as Partial<Settings>;delete old.defaultExportFormat;delete old.toolbarExtras;old.toolbar=['outline','settings'];
  const s=validateSettings(old);expect(s.toolbar).toEqual(['outline','settings']);expect(s.defaultExportFormat).toBe('docx');expect(s.toolbarExtras).toEqual({drag:true,more:true,top:true,bottom:true});
  expect(captureReadingStyle(s)).not.toHaveProperty('defaultExportFormat');expect(captureReadingStyle(s)).not.toHaveProperty('toolbarExtras');
 });
 it('严格拒绝不支持的导出格式和非法显隐设置',()=>{
  for(const value of ['exe','DOCX',null,{},1])expect(()=>validateSettings({...defaults,defaultExportFormat:value})).toThrow('默认导出格式无效');
  for(const value of [null,[],{top:'false'},{unknown:true},{__proto__:null,constructor:true}])expect(()=>validateSettings({...defaults,toolbarExtras:value})).toThrow('工具栏附加按钮设置无效');
 });
 it('默认格式与全按钮显隐随备份保存，隐藏不修改模块和快捷键',async()=>{
  const s=structuredClone(defaults);s.defaultExportFormat='markdown';s.toolbar=['export','copy_markdown','export_doc'];s.toolbarExtras={drag:false,more:false,top:false,bottom:false};await saveSettings(s);const backup=await exportBackup();
  await saveSettings(structuredClone(defaults));await importBackup(backup,'replace');const restored=await getSettings();expect(restored).toEqual(s);expect(restored.modules).toEqual(defaults.modules);expect(restored.shortcuts).toEqual(defaults.shortcuts);
 });
 it('导出和快捷操作均尊重模块开关，不对禁用默认格式静默降级',()=>{
  const s=structuredClone(defaults);s.modules.export_word=false;s.modules.copy_marked=false;s.modules.nextpage=false;
  expect(s.defaultExportFormat).toBe('docx');expect(canExport(s,'docx')).toBe(false);expect(toolbarActionAllowed(s,'export_doc')).toBe(false);expect(toolbarActionAllowed(s,'export_docx')).toBe(false);expect(toolbarActionAllowed(s,'copy_markdown')).toBe(false);expect(toolbarActionAllowed(s,'next')).toBe(false);expect(canExport(s,'markdown')).toBe(true);
  expect(toolbarActionAllowed(s,'export_exe')).toBe(false);
 });
 it('全部配置项和九种导出格式具有可渲染SVG图标',()=>{
  for(const id of [...Object.keys(toolbarActions),...Object.keys(toolbarExtras),...exportFormats.map(([f])=>'export_'+f)])expect(renderToStaticMarkup(createElement(ToolIcon,{id}))).toContain('<svg');
 });
 it('工具栏页可以选择默认格式、独立显示操作并隐藏辅助按钮',async()=>{
  let latest=structuredClone(defaults);
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(SettingsPanel,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);},onClose:()=>{}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(Panel)));
   await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="工具栏"]')!.click());
   const select=host.querySelector<HTMLSelectElement>('select[aria-label="默认导出格式"]')!;expect(select.value).toBe('docx');expect(select.options).toHaveLength(9);
   await act(async()=>{select.value='markdown';select.dispatchEvent(new Event('change',{bubbles:true}));});expect(latest.defaultExportFormat).toBe('markdown');
   await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="显示 编辑内容"]')!.click());expect(latest.toolbar).toContain('edit');
   await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="显示 更多工具"]')!.click());expect(latest.toolbarExtras.more).toBe(false);
   await act(async()=>host.querySelector<HTMLInputElement>('input[aria-label="显示 偏好设置"]')!.click());expect(latest.toolbar).not.toContain('settings');expect(host.textContent).toContain('浏览器扩展的“选项”页面恢复');expect(latest.modules).toEqual(defaults.modules);
   expect(host.querySelectorAll('.circle-toolbar-choice svg').length).toBe(Object.keys(toolbarActions).length+Object.keys(toolbarExtras).length);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('将导出设置集中到工具栏默认格式组并完整说明文件名字段',async()=>{
  let latest=structuredClone(defaults);
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(SettingsPanel,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);},onClose:()=>{}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(Panel)));
   await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="高级"]')!.click());
   expect(host.querySelector('input[aria-label="文件名称模板"]')).toBeNull();
   expect(host.querySelector('[data-setting-label="导出时内嵌图片"]')).toBeNull();
   await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="工具栏"]')!.click());
   const group=host.querySelector('select[aria-label="默认导出格式"]')!.closest('section')!;
   const embed=group.querySelector<HTMLInputElement>('[data-setting-label="导出时内嵌图片"] input')!;
   expect(embed.checked).toBe(true);expect(group.querySelector('input[aria-label="文件名称模板"]')).not.toBeNull();
   expect([...group.querySelectorAll('li code')].map(node=>node.textContent)).toEqual(['[title]','[node:title]','[date]']);
   expect(group.textContent).toContain('导出日期（UTC）');expect(group.textContent).toContain('DOCX、EPUB 始终内嵌图片');
   await act(async()=>embed.click());expect(latest.imageEmbed).toBe(false);
   const search=host.querySelector<HTMLInputElement>('input[aria-label="搜索设置"]')!;
   await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(search,'文件名称模板');search.dispatchEvent(new Event('input',{bubbles:true}));});
   const results=host.querySelector('.circle-setting-results')!;
   expect([...results.querySelectorAll('button small')].map(node=>node.textContent)).toEqual(['工具栏']);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
});
