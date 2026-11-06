import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
import {extractArticle} from '../src/core/parser';
import {detectPolicyHeadings} from '../src/core/policy-structure';

// Synthetic URL exercises the publisher-boundary branch; tests never request it.
const sourceURL='https://fixture.gov.cn/policy/synthetic.html';
const fixture=readFileSync('tests/fixtures/policy-synthetic.html','utf8');
const parse=(html:string)=>new DOMParser().parseFromString(html,'text/html');
const compact=(value:string)=>value.replace(/\s/g,'');

describe('公文结构恢复（项目编写的合成页面）',()=>{
 it('8个章节和24个行内条款自动分级，保留全部正文和来源',()=>{
  const source=parse(fixture),before=source.documentElement.outerHTML;
  const article=extractArticle(source,sourceURL),body=parse(article.html);
  expect(body.querySelectorAll('h1')).toHaveLength(8);
  expect(body.querySelectorAll('h2')).toHaveLength(24);
  expect(body.querySelector('h1')?.textContent).toBe('一、示例范围');
  expect(body.querySelector('h2')?.textContent).toBe('（一）整理测试目录。');
  expect(body.querySelector('h2')?.nextElementSibling?.textContent).toMatch(/^依据/);
  expect(article.text).toContain('所有记录均为测试生成，不代表真实管理要求');
  expect(body.querySelector('h2')?.getAttribute('data-circle-source')).toBeTruthy();
  expect(source.documentElement.outerHTML).toBe(before);
  const expected=[...source.querySelectorAll('#UCAP-CONTENT p')].slice(2).map(p=>p.textContent).join('');
  expect(compact(article.text)).toBe(compact(expected));
 });
 it('署名、落款日期与发布日期分开，排除责任编辑及重复摘要/主标题',()=>{
  const article=extractArticle(parse(fixture),sourceURL);
  expect(article.author).toBe('');
  expect(article.signature).toBe('本报示例城11月6日电');
  expect(article.signedDate).toBe('2026年11月1日');
  expect(article.published).toBe('2026-11-06T08:30:00');
  expect(article.excerpt).toBe('');
  expect(article.text).not.toContain('本报示例城11月6日电');
  expect(article.text).not.toContain('2026年11月1日');
  expect(article.text).not.toContain('示例资料中心关于测试文档整理的说明');
  expect(article.text).not.toContain('示例编辑');
 });
 it('可关闭编号标题自动识别，元信息整理仍可正常工作',()=>{
  const article=extractArticle(parse(fixture),sourceURL,undefined,{detectHeadings:false});
  expect(parse(article.html).querySelectorAll('h1,h2')).toHaveLength(0);
  expect(article.signature).toBe('本报示例城11月6日电');
  expect(article.text).toContain('（二十四）完成样本复核。');
 });
 it('拆分条款保留强调、链接与后续正文，移除规则仍指向原段落',()=>{
  const doc=parse('<title>文件</title><article><p><b>（一）强化监督。</b><a href="/a">正文引用</a>以及后续说明，不应丢失。</p><p>这是一个需要保留的普通段落，为文件说明提供完整内容。</p></article>');
  const rule={id:'rule',pattern:'example.com',title:'title',content:'article',remove:'',next:''};
  const article=extractArticle(doc,'https://example.com/policy',rule),body=parse(article.html);
  const heading=body.querySelector('h2')!,paragraph=heading.nextElementSibling!;
  expect(heading.textContent).toBe('（一）强化监督。');
  expect(paragraph.querySelector('a')?.getAttribute('href')).toBe('https://example.com/a');
  expect(paragraph.textContent).toBe('正文引用以及后续说明，不应丢失。');
  expect(paragraph.getAttribute('data-circle-source')).toBe(heading.getAttribute('data-circle-source'));
  const again=extractArticle(doc,'https://example.com/policy',{...rule,remove:heading.getAttribute('data-circle-source')!});
  expect(again.text).not.toContain('强化监督');
  expect(again.text).toContain('普通段落');
 });
});

describe('保守的编号标题识别',()=>{
 it('短编号标题分级，已有非编号标题保持原级别',()=>{
  const root=parse('<main><p>一、总体要求</p><p>（一）工作原则</p><p>1. 组织保障</p><p>（1）人员职责</p><h5>原有五级标题</h5></main>').querySelector('main')!;
  detectPolicyHeadings(root);
  expect([...root.children].map(n=>n.tagName)).toEqual(['H1','H2','H3','H4','H5']);
 });
 it('小数、计量、普通句子、表格、代码、列表和引文不误标',()=>{
  const root=parse('<main><p>1.5米水位。</p><p>1. 200万元资金。</p><p>（1）20毫米。</p><p>（一）该项说明，包含逗号和完整论述。继续保留正文。</p><p>一、这是一个完整句子。并不是独立标题。</p><table><tr><td><p>一、表格内文本</p></td></tr></table><pre><code>1. 代码示例</code></pre><ul><li><p>（一）普通列表</p></li></ul><blockquote><p>一、引用内文本</p></blockquote></main>').querySelector('main')!;
  const before=root.innerHTML;detectPolicyHeadings(root);expect(root.innerHTML).toBe(before);
 });
 it('普通作者不被错误当作编辑，正文明示日期不误删',()=>{
  const doc=parse('<meta name="author" content="张三"><title>治理办法</title><article><p>这是一篇普通文章，作者介绍治理的具体工作。</p><p>（2025年6月17日）</p><p>这一天的现场记录应当保留，不能当作署名日期删除。</p></article>');
  const article=extractArticle(doc,'https://example.com/news');
  expect(article.author).toBe('张三');expect(article.signedDate).toBeUndefined();expect(article.text).toContain('2025年6月17日');
 });
 it('编号图片说明不转标题，条款末尾的无文本标记不丢失',()=>{
  const root=parse('<main><p>一、图片说明<img src="a.png"></p><p>（一）保留链接。具体正文<a href="#note"></a></p></main>').querySelector('main')!;
  detectPolicyHeadings(root);
  expect(root.firstElementChild?.tagName).toBe('P');expect(root.querySelector('img')).not.toBeNull();
  expect(root.querySelector('h2')?.textContent).toBe('（一）保留链接。');
  expect(root.querySelector('p:last-child a')?.getAttribute('href')).toBe('#note');
 });
});
