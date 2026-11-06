import {describe,it,expect,vi} from 'vitest';
import {filterArticles} from '../src/ui/Library';
import type {Article} from '../src/types';
const article=(id:string,extra:Partial<Article>={}):Article=>({id,url:'https://example.com/'+id,title:'文章 '+id,author:'',published:'',excerpt:'',html:'<p>正文</p>',text:'水库安全监测',savedAt:1,tags:['水库'],category:'项目',archived:false,...extra});
describe('稍后阅读筛选',()=>{
 const data=[article('normal'),article('archived',{archived:true}),article('deleted',{deletedAt:123}),article('tagged',{tags:['技术'],category:'技术',savedAt:10})];
 it('归档和回收站互斥，正常列表不暴露已删除或归档文章',()=>{expect(filterArticles(data,'','all').map(a=>a.id)).toEqual(['tagged','normal']);expect(filterArticles(data,'','archive').map(a=>a.id)).toEqual(['archived']);expect(filterArticles(data,'','trash').map(a=>a.id)).toEqual(['deleted']);});
 it('同时按分类、标签和正文查询，保留来源数据',()=>{expect(filterArticles(data,'安全','all','项目','水库').map(a=>a.id)).toEqual(['normal']);expect(filterArticles(data,'不存在','all')).toHaveLength(0);expect(data).toHaveLength(4);});
 it('支持标题大小写与标签搜索，按保存时间倒序',()=>{const list=[article('a',{title:'API使用',savedAt:5}),article('b',{title:'api开发',savedAt:8})];expect(filterArticles(list,'API','all').map(a=>a.id)).toEqual(['b','a']);expect(filterArticles(data,'技术','all').map(a=>a.id)).toEqual(['tagged']);});
 it('恢复文章后回到正确的归档状态',()=>{const deleted=article('restore',{deletedAt:22,archived:true});const restored={...deleted};delete restored.deletedAt;expect(filterArticles([restored],'','all')).toHaveLength(0);expect(filterArticles([restored],'','archive')).toHaveLength(1);expect(filterArticles([restored],'','trash')).toHaveLength(0);});
});

import {act,createElement} from 'react';
import {createRoot} from 'react-dom/client';
import {LibraryPanel} from '../src/ui/Library';
import {SettingsPanel} from '../src/ui/Settings';
import {defaults} from '../src/defaults';
import {getArticles} from '../src/core/storage';
function change(input:HTMLInputElement|HTMLTextAreaElement,value:string){const prototype=input instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(prototype,'value')?.set?.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}
describe('面板真实交互',()=>{
 it('新建文字记录通过存储校验并出现在文章库',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const stored:Record<string,unknown>={};vi.stubGlobal('chrome',{storage:{local:{get:async()=>({...stored}),set:async(data:Record<string,unknown>)=>Object.assign(stored,data),remove:async(keys:string[])=>keys.forEach(k=>delete stored[k])}}});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(createElement(LibraryPanel,{onOpen:()=>{},onClose:()=>{}})));const textarea=host.querySelector('textarea')!;await act(async()=>change(textarea,'一次真实的阅读笔记'));const save=[...host.querySelectorAll('button')].find(b=>b.textContent==='保存记录')!;await act(async()=>save.click());const articles=await getArticles();expect(articles).toHaveLength(1);expect(articles[0].text).toBe('一次真实的阅读笔记');expect(host.textContent).toContain('一次真实的阅读笔记');}finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
 });
 it('设置搜索可从外观直接找到高级中的朗读配置',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
  try{await act(async()=>root.render(createElement(SettingsPanel,{settings:structuredClone(defaults),onChange:()=>{},onClose:()=>{}})));const search=host.querySelector('input[aria-label="搜索设置"]') as HTMLInputElement;await act(async()=>change(search,'朗读语速'));expect(host.querySelector('.circle-setting-results')?.textContent).toContain('高级');expect(host.querySelector('.circle-setting-results')?.textContent).toContain('朗读语速');}finally{await act(async()=>root.unmount());host.remove();}
 });
});

describe('本地导入与设置焦点',()=>{
 it('导入 TXT 后真实保存并打开文章',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const stored:Record<string,unknown>={};vi.stubGlobal('chrome',{storage:{local:{get:async()=>({...stored}),set:async(data:Record<string,unknown>)=>Object.assign(stored,data),remove:async()=>{}}}});
  const host=document.createElement('div');document.body.append(host);const root=createRoot(host),opened=vi.fn();
  try{await act(async()=>root.render(createElement(LibraryPanel,{onOpen:opened,onClose:()=>{}})));const file=new File(['本地文件正文。包含第一段与第二段。'],'本地阅读.txt',{type:'text/plain'});Object.defineProperty(file,'text',{value:async()=>'本地文件正文。包含第一段与第二段。'});const input=host.querySelector('input[type=file]')!;Object.defineProperty(input,'files',{value:[file]});await act(async()=>input.dispatchEvent(new Event('change',{bubbles:true})));expect(opened).toHaveBeenCalledTimes(1);expect(opened.mock.calls[0][0].title).toBe('本地阅读');const articles=await getArticles();expect(articles[0].category).toBe('本地文件');expect(articles[0].text).toContain('本地文件正文');}finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
 });
 it('设置为非模态，可将焦点移回预览，Esc只关设置并恢复入口焦点',async()=>{
  Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});const outer=document.createElement('div');document.body.append(outer);const shadow=outer.attachShadow({mode:'open'}),opener=document.createElement('button'),mount=document.createElement('div');opener.textContent='设置入口';shadow.append(opener,mount);opener.focus();const root=createRoot(mount),escaped=vi.fn();document.addEventListener('keydown',escaped);
  try{await act(async()=>root.render(createElement(SettingsPanel,{settings:structuredClone(defaults),onChange:()=>{},onClose:()=>root.render(null)})));const panel=shadow.querySelector('.circle-settings')!;const controls=[...panel.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')].filter(el=>{const closed=el.closest('details:not([open])');return !closed||closed.querySelector('summary')?.contains(el);});const first=controls[0],last=controls[controls.length-1];expect(panel.getAttribute('aria-modal')).toBe('false');expect(shadow.activeElement).toBe(first);const tab=new KeyboardEvent('keydown',{key:'Tab',shiftKey:true,bubbles:true,composed:true,cancelable:true});await act(async()=>first.dispatchEvent(tab));expect(tab.defaultPrevented).toBe(false);expect(shadow.activeElement).not.toBe(last);opener.focus();expect(shadow.activeElement).toBe(opener);first.focus();await act(async()=>first.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,composed:true,cancelable:true})));expect(shadow.querySelector('.circle-settings')).toBeNull();expect(shadow.activeElement).toBe(opener);expect(escaped).not.toHaveBeenCalled();}finally{document.removeEventListener('keydown',escaped);await act(async()=>root.unmount());outer.remove();}
 });
});
