import {beforeEach,describe,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import type {Article} from '../src/types';
import {getTaxonomy,saveTaxonomy,renameTaxonomyItem,deleteTaxonomyItem,saveArticle,getArticles,exportBackup,importBackup,getSettings,saveSettings} from '../src/core/storage';
function article(id='a'):Article{return{id,url:`https://example.test/${id}`,title:'测试正文',text:'测试正文',html:'<p>测试正文</p>',author:'',published:'',excerpt:'',savedAt:Date.now(),tags:[],category:'',archived:false};}
beforeEach(()=>vi.stubGlobal('localStorage',new JSDOM('',{url:'https://test.local'}).window.localStorage));
describe('独立分类与标签',()=>{
 it('没有文章时也能保存空分类/标签，保持用户排序，读取值独立',async()=>{
  await saveTaxonomy({categories:['资料库','项目'],tags:['待核对','已审']});
  expect(await getArticles()).toHaveLength(0);const groups=await getTaxonomy();expect(groups.categories).toEqual(['资料库','项目']);groups.categories.reverse();expect((await getTaxonomy()).categories).toEqual(['资料库','项目']);
  await saveTaxonomy({categories:['项目','资料库'],tags:['已审','待核对']});expect(await getTaxonomy()).toEqual({categories:['项目','资料库'],tags:['已审','待核对']});
 });
 it('兼容从旧文章派生分类标签，先保留独立分类顺序再补齐',async()=>{
  localStorage.setItem('circle.replica.article.legacy',JSON.stringify({...article('legacy'),category:'旧分类',tags:['旧标签']}));
  await saveTaxonomy({categories:['空分类'],tags:['空标签']});expect(await getTaxonomy()).toEqual({categories:['空分类','旧分类'],tags:['空标签','旧标签']});
 });
 it('保存文章会留下独立分类，清空文章关联后空分类仍保留',async()=>{
  const a={...article(),category:'项目资料',tags:['研究']};await saveArticle(a);await saveArticle({...a,category:'',tags:[]});expect(await getTaxonomy()).toEqual({categories:['项目资料'],tags:['研究']});
 });
 it('重命名分类和标签更新正常、归档及回收站文章，不删文章',async()=>{
  for(const a of [article('normal'),{...article('archive'),archived:true},{...article('trash'),deletedAt:Date.now()}])await saveArticle({...a,category:'旧分类',tags:['旧标签','保留']});
  await renameTaxonomyItem('categories','旧分类','新分类');await renameTaxonomyItem('tags','旧标签','新标签');expect(await getArticles()).toHaveLength(3);for(const a of await getArticles()){expect(a.category).toBe('新分类');expect(a.tags).toEqual(['新标签','保留']);}
  expect(await getTaxonomy()).toEqual({categories:['新分类'],tags:['新标签','保留']});
 });
 it('删除分类标签仅解除关联，保留文章、其他标签和空分类',async()=>{
  await saveArticle({...article(),category:'删除分类',tags:['删除标签','其他标签']});await saveTaxonomy({categories:['空分类','删除分类'],tags:['删除标签','其他标签']});
  await deleteTaxonomyItem('categories','删除分类');await deleteTaxonomyItem('tags','删除标签');expect(await getArticles()).toHaveLength(1);expect((await getArticles())[0]).toMatchObject({category:'',tags:['其他标签']});expect(await getTaxonomy()).toEqual({categories:['空分类'],tags:['其他标签']});
 });
 it('无效名称、重复名称和重命名冲突不会修改分类文章',async()=>{
  await saveTaxonomy({categories:['甲','乙'],tags:[]});await saveArticle({...article(),category:'甲'});
  await expect(renameTaxonomyItem('categories','甲','乙')).rejects.toThrow('已存在');await expect(renameTaxonomyItem('categories','甲','  ')).rejects.toThrow('名称');await expect(saveTaxonomy({categories:['甲','甲'],tags:[]})).rejects.toThrow('不重复');expect((await getArticles())[0].category).toBe('甲');expect((await getTaxonomy()).categories).toEqual(['甲','乙']);
 });
});
describe('分类标签备份迁移',()=>{
 it('备份往返保留空分类、标签和排序',async()=>{
  const taxonomy={categories:['Z目录','A目录'],tags:['后补','优先']};await saveTaxonomy(taxonomy);const backup=await exportBackup();expect(backup.taxonomy).toEqual(taxonomy);localStorage.clear();await importBackup(backup);expect(await getTaxonomy()).toEqual(taxonomy);
 });
 it('合并保留现有顺序并追加新项，替换采用备份顺序',async()=>{
  await saveTaxonomy({categories:['先有'],tags:['先有标签']});const backup=await exportBackup();backup.taxonomy={categories:['新二','新一'],tags:['新标签']};await importBackup(backup,'merge');expect((await getTaxonomy()).categories).toEqual(['先有','新二','新一']);await importBackup(backup,'replace');expect(await getTaxonomy()).toEqual(backup.taxonomy);
 });
 it('旧备份无taxonomy仍可导入，按文章补齐且不丢空分类',async()=>{
  await saveArticle({...article(),category:'文章分类',tags:['文章标签']});const backup=await exportBackup();delete backup.taxonomy;localStorage.clear();await saveTaxonomy({categories:['现有空分类'],tags:[]});await importBackup(backup,'merge');expect(await getTaxonomy()).toEqual({categories:['现有空分类','文章分类'],tags:['文章标签']});
 });
 it('拒绝异常分类备份时不写任何设置、文章或分类',async()=>{
  await saveTaxonomy({categories:['保留'],tags:['保留']});const before=await exportBackup();for(const taxonomy of [null,[],{categories:'x',tags:[]},{categories:[],tags:[1]},{categories:['重复','重复'],tags:[]}])await expect(importBackup({...before,taxonomy})).rejects.toThrow();expect(await getTaxonomy()).toEqual(before.taxonomy);expect((await getSettings()).fontSize).toBe(before.settings.fontSize);
 });
});
describe('工具栏位置持久化',()=>{
 it('兼容默认位置，持久化拖动位置且拒绝超界或非法类型',async()=>{
  const settings=await getSettings();expect(settings.appearance).toMatchObject({toolbarX:-1,toolbarY:-1});settings.appearance.toolbarX=320;settings.appearance.toolbarY=125;await saveSettings(settings);expect((await getSettings()).appearance).toMatchObject({toolbarX:320,toolbarY:125});const b=await exportBackup();for(const toolbarX of [-10001,10001,'300',NaN])await expect(importBackup({...b,settings:{...b.settings,appearance:{...b.settings.appearance,toolbarX}}})).rejects.toThrow();
 });
});
