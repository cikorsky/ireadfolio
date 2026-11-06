import {describe,it,expect,vi} from 'vitest';
import {act,createElement,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {renderToStaticMarkup} from 'react-dom/server';
import type {Settings} from '../src/types';
import {defaults} from '../src/defaults';
import {StyleControls} from '../src/ui/StyleControls';
import {ReadingStyles} from '../src/ui/ReadingStyles';
import {Reader} from '../src/ui/Reader';
import {SettingsPanel} from '../src/ui/Settings';
import {applyDefaultReadingStyle} from '../src/styles';

Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
function input(node:HTMLInputElement,value:string){Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(node,value);node.dispatchEvent(new Event('input',{bubbles:true}));}
function select(node:HTMLSelectElement,value:string){node.value=value;node.dispatchEvent(new Event('change',{bubbles:true}));}

describe('阅读字体与样式库真实交互',()=>{
 it('切换暗色主题同步应用可读的正文和标题配色',async()=>{
  let latest=structuredClone(defaults);
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(SettingsPanel,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);},onClose:()=>{}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(Panel)));
   await act(async()=>host.querySelector<HTMLButtonElement>('[aria-label="主题 dark"]')!.click());
   expect(latest.theme).toBe('dark');expect(latest.followSystem).toBe(false);
   expect(latest.color).toBe('#ddd');expect(latest.appearance.titleColor).toBe('#ddd');expect(latest.appearance.headingColors).toEqual(Array(6).fill('#ddd'));
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('显式黑色标题独立于红色正文，嵌套来源字号不改变标题像素值',()=>{
  const settings=structuredClone(defaults);settings.color='#ff0000';settings.appearance.titleColor='#1b1b1b';settings.appearance.headingColors=Array(6).fill('#1b1b1b');settings.appearance.headingSizes[1]=1.5;
  vi.stubGlobal('matchMedia',()=>({matches:false}));
  try{
   const markup=renderToStaticMarkup(createElement(Reader,{article:{id:'style-example',url:'https://example.com',title:'主标题',author:'',published:'',excerpt:'',html:'<div style="font-size:44px;font-family:Arial;color:red"><h2>章节标题</h2><p>正文</p></div>',text:'正文',savedAt:1,tags:[],category:'',archived:false},settings,onSettings:()=>{},onClose:()=>{},portal:document.createElement('div')}));
   const doc=new DOMParser().parseFromString(markup,'text/html'),reader=doc.querySelector<HTMLElement>('.circle-reader')!;
   expect(reader.style.getPropertyValue('--ink')).toBe('#ff0000');
   expect(reader.style.getPropertyValue('--title-color')).toBe('#1b1b1b');
   expect(reader.style.getPropertyValue('--h2-color')).toBe('#1b1b1b');
   expect(reader.style.getPropertyValue('--h2-size')).toBe(`${settings.fontSize*1.5}px`);
   expect(doc.querySelector('.article-content div')?.getAttribute('style')).toContain('font-size:44px');
  }finally{vi.unstubAllGlobals();}
 });
 it('正文、主标题和六级标题可独立调整，不改变其他级标题',async()=>{
  let latest=structuredClone(defaults);
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(StyleControls,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{
   await act(async()=>root.render(createElement(Panel)));
   const font=host.querySelector<HTMLSelectElement>('select[aria-label="六级标题字体"]')!;
   await act(async()=>select(font,'serif'));
   expect(latest.appearance.headingFonts[5]).toBe('serif');
   expect(latest.appearance.headingFonts[0]).toBe(defaults.appearance.headingFonts[0]);
   await act(async()=>input(host.querySelector('input[aria-label="主标题字号（px）"]')!,'36'));
   expect(latest.appearance.titleSize).toBe(36);
   expect(latest.fontSize).toBe(defaults.fontSize);
   host.querySelector<HTMLDetailsElement>('[data-style-section="heading-2"] details')!.open=true;
   await act(async()=>select(host.querySelector('select[aria-label="二级标题字形"]')!,'italic'));
   expect(latest.appearance.headingStyles[1]).toBe('italic');
   expect(latest.appearance.headingStyles[0]).toBe('normal');
   host.querySelector<HTMLDetailsElement>('[data-style-section="body"] details')!.open=true;
   await act(async()=>input(host.querySelector('input[aria-label="字间距（px）"]')!,'-0.8'));
   expect(latest.appearance.letterSpacing).toBe(-.8);
   expect(host.querySelector('[role="alert"]')).toBeNull();
  }finally{await act(async()=>root.unmount());host.remove();}
 });
 it('另存为新样式、设为默认、切换和再次载入使用保存快照',async()=>{
  let latest=structuredClone(defaults);
  latest.appearance.titleSize=36;
  latest.appearance.headingFonts[0]='serif';
  function Panel(){const [settings,setSettings]=useState(latest);return createElement(ReadingStyles,{settings,onChange:(next:Settings)=>{latest=next;setSettings(next);}});}
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  const button=(name:string)=>[...host.querySelectorAll<HTMLButtonElement>('button')].find(node=>node.textContent===name)!;
  try{
   await act(async()=>root.render(createElement(Panel)));
   expect(button('设为默认样式').disabled).toBe(true);
   await act(async()=>input(host.querySelector('input[aria-label="新样式名称"]')!,'法规阅读·大字版'));
   await act(async()=>button('另存为新样式').click());
   expect(latest.savedStyles).toHaveLength(1);
   const custom=latest.savedStyles[0];
   expect(custom.name).toBe('法规阅读·大字版');
   expect(button('设为默认样式').disabled).toBe(false);
   await act(async()=>button('设为默认样式').click());
   expect(latest.defaultStyleId).toBe(custom.id);
   await act(async()=>select(host.querySelector('select[aria-label="选择样式"]')!,'policy-document'));
   await act(async()=>button('应用样式').click());
   expect(latest.appearance.titleSize).toBe(defaults.appearance.titleSize);
   expect(latest.defaultStyleId).toBe(custom.id);
   const opened=applyDefaultReadingStyle(latest);
   expect(opened.appearance.titleSize).toBe(36);
   expect(opened.appearance.headingFonts[0]).toBe('serif');
   await act(async()=>input(host.querySelector('input[aria-label="新样式名称"]')!,'法规阅读·大字版'));
   await act(async()=>button('另存为新样式').click());
   expect(host.querySelector('[role="alert"]')?.textContent).toMatch(/存在|重复/);
   expect(latest.savedStyles).toHaveLength(1);
  }finally{await act(async()=>root.unmount());host.remove();}
 });
});
