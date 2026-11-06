import type {Settings} from '../types';
import {useEffect,useRef,useState} from 'react';
import {exportBackup,importBackup,getSettings} from '../core/storage';
interface Version {id:string;createdAt:number;bytes:number}
interface Data {configured?:boolean;enabled?:boolean;baseUrl?:string;authType?:'password'|'none';username?:string;hasPassword?:boolean;allowInsecureHttp?:boolean;lastBackupAt?:number;versions?:Version[]}
interface Response {ok:boolean;data?:Data;error?:string}
export function SyncPanel({onStatus,onImported}:{onStatus?:(message:string)=>void;onImported?:(settings:Settings)=>void}){
 const [url,setUrl]=useState(''),[username,setUsername]=useState(''),[password,setPassword]=useState(''),[authType,setAuthType]=useState<'password'|'none'>('password'),[enabled,setEnabled]=useState(false),[allowHttp,setAllowHttp]=useState(false),[showPassword,setShowPassword]=useState(false),[hasPassword,setHasPassword]=useState(false),[configured,setConfigured]=useState(false),[active,setActive]=useState(false),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[status,setStatus]=useState(''),[lastBackup,setLastBackup]=useState<number>(),[versions,setVersions]=useState<Version[]>([]);
 const operation=useRef(false);
 const extension=typeof chrome!=='undefined'&&!!chrome.runtime?.id;
 const privileged=extension&&location.href.split('?')[0].split('#')[0]===chrome.runtime.getURL('options.html');
 async function send(message:Record<string,unknown>):Promise<Response>{
  if(!extension)throw new Error('WebDAV 备份仅在已安装的扩展中可用');
  const result:unknown=await chrome.runtime.sendMessage(message);if(!result||typeof result!=='object')throw new Error('WebDAV 返回结果无效');
  const response=result as Response;if(!response.ok)throw new Error(response.error||'WebDAV 操作失败');return response;
 }
 function report(message:string){setStatus(message);onStatus?.(message)}
 useEffect(()=>{
  if(!extension)return;let valid=true;
  void send({type:privileged?'WEBDAV_CONFIG_GET':'WEBDAV_STATUS'}).then(({data})=>{
   if(!valid)return;setConfigured(!!data?.configured);setActive(!!data?.enabled);setEnabled(!!data?.enabled);setLastBackup(data?.lastBackupAt);
   if(privileged){setUrl(data?.baseUrl||'');setUsername(data?.username||'');setAuthType(data?.authType||'password');setHasPassword(!!data?.hasPassword);setAllowHttp(!!data?.allowInsecureHttp);}
  }).catch(error=>{if(valid)setStatus(error instanceof Error?error.message:String(error));});return()=>{valid=false;};
 },[extension,privileged]);
 async function run(action:()=>Promise<void>){if(operation.current)return;operation.current=true;setBusy(true);try{await action()}catch(error){report(error instanceof Error?error.message:'WebDAV 操作失败')}finally{operation.current=false;setBusy(false)}}
 async function save(){
  const {data}=await send({type:'WEBDAV_CONFIG_SAVE',baseUrl:url,username,password,authType,enabled,allowInsecureHttp:allowHttp});setConfigured(!!data?.configured);setActive(!!data?.enabled);setHasPassword(!!data?.hasPassword);setPassword('');setDirty(false);if(data?.baseUrl)setUrl(data.baseUrl);setLastBackup(data?.lastBackupAt);setVersions([]);report('WebDAV 配置已保存，密码保留在扩展本机存储中');
 }
 async function pull(id?:string){const result=await send({type:id?'WEBDAV_RESTORE':'WEBDAV_PULL',id});await importBackup(result.data,'merge');onImported?.(await getSettings());report('已合并恢复 WebDAV 备份，当前本地数据保留');}
 const unavailable=busy||!configured||!active||dirty;
 return <section className="circle-setting-group"><h3>WebDAV 备份</h3><p>将完整数据备份到你指定的 WebDAV 目录。修改后请保存配置；不会自动上传或删除远端备份。</p>
 <p role="status">{configured?(active?'WebDAV 备份已启用':'WebDAV 配置已保存，备份未启用'):'尚未配置 WebDAV 备份'}{lastBackup&&<> · 上次备份：{new Date(lastBackup).toLocaleString()}</>}</p>
 {privileged?<>
  <label className="circle-setting-row"><span>启用 WebDAV 备份</span><input aria-label="启用 WebDAV 备份" type="checkbox" role="switch" disabled={busy} checked={enabled} onChange={e=>{setEnabled(e.target.checked);setDirty(true);}}/></label>
  <label className="circle-setting-row"><span>鉴权类型</span><select aria-label="WebDAV 鉴权类型" disabled={busy} value={authType} onChange={e=>{setAuthType(e.target.value as typeof authType);setDirty(true);}}><option value="password">用户名与密码（Basic）</option><option value="none">无需鉴权</option></select></label>
  <label className="circle-setting-row"><span>URL</span><input aria-label="WebDAV URL" type="url" disabled={busy} placeholder="https://example.com/dav/" value={url} onChange={e=>{setUrl(e.target.value);setDirty(true);}}/></label>
  {authType==='password'&&<><label className="circle-setting-row"><span>用户名</span><input aria-label="WebDAV 用户名" autoComplete="off" disabled={busy} value={username} onChange={e=>{setUsername(e.target.value);setDirty(true);}}/></label><label className="circle-setting-row"><span>密码</span><input aria-label="WebDAV 密码" type={showPassword?'text':'password'} autoComplete="new-password" disabled={busy} value={password} placeholder={hasPassword?'已保存密码，留空保留':'输入密码或应用专用密码'} onChange={e=>{setPassword(e.target.value);setDirty(true);}}/></label><label className="circle-setting-row"><span>显示本次输入的密码</span><input aria-label="显示 WebDAV 密码" type="checkbox" checked={showPassword} disabled={busy} onChange={e=>setShowPassword(e.target.checked)}/></label>{hasPassword&&<p>密码已保存。重载后不回填明文；留空可保留同一 URL 和用户名的密码，修改连接目标时请重新输入。</p>}</>}
  <label className="circle-setting-row"><span>允许非加密 HTTP</span><input aria-label="允许非加密 WebDAV HTTP" type="checkbox" disabled={busy} checked={allowHttp} onChange={e=>{setAllowHttp(e.target.checked);setDirty(true);}}/></label>
  {/^http:/i.test(url)&&<p>HTTP 会以非加密方式传输备份内容和凭据，建议使用 HTTPS。只有明确勾选允许后，才会使用 HTTP。</p>}
  <button type="button" disabled={busy||!url} onClick={()=>void run(save)}>保存 WebDAV 配置</button><button type="button" disabled={busy||!configured} onClick={()=>void run(async()=>{await send({type:'WEBDAV_CONFIG_SAVE',clear:true});setConfigured(false);setActive(false);setEnabled(false);setHasPassword(false);setPassword('');setUsername('');setUrl('');setAllowHttp(false);setVersions([]);setLastBackup(undefined);setDirty(false);report('已移除本机 WebDAV 配置，远端备份保留');})}>移除 WebDAV 配置</button>
  {dirty&&<p>配置有未保存的更改。请先保存，再测试连接或备份。</p>}
 </>:<p>连接信息和密码仅在独立的配置管理页填写。{extension&&<button type="button" onClick={()=>void chrome.runtime.openOptionsPage()}>打开 WebDAV 配置管理</button>}</p>}
 <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:12}}><button type="button" disabled={unavailable} onClick={()=>void run(async()=>{await send({type:'WEBDAV_TEST'});report('WebDAV 连接正常');})}>测试 WebDAV 连接</button><button type="button" disabled={unavailable} onClick={()=>void run(async()=>{const result=await send({type:'WEBDAV_PUSH',backup:await exportBackup()});setLastBackup(result.data?.lastBackupAt);report('完整备份已保存到 WebDAV');})}>立即备份到 WebDAV</button><button type="button" disabled={unavailable} onClick={()=>void run(()=>pull())}>恢复最新 WebDAV 备份</button><button type="button" disabled={unavailable} onClick={()=>void run(async()=>{const {data}=await send({type:'WEBDAV_LIST'});if(!Array.isArray(data?.versions))throw new Error('WebDAV 历史列表格式无效');setVersions(data.versions);report(data.versions.length?`找到 ${data.versions.length} 个 WebDAV 历史备份`:'WebDAV 目录中尚无备份');})}>查看 WebDAV 历史备份</button></div>
 {versions.length>0&&<ul>{versions.map(version=><li key={version.id}>{new Date(version.createdAt).toLocaleString()} · {Math.round(version.bytes/1024)} KB <button type="button" disabled={unavailable} onClick={()=>void run(()=>pull(version.id))}>合并恢复此版本</button></li>)}</ul>}{status&&<p role="status">{status}</p>}{busy&&<p role="status">正在执行 WebDAV 操作，请稍候…</p>}</section>;
}
