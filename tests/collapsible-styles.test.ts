import {afterEach,describe,it,expect,vi} from 'vitest';
import {act,createElement,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {defaults} from '../src/defaults';
import type {Settings} from '../src/types';
import {StyleControls} from '../src/ui/StyleControls';
import {SettingsPanel} from '../src/ui/Settings';
import {fontFamilyFor} from '../src/fonts';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function select(node:HTMLSelectElement,value:string){node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}
function input(node:HTMLInputElement,value:string){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));}
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
describe('简洁样式设置',()=>{
 it('正文、主标题、六级标题、署名、表格和页码默认仅显示字体字号，详细设置折叠',async()=>{
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(StyleControls,{settings:structuredClone(defaults),onChange:()=>{}})));
   const sections=[...host.querySelectorAll('[data-style-section]')];expect(sections).toHaveLength(11);
   for(const section of sections){expect(section.querySelectorAll(':scope > .circle-setting-row')).toHaveLength(2);expect(section.querySelector('details')?.open).toBe(false);expect(section.querySelector(':scope > .circle-setting-row select')).not.toBeNull();}
   expect(host.querySelector('input[aria-label="正文字体"]')).toBeNull();expect(host.querySelector('input[aria-label="六级标题字体"]')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('可直接从系统字体列表选择，并在展开后修改署名、表格和页码',async()=>{
  const sendMessage=vi.fn(async()=>({ok:true,fonts:[{fontId:'KaiTi',displayName:'楷体'}]}));vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage}});
  let latest=structuredClone(defaults);
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(StyleControls,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(Panel)));
   await act(async()=>host.querySelector<HTMLButtonElement>('.circle-font-inventory button')!.click());
   const font=host.querySelector<HTMLSelectElement>('select[aria-label="六级标题字体"]')!;expect([...font.options].some(option=>option.textContent?.includes('楷体'))).toBe(true);
   await act(async()=>select(font,fontFamilyFor('KaiTi')));expect(latest.appearance.headingFonts[5]).toBe(fontFamilyFor('KaiTi'));
   const metadata=host.querySelector<HTMLDetailsElement>('[data-style-section="metadata"] details')!;metadata.open=true;
   await act(async()=>select(host.querySelector('select[aria-label="署名对齐"]')!,'right'));expect(latest.appearance.metadata.textAlign).toBe('right');
   host.querySelector<HTMLDetailsElement>('[data-style-section="table"] details')!.open=true;
   await act(async()=>input(host.querySelector('input[aria-label="边框宽度（px）"]')!,'2'));expect(latest.appearance.table.borderWidth).toBe(2);
   host.querySelector<HTMLDetailsElement>('[data-style-section="page-number"] details')!.open=true;
   await act(async()=>select(host.querySelector('select[aria-label="页码格式"]')!,'page-total'));expect(latest.appearance.pageNumber.format).toBe('page-total');
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('搜索详细字段后会展开对应设置',async()=>{
  vi.stubGlobal('CSS',{escape:(value:string)=>value});const previous=HTMLElement.prototype.scrollIntoView;HTMLElement.prototype.scrollIntoView=()=>{};
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(SettingsPanel,{settings:structuredClone(defaults),onChange:()=>{},onClose:()=>{}})));
   await act(async()=>input(host.querySelector('input[aria-label="搜索设置"]')!,'署名对齐'));
   await act(async()=>host.querySelector<HTMLButtonElement>('.circle-setting-results button')!.click());
   await act(async()=>new Promise(resolve=>setTimeout(resolve,70)));
   expect(host.querySelector<HTMLDetailsElement>('[data-style-section="metadata"] details')?.open).toBe(true);
  }finally{await act(async()=>root.unmount());host.remove();HTMLElement.prototype.scrollIntoView=previous;}
 });
});
