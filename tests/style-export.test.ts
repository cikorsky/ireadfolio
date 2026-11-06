import {describe,it,expect} from 'vitest';
import {defaults} from '../src/defaults';
import {articleHTML} from '../src/export/content';
import type {Article} from '../src/types';

const article:Article={id:'styles',title:'公文排版测试',url:'https://example.com/policy',author:'',published:'',excerpt:'',html:'<h1>一、总体要求</h1><h2>（一）工作原则</h2><h6>六级标题</h6><p>正文内容。</p>',text:'正文内容。',savedAt:0,tags:[],category:'',archived:false};

describe('HTML与打印沿用阅读样式',()=>{
 it('保留模板字体、固定行距、缩进及六级标题独立样式',()=>{
  const html=articleHTML(article,structuredClone(defaults));
  const doc=new DOMParser().parseFromString(html,'text/html');
  const sheet=doc.querySelector('style')!.textContent!;
  expect(sheet).toContain('FangSong');expect(sheet).toContain('FZXiaoBiaoSong-B05S');
  expect(sheet).toContain('line-height: 37.333333333333336px');
  expect(sheet).toContain('text-indent: 2em');
  expect(sheet).toContain('font-weight: 400');
  for(let i=1;i<=6;i++)expect(sheet).toContain(`main h${i}{`);
  expect(sheet).toContain('header h1{');expect(sheet).toContain('line-height: 48px');
 });
 it('修改标题与正文样式在输出中分别保留，不写入脚本',()=>{
  const settings=structuredClone(defaults);
  settings.fontFamily='serif';settings.appearance.headingFonts[5]='monospace';settings.appearance.headingStyles[5]='italic';settings.appearance.titleSize=32;settings.appearance.titleDecoration='underline';
  const html=articleHTML(article,settings),doc=new DOMParser().parseFromString(html,'text/html'),sheet=doc.querySelector('style')!.textContent!;
  expect(sheet).toContain('font-family: serif');expect(sheet).toMatch(/main h6\{[^}]*font-family: monospace/);expect(sheet).toMatch(/main h6\{[^}]*font-style: italic/);expect(sheet).toMatch(/header h1\{[^}]*font-size: 32px/);expect(sheet).toMatch(/header h1\{[^}]*text-decoration: underline/);expect(doc.scripts.length).toBe(0);
 });
 it('CSS值不能逃逸style标签',()=>{
  const settings=structuredClone(defaults);settings.fontFamily='"</style><script>bad()</script>"';
  const html=articleHTML(article,settings),doc=new DOMParser().parseFromString(html,'text/html');
  expect(doc.scripts).toHaveLength(0);expect(html).not.toContain('</style><script>');
 });
});
