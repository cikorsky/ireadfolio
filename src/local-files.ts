import {marked} from 'marked';import {extractArticle,extractSelection} from './core/parser';import type {Article} from './types';
export async function readLocalFile(file:File):Promise<Article>{
 if(file.size>20_000_000)throw new Error('本地文件超过 20 MB，请拆分后导入');
 const ext=file.name.split('.').pop()?.toLowerCase();if(!['txt','md','markdown','html','htm'].includes(ext||''))throw new Error('支持 TXT、Markdown 和 HTML 文件');
 const text=await file.text(),url=`file:///import/${encodeURIComponent(file.name)}`;const doc=document.implementation.createHTMLDocument(file.name.replace(/\.[^.]+$/,''));
 if(ext==='html'||ext==='htm'){const parsed=new DOMParser().parseFromString(text,'text/html');return {...extractArticle(parsed,url),category:'本地文件'};}
 if(ext==='txt'){const paragraphs=text.replace(/\r/g,'').split(/\n\s*\n/);for(const p of paragraphs){const el=doc.createElement('p');el.textContent=p;doc.body.append(el);}}
 else doc.body.innerHTML=marked.parse(text,{async:false});
 const article=extractSelection(doc.body,url);return {...article,title:doc.querySelector('h1')?.textContent||doc.title,category:'本地文件'};
}
