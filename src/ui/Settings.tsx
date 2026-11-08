import {actionLabels} from '../actions';
import {toolbarActions,toolbarExtras,exportFormats,canExport} from '../toolbar';
import {ToolIcon} from './ToolIcon';
import {useEffect,useRef, useState} from 'react';
import type {ReactNode,KeyboardEvent as ReactKeyboardEvent} from 'react';
import {DatabaseOutlined,BgColorsOutlined,ToolOutlined,ThunderboltOutlined,MenuOutlined,UnorderedListOutlined,CommentOutlined,HighlightOutlined,ControlOutlined,InfoCircleOutlined,CloseOutlined,AppstoreOutlined} from '@ant-design/icons';
import type {Settings, Rule} from '../types';
import {SyncPanel} from './SyncPanel';
import {StyleControls} from './StyleControls';
import {defaults, modules} from '../defaults';
import {ReadingStyles} from './ReadingStyles';
import {exportBackup, importBackup, getSettings} from '../core/storage';
import {filenameFields} from '../export/filename';
const nav = ['配置管理','外观','工具栏','快捷键','右键菜单','黑白名单','悬浮盒子','批注操作','高级','关于'];
const icons:Record<string,ReactNode>={'配置管理':<DatabaseOutlined/>,'外观':<BgColorsOutlined/>,'工具栏':<ToolOutlined/>,'快捷键':<ThunderboltOutlined/>,'右键菜单':<MenuOutlined/>,'黑白名单':<UnorderedListOutlined/>,'悬浮盒子':<CommentOutlined/>,'批注操作':<HighlightOutlined/>,'高级':<ControlOutlined/>,'关于':<InfoCircleOutlined/>};
const searchable:Record<string,string[]>={'配置管理':['本地配置与数据','导入备份','导出完整备份','WebDAV备份'],'外观':['跟随系统','样式库','保存当前配置','选择样式','新样式名称','主题','页内边距','页外边距','正文宽度','信纸效果','显示页脚','分栏阅读','正文字体','字体大小','行高','段落间距','背景颜色','正文颜色','正文粗细','正文字形','正文装饰','正文行距方式','正文固定行距（px）','主标题字体','主标题字号（px）','署名字体','署名字号（px）','署名对齐','署名行距（px）','显示字数和阅读时间','表格字体','表格字号（px）','表格边框','表头字体','表头字号（px）','页码字体','页码字号（px）','页码格式','奇偶页不同','奇数页页码对齐','偶数页页码对齐','起始页码','字间距（px）','首行缩进（em）','标题对齐','图片对齐','隐藏图片','一级标题','二级标题','三级标题','四级标题','五级标题','六级标题','代码字体','代码字号','代码行高','链接颜色','选中文字颜色','选中背景颜色','背景图片','工具栏项距','工具栏组距','隐藏工具栏'],'工具栏':['显示工具栏','默认导出格式','导出时内嵌图片','文件名称模板',...Object.values(toolbarActions),...Object.values(toolbarExtras)],'快捷键':['进入 / 退出阅读模式','偏好设置','查找','打印','关闭面板'],'右键菜单':['启用浏览器右键菜单'],'黑白名单':['白名单','黑名单'],'悬浮盒子':['开启悬浮盒子'],'批注操作':['开启批注'],'高级':['自动滚动速度','朗读语速','朗读音调','朗读声音','自定义 CSS','站点解析规则','恢复默认设置'],'关于':['版本','配置管理']};

export function SettingsPanel({settings:s,onChange,onClose}:{settings:Settings;onChange:(s:Settings)=>void;onClose:()=>void}){
 const extensionOrigin=typeof chrome==='undefined'||!chrome.runtime?.id||['chrome-extension:','moz-extension:'].includes(location.protocol);
 const [tab,setTab]=useState('外观'),[search,setSearch]=useState(''),[status,setStatus]=useState(''),[busy,setBusy]=useState(false);
 const file=useRef<HTMLInputElement>(null),panel=useRef<HTMLElement>(null);
 useEffect(()=>{
  let previous:Element|null=document.activeElement;
  while(previous?.shadowRoot?.activeElement)previous=previous.shadowRoot.activeElement;
  panel.current?.querySelector<HTMLButtonElement>('button')?.focus();
  return ()=>{if(previous instanceof HTMLElement&&previous.isConnected)previous.focus();};
 },[]);
 function handleKeys(e:ReactKeyboardEvent<HTMLElement>){
  e.stopPropagation();
  if(e.key==='Escape'){e.preventDefault();onClose();return;}

 }
 const results=Object.entries(searchable).flatMap(([page,labels])=>[...new Set(labels)].map(label=>({page,label}))).concat(modules.map(([,name])=>({page:'应用市场',label:name}))).filter(r=>`${r.page} ${r.label}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
 function reveal(page:string,label:string){setTab(page);setSearch('');setTimeout(()=>{const target=panel.current?.querySelector(`[data-setting-label="${CSS.escape(label)}"]`);if(!target)return;let parent=target.parentElement;while(parent&&parent!==panel.current){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}target.scrollIntoView({block:'center'});},50);}
 const set=<K extends keyof Settings>(key:K,value:Settings[K])=>onChange({...s,[key]:value});
 const row=(label:string,control:ReactNode)=>search&&!label.includes(search)?null:<label className="circle-setting-row" data-setting-label={label} key={label}><span>{label}</span>{control}</label>;
 const toggle=(key:keyof Settings,label:string)=>row(label,<input type="checkbox" role="switch" checked={Boolean(s[key])} onChange={e=>set(key,e.target.checked as never)}/>);
 const numeric=(key:keyof Settings,label:string,min:number,max:number,step=1)=>row(label,<div className="circle-range"><input aria-label={`${label}滑块`} type="range" min={min} max={max} step={step} value={Number(s[key])} onChange={e=>set(key,Number(e.target.value) as never)}/><input aria-label={label} type="number" min={min} max={max} step={step} value={Number(s[key])} onChange={e=>{const value=e.target.valueAsNumber;if(Number.isFinite(value))set(key,Math.max(min,Math.min(max,value)) as never);}}/></div>);
 const group=(name:string,children:ReactNode)=><section className="circle-setting-group"><h3>{name}</h3>{children}</section>;
 async function backup(){setBusy(true);try{const b=await exportBackup();const url=URL.createObjectURL(new Blob([JSON.stringify(b,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=`阅读数据备份-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setStatus('备份文件已生成');}catch(e){setStatus(String(e));}finally{setBusy(false);}}
 async function restore(f:File){setBusy(true);try{if(f.size>50_000_000)throw Error('备份文件超过 50 MB');await importBackup(JSON.parse(await f.text()),'merge');onChange(await getSettings());setStatus('已合并导入备份');}catch(e){setStatus(`导入失败：${String(e)}`);}finally{setBusy(false);if(file.current)file.current.value='';}}
 function updateRule(id:string,key:keyof Rule,value:string){set('rules',s.rules.map(r=>r.id===id?{...r,[key]:value}:r));}
 return <div className="circle-settings-dock"><aside ref={panel} tabIndex={-1} onKeyDownCapture={handleKeys} className="circle-settings" aria-label="偏好设置" role="dialog" aria-modal="false">
  <header><button aria-label="关闭偏好设置" onClick={onClose}><CloseOutlined/></button><strong>偏好设置</strong><div className="circle-header-actions"><button onClick={()=>{setTab('应用市场');setSearch('');}}><AppstoreOutlined/> 应用市场</button><button title="关于" onClick={()=>setTab('关于')}><InfoCircleOutlined/></button></div></header>
  <div className="circle-setting-search"><input aria-label="搜索设置" placeholder="搜索设置" value={search} onChange={e=>setSearch(e.target.value)}/></div>
  <div className="circle-setting-layout"><nav aria-label="设置分类">{nav.map(t=><button aria-label={t} key={t} className={tab===t?'selected':''} onClick={()=>{setTab(t);setSearch('');}}>{icons[t]}<span>{t}</span></button>)}</nav><div className="circle-setting-content">
   {status&&<p role="status" className="circle-panel-status">{status}</p>}
   {search&&<section className="circle-setting-results"><h3>搜索结果</h3>{results.length?results.map(({page,label})=><button key={`${page}-${label}`} onClick={()=>reveal(page,label)}><strong>{label}</strong><small>{page}</small></button>):<p>没有找到匹配的设置</p>}</section>}
   {!search&&<>
   {tab==='外观'&&<>
    {toggle('followSystem','跟随系统')}
    <ReadingStyles settings={s} onChange={onChange}/>
    <h3>主题</h3><div className="circle-themes">{[['white','#fff','#222'],['green','#ccebd0','#222'],['cream','#f5ead7','#4d3525'],['gray','#454545','#ddd'],['dark','#191919','#ddd'],['gradient','linear-gradient(135deg,#6554db,#b0dcca)','#fff']].map(([id,bg,color])=><button aria-label={`主题 ${id}`} title={id} aria-pressed={s.theme===id} key={id} style={{background:bg,color}} onClick={()=>onChange({...s,theme:id,followSystem:false,color,appearance:{...s.appearance,titleColor:color,headingColors:Array(6).fill(color),metadata:{...s.appearance.metadata,color},pageNumber:{...s.appearance.pageNumber,color},table:{...s.appearance.table,color,headerColor:color,headerBackground:['dark','gray'].includes(id)?'#3d3d3d':'#f2f3f5',stripeColor:['dark','gray'].includes(id)?'#303030':'#f5f5f5'}}})}>A</button>)}</div>
    {group('渲染引擎',<>{numeric('pagePadding','页内边距',0,160)}{numeric('pageMargin','页外边距',0,160)}{numeric('width','正文宽度',400,1800,10)}{toggle('paper','信纸效果')}{toggle('footer','显示页脚')}{numeric('columns','分栏阅读',1,4)}</>)}
    <StyleControls settings={s} onChange={onChange}/>
   </>}
   {tab==='配置管理'&&!extensionOrigin&&group('数据管理',<><p>文章库、完整备份和WebDAV配置在独立扩展页管理。</p><button onClick={()=>void chrome.runtime.openOptionsPage()}>打开扩展选项页管理数据</button></>)}
   {tab==='配置管理'&&extensionOrigin&&<>{group('本地配置与数据',<p>阅读设置、样式、文章和批注保存在当前浏览器，可导出完整备份或通过WebDAV保存。</p>)}{group('导入 / 导出',<><p>导入采用合并方式，保留已有内容。相同编号记录保留时间较新的版本。</p><button disabled={busy} onClick={()=>void backup()}>导出完整备份</button><button disabled={busy} onClick={()=>file.current?.click()}>导入备份</button><input hidden ref={file} type="file" accept=".json,application/json" onChange={e=>{const f=e.target.files?.[0];if(f)void restore(f);}}/></>)}<SyncPanel onStatus={setStatus} onImported={onChange}/></>}
   {tab==='应用市场'&&<><h3>应用市场</h3><p>开启需要的模块，关闭后保留已有数据。</p>{modules.filter(([,name,description])=>!search||`${name}${description}`.includes(search)).map(([id,name,description])=><label className="circle-module" data-setting-label={name} key={id}><span><strong>{name}</strong><small>{description}</small></span><input aria-label={name} type="checkbox" role="switch" disabled={['parse','render','manual'].includes(id)} checked={Boolean(s.modules[id])} onChange={e=>set('modules',{...s.modules,[id]:e.target.checked})}/></label>)}</>}
   {tab==='工具栏'&&<>
    {group('工具栏显示',<>{row('显示工具栏',<input aria-label="显示工具栏" type="checkbox" role="switch" checked={s.modules.toolbar!==false} onChange={e=>set('modules',{...s.modules,toolbar:e.target.checked})}/>)}<p>仅调整按钮显示，不关闭功能模块或快捷键。隐藏设置按钮或整个工具栏后，可从浏览器扩展的“选项”页面恢复；已设置的快捷键仍可使用。</p></>)}
    {group('默认导出格式',<>{row('默认导出格式',<select aria-label="默认导出格式" value={s.defaultExportFormat||'docx'} onChange={e=>set('defaultExportFormat',e.target.value as Settings['defaultExportFormat'])}>{exportFormats.map(([format,label])=><option key={format} value={format}>{label}{canExport(s,format)?'':'（模块已关闭）'}</option>)}</select>)}<p>点击导出主按钮直接使用此格式；旁边的箭头可临时选择其他格式，不改变默认值。PDF 将打开打印窗口。</p>{!canExport(s,s.defaultExportFormat||'docx')&&<p role="status">当前默认格式对应模块已关闭，请在应用市场开启或更改默认格式。</p>}
     {toggle('imageEmbed','导出时内嵌图片')}
     <p>影响 Markdown、离线 HTML、Word DOC 和 PDF / 打印的图片加载方式。DOCX、EPUB 始终内嵌图片；纯文本、PNG 和 JPEG 不受此开关影响。关闭不等于移除图片，Markdown、HTML 和 DOC 会保留原图链接。</p>
     {row('文件名称模板',<input aria-label="文件名称模板" value={s.filenameTemplate} onChange={e=>set('filenameTemplate',e.target.value)}/>)}
     <p>支持以下字段，可与文字、短横线等组合使用，文件扩展名会自动添加：</p>
     <ul aria-label="文件名称模板支持字段">{filenameFields.map(field=><li key={field.token}><code>{field.token}</code>：{field.description}</li>)}</ul>
     <p>示例：<code>[title]-[date]</code>。未识别的字段按原文字保留。</p>
    </>)}
    {group('主工具栏操作',<><p>勾选需要直接显示的按钮，使用上下箭头调整顺序。隐藏的复制、编辑等操作仍可从“更多工具”使用。</p>{Object.entries(toolbarActions).map(([id,name])=>{const index=s.toolbar.indexOf(id);return <div className="circle-setting-row" data-setting-label={name} key={id}><label className="circle-toolbar-choice"><input aria-label={`显示 ${name}`} type="checkbox" checked={index>=0} onChange={e=>set('toolbar',e.target.checked?[...s.toolbar,id]:s.toolbar.filter(t=>t!==id))}/><ToolIcon id={id}/><span>{name}</span></label><span><button aria-label={`${name}上移`} disabled={index<1} onClick={()=>{const a=[...s.toolbar];[a[index-1],a[index]]=[a[index],a[index-1]];set('toolbar',a);}}>↑</button><button aria-label={`${name}下移`} disabled={index<0||index>=s.toolbar.length-1} onClick={()=>{const a=[...s.toolbar];[a[index+1],a[index]]=[a[index],a[index+1]];set('toolbar',a);}}>↓</button></span></div>;})}</>)}
    {group('辅助按钮',<>{Object.entries(toolbarExtras).map(([id,name])=><label className="circle-setting-row" data-setting-label={name} key={id}><span className="circle-toolbar-choice"><ToolIcon id={id}/>{name}</span><input aria-label={`显示 ${name}`} type="checkbox" checked={(s.toolbarExtras||{drag:true,more:true,top:true,bottom:true})[id as keyof Settings['toolbarExtras']]} onChange={e=>set('toolbarExtras',{...(s.toolbarExtras||{drag:true,more:true,top:true,bottom:true}),[id]:e.target.checked})}/></label>)}</>)}
   </> }
   {tab==='快捷键'&&group('快捷键',<><p>支持双击单键（如 a a）及 Ctrl+f 等组合键。</p>{Object.entries(s.shortcuts).map(([id,value])=>row(actionLabels[id]||id,<input aria-label={`快捷键 ${id}`} value={value} onChange={e=>set('shortcuts',{...s.shortcuts,[id]:e.target.value})}/>))}</>)}
   {tab==='右键菜单'&&group('右键菜单',<>{row('启用浏览器右键菜单',<input type="checkbox" role="switch" checked={Boolean(s.modules.menu)} onChange={e=>set('modules',{...s.modules,menu:e.target.checked})}/>)}<p>提供进入 / 退出阅读、手动选择、偏好设置和稍后阅读操作。</p></>)}
   {tab==='黑白名单'&&<>{group('白名单',<><p>匹配站点自动开启阅读。每行一个域名、网址或通配符。</p><textarea aria-label="白名单" rows={5} value={s.whitelist.join('\n')} onChange={e=>set('whitelist',e.target.value.split('\n').filter(Boolean))}/></>)}{group('黑名单',<><p>匹配站点禁止自动开启；黑名单优先。</p><textarea aria-label="黑名单" rows={5} value={s.blacklist.join('\n')} onChange={e=>set('blacklist',e.target.value.split('\n').filter(Boolean))}/></>)}</>}
   {tab==='悬浮盒子'&&group('划选操作',<>{row('开启悬浮盒子',<input type="checkbox" role="switch" checked={Boolean(s.modules.floatbox)} onChange={e=>set('modules',{...s.modules,floatbox:e.target.checked})}/>)}<p>划选正文后可高亮、添加想法或复制所选文字。</p></>)}
   {tab==='批注操作'&&group('批注',<>{row('开启批注',<input type="checkbox" role="switch" checked={Boolean(s.modules.annotator)} onChange={e=>set('modules',{...s.modules,annotator:e.target.checked})}/>)}<p>正文高亮和想法保存在当前浏览器，并包含在完整备份中。</p></>)}
   {tab==='高级'&&<>
    {group('阅读辅助',<>{numeric('scrollSpeed','自动滚动速度',5,200)}{numeric('speechRate','朗读语速',.5,3,.1)}{numeric('speechPitch','朗读音调',0,2,.1)}{row('朗读声音',<input aria-label="朗读声音" placeholder="留空使用系统默认" value={s.speechVoice} onChange={e=>set('speechVoice',e.target.value)}/>)}</>)}
    {group('自定义 CSS',<textarea aria-label="自定义 CSS" rows={7} spellCheck={false} value={s.customCSS} onChange={e=>set('customCSS',e.target.value)} placeholder=".reader-article { ... }"/>)}
    {group('站点解析规则',<>{s.rules.map(r=><div className="circle-rule" key={r.id}>{(['pattern','title','content','next','remove'] as const).map(key=><label key={key}><span>{{pattern:'匹配网址',title:'标题选择器',content:'正文选择器',next:'下一页选择器',remove:'移除选择器'}[key]}</span><input aria-label={`${key} ${r.id}`} value={r[key]} onChange={e=>updateRule(r.id,key,e.target.value)}/></label>)}<button onClick={()=>set('rules',s.rules.filter(x=>x.id!==r.id))}>删除规则</button></div>)}<button onClick={()=>set('rules',[...s.rules,{id:crypto.randomUUID(),pattern:location.hostname,title:'h1',content:'article',next:'a[rel=next]',remove:''}])}>添加规则</button></>)}
    {group('恢复默认设置',<button onClick={()=>{onChange(structuredClone(defaults));setStatus('已恢复默认设置，文章和批注保留');}}>恢复默认设置</button>)}
   </>}
   {tab==='关于'&&group('iReadFolio · i悦读',<><p>iReadFolio · i悦读提供网页阅读、文档排版、批注和多格式导出。</p><p>版本 0.8.2。</p><p>在“配置管理”中导入、导出本地数据，或设置WebDAV备份。</p></>)}
  </>}
  </div></div>
 </aside></div>;
}
