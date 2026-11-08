import {useState} from 'react';
import type {Settings} from '../types';
import {applyReadingStyle,captureReadingStyle,getReadingStyles,saveCurrentReadingConfiguration,saveReadingStyle,setDefaultReadingStyle} from '../styles';

/** Named snapshots remain independent from the current editable draft. */
export function ReadingStyles({settings,onChange}:{settings:Settings;onChange:(settings:Settings)=>void}){
 const styles=getReadingStyles(settings);
 const current=JSON.stringify(captureReadingStyle(settings));
 const matching=styles.find(style=>JSON.stringify(style.values)===current);
 const [selectedId,setSelectedId]=useState(matching?.id||settings.defaultStyleId);
 const [name,setName]=useState(''),[status,setStatus]=useState(''),[error,setError]=useState('');
 const selected=styles.find(style=>style.id===selectedId)||styles[0];
 const modified=!!selected&&JSON.stringify(selected.values)!==current;
 const configurationSaved=!!settings.defaultStyleOverride&&JSON.stringify(settings.defaultStyleOverride)===current;
 function attempt(action:()=>void){try{action();setError('');}catch(reason){setStatus('');setError(reason instanceof Error?reason.message:String(reason));}}
 function apply(){if(!selected)return;attempt(()=>{onChange(applyReadingStyle(settings,selected));setStatus(`已应用「${selected.name}」`);});}
 function save(){attempt(()=>{const next=saveReadingStyle(settings,name);const saved=next.savedStyles[next.savedStyles.length-1];onChange(next);setSelectedId(saved.id);setName('');setStatus(`已另存为「${saved.name}」`);});}
 function makeDefault(){if(!selected||modified)return;attempt(()=>{onChange(setDefaultReadingStyle(settings,selected.id));setStatus(`新打开的文章将使用「${selected.name}」`);});}
 function saveCurrent(){attempt(()=>{onChange(saveCurrentReadingConfiguration(settings));setStatus('已保存当前配置，新打开的文章将使用此配置。');});}
 return <section className="circle-setting-group circle-reading-styles" data-setting-label="样式库" aria-label="样式库">
  <h3>样式库</h3>
  <label className="circle-setting-row"><span>选择样式</span><select aria-label="选择样式" value={selected?.id||''} onChange={e=>{setSelectedId(e.target.value);setStatus('');setError('');}}>{styles.map(style=><option key={style.id} value={style.id}>{style.name}{style.id===settings.defaultStyleId?'（默认）':''}</option>)}</select></label>
  <div className="circle-style-actions">
   <button data-setting-label="保存当前配置" onClick={saveCurrent} disabled={configurationSaved}>保存当前配置</button>
   <button onClick={apply} disabled={!selected}>应用样式</button>
   <button onClick={makeDefault} disabled={!selected||modified||(selected.id===settings.defaultStyleId&&!settings.defaultStyleOverride)}>设为默认样式</button>
  </div>
  <p className="circle-style-help" data-style-modified={modified}>{configurationSaved?'当前外观已保存，下次打开文章继续使用。':'调整后点击“保存当前配置”，即可用于后续文章。'} 选择样式并点击“设为默认样式”可使用该样式作为后续文章的配置。</p>
  <label className="circle-setting-row"><span>新样式名称</span><input aria-label="新样式名称" maxLength={80} value={name} onChange={e=>setName(e.target.value)} placeholder="例如：法规阅读·大字版" onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();save();}}}/></label>
  <button onClick={save}>另存为新样式</button>
  <p className="circle-style-help">内置公文模板保留，不会被另存操作覆盖。自定义样式随完整数据备份保存。</p>
  {status&&<p role="status" className="circle-panel-status">{status}</p>}{error&&<p role="alert" className="circle-panel-status">{error}</p>}
 </section>;
}
