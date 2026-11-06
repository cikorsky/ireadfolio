import {firefoxExecutable,createBrowserProfile} from './browser-runtime.mjs';
import {fixturePNG} from './fixture-image.mjs';
import {spawn} from 'node:child_process';import {mkdir,writeFile,readFile,rm} from 'node:fs/promises';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import net from 'node:net';
const evidence=path.resolve(process.env.FIREFOX_E2E_OUT||'evidence/firefox');await mkdir(evidence,{recursive:true});const artifact={manifestSha256:createHash('sha256').update(await readFile('dist/firefox/manifest.json')).digest('hex'),contentSha256:createHash('sha256').update(await readFile('dist/firefox/content.js')).digest('hex')};
const executable=firefoxExecutable();const manifest=JSON.parse(await readFile('dist/firefox/manifest.json','utf8'));const profile=await createBrowserProfile('ireadfolio-firefox-');const uuid=randomUUID();await writeFile(path.join(profile,'user.js'),'user_pref("remote.active-protocols", 1);\nuser_pref("remote.events.async.enabled", true);\n'+`user_pref("extensions.webextensions.uuids", ${JSON.stringify(JSON.stringify({[manifest.browser_specific_settings.gecko.id]:uuid}))});\n`);
const server=http.createServer(async(req,res)=>{if(req.url==='/pixel.png'){res.setHeader('Content-Type','image/png');res.end(fixturePNG);return;}res.setHeader('Content-Type','text/html;charset=utf-8');res.end(await readFile(path.resolve('tests/fixtures/article.html')));});await new Promise(r=>server.listen(0,'127.0.0.1',r));const fixture=`http://127.0.0.1:${server.address().port}/article.html`;
const probe=net.createServer();await new Promise(r=>probe.listen(0,'127.0.0.1',r));const port=probe.address().port;await new Promise(r=>probe.close(r));let log='',ws;const records=[];
const browser=spawn(executable,['--headless','--no-remote','--profile',profile,'--remote-debugging-port',String(port),'about:blank'],{stdio:['ignore','pipe','pipe']});browser.on('error',error=>{log+='Firefox launch failed: '+error.message;});browser.stdout.on('data',b=>{log+=b});browser.stderr.on('data',b=>{log+=b});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));const pending=new Map();let id=0;
function command(method,params={}){return new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(`Command timeout ${method}`));},20000);pending.set(n,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id:n,method,params}));});}
try{
 for(let i=0;i<100&&!log.includes('WebDriver BiDi listening');i++){if(browser.exitCode!==null)throw Error('Firefox exited '+browser.exitCode);await sleep(100);}
 console.log('Firefox BiDi endpoint started');
 ws=new WebSocket(`ws://127.0.0.1:${port}/session`);await new Promise((resolve,reject)=>{ws.addEventListener('open',resolve,{once:true});ws.addEventListener('error',reject,{once:true});});
 ws.addEventListener('message',event=>{const v=JSON.parse(event.data);if(v.id){const p=pending.get(v.id);pending.delete(v.id);if(v.type==='error')p?.reject(Error(JSON.stringify(v)));else p?.resolve(v.result);}});
 const session=await command('session.new',{capabilities:{alwaysMatch:{acceptInsecureCerts:false}}});records.push({name:'Firefox BiDi session',status:'passed',capabilities:session.capabilities});
 const installed=await command('webExtension.install',{extensionData:{type:'path',path:path.resolve('dist/firefox')}});console.log('INSTALLED',installed);records.push({name:'临时安装Firefox扩展',status:'passed',result:installed});
 const {context}=await command('browsingContext.create',{type:'tab'});await command('browsingContext.navigate',{context,url:fixture,wait:'complete'});
 const evaluate=async(expression,targetContext=context)=>{const r=await command('script.evaluate',{expression,target:{context:targetContext},awaitPromise:true});if(r.type==='exception')throw Error(JSON.stringify(r));return r.result.value;};
 async function waitFor(test,message){for(let i=0;i<100;i++){const result=await test();if(result)return result;await sleep(100);}throw Error(message);}
 const findFrame=nodes=>{for(const node of nodes){if(node.url?.startsWith('moz-extension://')&&node.url.includes('/reader.html'))return node.context;const child=findFrame(node.children||[]);if(child)return child;}};
 const readerContext=async()=>waitFor(async()=>{const tree=await command('browsingContext.getTree',{root:context});await writeFile(path.join(evidence,'context-tree.json'),JSON.stringify(tree,null,2));return findFrame(tree.contexts);},'未发现扩展阅读iframe浏览上下文');
 await waitFor(()=>evaluate('Boolean(document.querySelector("#circle-reader-entry"))'),'未出现阅读入口');await evaluate('document.querySelector("#circle-reader-entry").click()');
 let reader=await readerContext();
 await waitFor(()=>evaluate('Boolean(document.querySelector(".circle-paper"))',reader),'扩展iframe正文未渲染');
 const title=await evaluate('document.querySelector(".article-title")?.textContent',reader);assert.match(title,/水库安全监测/);records.push({name:'Firefox隔离iframe实际正文提取',status:'passed',title,readerContext:reader});
 const isolation=await evaluate('(()=>{try{return document.querySelector("#circle-reader-frame").contentWindow.document.body.textContent}catch(e){return e.name}})()');assert.equal(isolation,'SecurityError');records.push({name:'Firefox跨源iframe阻止原网站读取阅读界面',status:'passed'});
 const shot=await command('browsingContext.captureScreenshot',{context});await writeFile(path.join(evidence,'reader.png'),Buffer.from(shot.data,'base64'));
 await evaluate('document.querySelector("button[aria-label=偏好设置]").click()',reader);await waitFor(()=>evaluate('Boolean(document.querySelector(".circle-settings"))',reader),'偏好设置未打开');
 await evaluate(`document.querySelector('button[aria-label="主题 green"]').click()`,reader);
 await waitFor(()=>evaluate('document.querySelector(".circle-reader").dataset.theme === "green"',reader),'主题未生效');records.push({name:'Firefox iframe设置即时生效',status:'passed'});
 await evaluate(`(()=>{const input=document.querySelector('input[aria-label="新样式名称"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Firefox默认样式');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,reader);
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='另存为新样式').click()`,reader);
 await waitFor(()=>evaluate(`!Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='设为默认样式').disabled`,reader),'另存样式失败');
 await evaluate(`Array.from(document.querySelectorAll('button')).find(button=>button.textContent==='设为默认样式').click()`,reader);
 await waitFor(()=>evaluate(`chrome.storage.local.get('circle.replica.settings').then(data=>data['circle.replica.settings'].defaultStyleId!=='policy-document')`,reader),'默认样式未保存');records.push({name:'Firefox另存样式并设为默认',status:'passed'});
 await command('browsingContext.reload',{context,wait:'complete'});await waitFor(()=>evaluate('Boolean(document.querySelector("#circle-reader-entry"))'),'重载后入口未出现');await evaluate('document.querySelector("#circle-reader-entry").click()');reader=await readerContext();await waitFor(()=>evaluate('document.querySelector(".circle-reader")?.dataset.theme === "green"',reader),'重载后主题未保留');records.push({name:'Firefox iframe设置持久化',status:'passed'});
 try{await command('browsingContext.navigate',{context,url:`moz-extension://${uuid}/options.html`,wait:'complete'});await sleep(400);
 assert.equal(await evaluate('Boolean(document.querySelector(".circle-settings"))'),true);
 assert.equal(await evaluate('document.querySelector(".circle-reader").dataset.theme'),'green');
 await evaluate(`document.querySelector('button[aria-label="主题 cream"]').click()`);await sleep(250);
 assert.equal(await evaluate('document.querySelector(".circle-reader").dataset.theme'),'cream');
 await command('browsingContext.reload',{context,wait:'complete'});await sleep(300);assert.equal(await evaluate('document.querySelector(".circle-reader").dataset.theme'),'cream');
 records.push({name:'Firefox扩展选项页打开与保存',status:'passed'});
 const optionShot=await command('browsingContext.captureScreenshot',{context});await writeFile(path.join(evidence,'options.png'),Buffer.from(optionShot.data,'base64'));}catch(error){if(!String(error).includes('unsupported operation'))throw error;records.push({name:'Firefox独立扩展选项页',status:'unverified',reason:'Firefox WebDriver BiDi forbids navigation to moz-extension:// URLs',error:String(error)});}
 console.log(JSON.stringify(records,null,2));
}catch(e){records.push({name:'failure',status:'failed',error:String(e)});console.error(e);process.exitCode=1;}finally{if(ws?.readyState===1){await command('session.end').catch(()=>{});ws.close();}browser.kill('SIGTERM');server.close();await writeFile(path.join(evidence,'browser.log'),log);await writeFile(path.join(evidence,'results.json'),JSON.stringify({date:new Date().toISOString(),profile,artifact,records,sources:['https://w3c.github.io/webdriver-bidi/#command-webExtension-install','https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/index.html']},null,2));await rm(profile,{recursive:true,force:true});}
