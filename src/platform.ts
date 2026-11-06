export const extension = typeof chrome !== 'undefined' && !!chrome.runtime?.id;
export async function fetchText(url:string,articleId?:string):Promise<string> {
 if (extension) { const r = await chrome.runtime.sendMessage({type:'FETCH',url,articleId}); if (!r.ok) throw new Error(r.error); return r.text; }
 const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw new Error(`加载失败 (${r.status})`);return r.text();
}
export function openOptions(){if(extension)void chrome.runtime.openOptionsPage();else window.location.href='options.html';}
