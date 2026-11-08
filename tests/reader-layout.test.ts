import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {JSDOM} from 'jsdom';
import {defaults} from '../src/defaults';
import {validateSettings,saveSettings,getSettings,exportBackup,importBackup} from '../src/core/storage';
import {captureReadingStyle} from '../src/styles';
import {pageToolbarAnchor,clampToolbarToPreview} from '../src/toolbar';
import {SettingsPanel} from '../src/ui/Settings';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
beforeEach(()=>{vi.stubGlobal('localStorage',new JSDOM('',{url:'https://layout.test'}).window.localStorage);});
afterEach(()=>vi.unstubAllGlobals());
describe('live settings preview and paper-relative toolbar',()=>{
 it('anchors near the paper rather than the browser edge and follows narrower preview bounds',()=>{
  expect(pageToolbarAnchor(1020,{left:0,top:0,right:1600,bottom:1000},48,600)).toEqual({x:1032,y:16});
  expect(pageToolbarAnchor(724,{left:0,top:0,right:800,bottom:1000},48,600)).toEqual({x:736,y:16});
  expect(pageToolbarAnchor(724,{left:0,top:0,right:760,bottom:1000},48,600)).toEqual({x:704,y:16});
  expect(pageToolbarAnchor(310,{left:0,top:0,right:390,bottom:350},48,330)).toEqual({x:322,y:12});
 });
 it('keeps dragging inside the preview and permits negative page-relative offsets',()=>{
  const bounds={left:0,top:0,right:800,bottom:700};
  expect(clampToolbarToPreview(1000,800,48,400,bounds)).toEqual({x:752,y:300});
  expect(clampToolbarToPreview(-20,-10,48,400,bounds)).toEqual({x:0,y:0});
  const s=structuredClone(defaults);s.appearance.toolbarX=-150;s.appearance.toolbarY=-5;
  expect(validateSettings(s).appearance).toMatchObject({toolbarAnchor:'page',toolbarX:-150,toolbarY:-5});
  expect(captureReadingStyle(s).appearance).not.toHaveProperty('toolbarAnchor');
 });
 it('migrates previous browser coordinates once without changing other appearance or saved snapshots',()=>{
  const old=structuredClone(defaults) as unknown as Record<string,unknown>;
  const appearance=old.appearance as Record<string,unknown>;delete appearance.toolbarAnchor;appearance.toolbarX=1200;appearance.toolbarY=90;appearance.fontWeight=700;
  const migrated=validateSettings(old);expect(migrated.appearance).toMatchObject({toolbarAnchor:'page',toolbarX:-1,toolbarY:-1,fontWeight:700});
  migrated.appearance.toolbarX=-60;migrated.appearance.toolbarY=80;expect(validateSettings(migrated).appearance).toMatchObject({toolbarX:-60,toolbarY:80});
  expect(()=>validateSettings({...defaults,appearance:{...defaults.appearance,toolbarAnchor:'browser'}})).toThrow('工具栏锚定方式无效');
 });
 it('updates only the exact old built-in footer distance, retaining custom values and named styles',()=>{
  const prior={...defaults.appearance.pageNumber,marginBottom:24};
  const s=structuredClone(defaults);s.appearance.pageNumber=prior;
  s.savedStyles=[{id:'named',name:'保留页码位置',values:captureReadingStyle(s)}];
  const old=structuredClone(s) as unknown as Record<string,unknown>;delete (old.appearance as Record<string,unknown>).toolbarAnchor;
  const migrated=validateSettings(old);expect(migrated.appearance.pageNumber.marginBottom).toBe(defaults.appearance.pageNumber.marginBottom);
  expect(migrated.savedStyles[0].values.appearance.pageNumber.marginBottom).toBe(24);
  expect(validateSettings({...old,appearance:{...(old.appearance as Record<string,unknown>),pageNumber:{...prior,start:2}}}).appearance.pageNumber.marginBottom).toBe(24);
  expect(validateSettings({...old,defaultStyleId:'named'}).appearance.pageNumber.marginBottom).toBe(24);
 });
 it('preserves an explicit new-version 24px footer through saving and backup restoration',async()=>{
  const settings=structuredClone(defaults);settings.appearance.pageNumber.marginBottom=24;
  expect(validateSettings(settings).appearance.pageNumber.marginBottom).toBe(24);
  await saveSettings(settings);expect((await getSettings()).appearance.pageNumber.marginBottom).toBe(24);
  const backup=await exportBackup();localStorage.clear();await importBackup(backup,'replace');
  expect((await getSettings()).appearance.pageNumber.marginBottom).toBe(24);
 });
 it('provides configuration management and an independent nonmodal settings surface without obsolete product descriptions',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),close=vi.fn();
  try{
   await act(async()=>root.render(createElement(SettingsPanel,{settings:structuredClone(defaults),onChange:()=>{},onClose:close})));
   expect(host.querySelector('.circle-panel-overlay')).toBeNull();expect(host.querySelector('.circle-settings-dock')).toBeTruthy();expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-modal')).toBe('false');
   const config=host.querySelector<HTMLButtonElement>('button[aria-label="配置管理"]')!;expect(config).toBeTruthy();await act(async()=>config.click());expect(host.textContent).toContain('本地配置与数据');
   await act(async()=>host.querySelector<HTMLButtonElement>('button[aria-label="关于"]')!.click());expect(host.textContent).toContain('版本 0.8.1');expect(host.textContent).not.toMatch(/Circle|原站|会员/);
   const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});await act(async()=>host.querySelector('.circle-settings')!.dispatchEvent(escape));expect(close).toHaveBeenCalledOnce();expect(escape.defaultPrevented).toBe(true);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
});
