import {beforeEach,describe,expect,it,vi} from 'vitest';
import {JSDOM} from 'jsdom';
import {defaults,builtInReadingStyles,legacyAppearance} from '../src/defaults';
import {applyDefaultReadingStyle,applyReadingStyle,captureReadingStyle,getReadingStyles,saveCurrentReadingConfiguration,saveReadingStyle,setDefaultReadingStyle} from '../src/styles';
import {getSettings,saveSettings,validateSettings,validateAppearance,exportBackup,importBackup} from '../src/core/storage';

beforeEach(()=>{vi.unstubAllGlobals();vi.stubGlobal('localStorage',new JSDOM('',{url:'https://styles.test'}).window.localStorage);});
describe('公文模板与独立排版',()=>{
 it('默认忠实采用Word主标题/正文及各级标题，不擅自标题加粗',async()=>{
  const s=await getSettings(),a=s.appearance;
  expect(s.defaultStyleId).toBe('policy-document');expect(s.fontSize).toBeCloseTo(64/3);expect(s.fontFamily).toContain('FangSong_GB2312');expect(s.paragraphSpace).toBe(0);expect(s.width).toBe(794);expect(s.pagePadding).toBe(102);
  expect(a).toMatchObject({fontWeight:400,letterSpacing:-.4,textIndent:2,textAlign:'justify',lineHeightMode:'fixed',fixedLineHeight:112/3,titleSize:88/3,titleWeight:400,titleAlign:'center',titleLineHeight:48,titleSpaceBefore:0,titleSpaceAfter:0});
  expect(a.titleFont).toContain('方正小标宋简体');expect(a.headingFonts[0]).toContain('SimHei');expect(a.headingFonts[1]).toContain('KaiTi_GB2312');expect(a.headingFonts.slice(2).every(font=>font.includes('FangSong_GB2312'))).toBe(true);
  expect(a.headingSizes).toEqual(Array(6).fill(1));expect(a.headingWeights).toEqual(Array(6).fill(400));expect(a.headingLineHeights).toEqual(Array(6).fill(112/3));expect(a.headingIndents).toEqual(Array(6).fill(2));
 });
 it('四个原有预设仍以系统字体及原有排版初始化',()=>{
  const legacy=builtInReadingStyles.filter(style=>style.id!=='policy-document');expect(legacy).toHaveLength(4);
  for(const style of legacy){expect(style.values.fontFamily).toBe('system-ui, sans-serif');expect(style.values.appearance.lineHeightMode).toBe('multiple');expect(style.values.pagePadding).toBe(80);expect(style.values.appearance.headingFonts.every(font=>font==='system-ui, sans-serif')).toBe(true);}
 });
 it('正文/主标题/六级标题的字体和样式独立保存，不共享数组',async()=>{
  const s=await getSettings();s.fontFamily='Arial, sans-serif';s.appearance.fontStyle='italic';s.appearance.textDecoration='underline';s.appearance.paragraphBefore=9;
  s.appearance.titleFont='Georgia, serif';s.appearance.titleColor='#123456';s.appearance.titleStyle='italic';s.appearance.titleSize=32;
  s.appearance.headingFonts=['Arial','Georgia','serif','sans-serif','monospace','SimHei'];s.appearance.headingStyles=['italic','normal','italic','normal','italic','normal'];s.appearance.headingDecorations=['underline','none','line-through','none','underline','none'];s.appearance.headingAligns=['center','right','left','justify','default','center'];s.appearance.headingLineHeights=[24,28,32,36,40,44];s.appearance.headingSpaceBefore=[1,2,3,4,5,6];s.appearance.headingSpaceAfter=[6,5,4,3,2,1];s.appearance.headingIndents=[0,1,2,3,4,5];
  await saveSettings(s);const loaded=await getSettings();expect(loaded).toEqual(s);loaded.appearance.headingFonts[0]='changed';expect((await getSettings()).appearance.headingFonts[0]).toBe('Arial');
 });
});

describe('在线另存与默认样式',()=>{
 it('保存当前配置后，新文章保留图片居中等修改，备份恢复后继续生效',async()=>{
  const settings=structuredClone(defaults);
  settings.appearance.imageAlign='center';settings.fontSize=24;
  const saved=saveCurrentReadingConfiguration(settings);
  expect(saved.savedStyles).toHaveLength(0);
  expect(saved.defaultStyleId).toBe('policy-document');
  expect(builtInReadingStyles[0].values.appearance.imageAlign).toBe(defaults.appearance.imageAlign);
  await saveSettings(saved);
  expect(applyDefaultReadingStyle(await getSettings()).appearance.imageAlign).toBe('center');
  const draft=await getSettings();draft.appearance.imageAlign='left';draft.fontSize=30;
  expect(applyDefaultReadingStyle(draft)).toMatchObject({fontSize:24,appearance:{imageAlign:'center'}});
  const backup=await exportBackup();localStorage.clear();await importBackup(backup);
  expect(applyDefaultReadingStyle(await getSettings())).toMatchObject({fontSize:24,appearance:{imageAlign:'center'}});
 });
 it('重新指定默认样式后使用所选样式，已有命名快照仍独立保存',()=>{
  const settings=saveReadingStyle(structuredClone(defaults),'已有样式');
  const snapshot=structuredClone(settings.savedStyles[0]);
  settings.appearance.imageAlign='center';
  const saved=saveCurrentReadingConfiguration(settings);
  expect(saved.savedStyles[0]).toEqual(snapshot);
  const switched=setDefaultReadingStyle(saved,'default');
  expect(switched.defaultStyleOverride).toBeNull();
  expect(applyDefaultReadingStyle(switched).appearance.imageAlign).toBe('default');
  expect(switched.savedStyles[0]).toEqual(snapshot);
 });
 it('旧配置兼容加载，非法的当前配置在备份导入前被拒绝',async()=>{
  const legacy=JSON.parse(JSON.stringify(defaults));delete legacy.defaultStyleOverride;
  expect(validateSettings(legacy).defaultStyleOverride).toBeNull();
  const saved=saveCurrentReadingConfiguration(structuredClone(defaults));await saveSettings(saved);
  const backup=await exportBackup(),before=localStorage.getItem('circle.replica.settings');
  const invalid={...captureReadingStyle(defaults),modules:{gallery:false}};
  await expect(importBackup({...backup,settings:{...saved,defaultStyleOverride:invalid}})).rejects.toThrow();
  expect(localStorage.getItem('circle.replica.settings')).toBe(before);
 });
 it('另存两套独立样式，并且应用样式不改快捷键、模块和工具栏位置',()=>{
  const original=structuredClone(defaults);original.appearance.toolbarX=45;original.appearance.toolbarItemGap=23;original.shortcuts.toggle='r r';original.modules.gallery=false;
  const first=saveReadingStyle(original,'我的法规样式');expect(original.savedStyles).toHaveLength(0);expect(first.savedStyles).toHaveLength(1);
  const changed={...first,fontSize:26,appearance:{...first.appearance,titleFont:'Arial',headingFonts:Array(6).fill('Georgia')}};
  const second=saveReadingStyle(changed,'我的简报样式');expect(second.savedStyles).toHaveLength(2);expect(first.savedStyles[0].values.fontSize).toBeCloseTo(64/3);
  const snapshot=second.savedStyles[0];expect(snapshot.values.appearance).not.toHaveProperty('toolbarX');expect(snapshot.values.appearance).not.toHaveProperty('toolbarItemGap');
  second.appearance.toolbarX=90;const restored=applyReadingStyle(second,snapshot);expect(restored.fontSize).toBeCloseTo(64/3);expect(restored.appearance.toolbarX).toBe(90);expect(restored.appearance.toolbarItemGap).toBe(23);expect(restored.shortcuts.toggle).toBe('r r');expect(restored.modules.gallery).toBe(false);
  restored.appearance.headingFonts[0]='different';expect(snapshot.values.appearance.headingFonts[0]).not.toBe('different');
 });
 it('设为默认后新阅读应用保存快照，当前草稿仍可独立持久化',async()=>{
  let settings=saveReadingStyle({...structuredClone(defaults),fontSize:25},'工作报告');const id=settings.savedStyles[0].id;
  settings=setDefaultReadingStyle(settings,id);expect(settings.defaultStyleId).toBe(id);expect(settings.fontSize).toBe(25);
  settings.fontSize=31;await saveSettings(settings);const draft=await getSettings();expect(draft.fontSize).toBe(31);expect(applyDefaultReadingStyle(draft).fontSize).toBe(25);expect(getReadingStyles(draft)).toHaveLength(6);
 });
 it('另存不覆盖同名样式，空名、过长名、超额与不存在的默认样式明确拒绝',()=>{
  const settings=saveReadingStyle(structuredClone(defaults),'工作报告');
  for(const name of ['','   ','工作报告','江河公文','x'.repeat(81)])expect(()=>saveReadingStyle(settings,name)).toThrow();
  expect(()=>setDefaultReadingStyle(settings,'missing')).toThrow('不存在');
  expect(()=>saveReadingStyle({...settings,savedStyles:Array.from({length:100},(_,i)=>({...settings.savedStyles[0],id:`custom-${i}`,name:`name-${i}`}))},'第101套')).toThrow('最多');
 });
});

describe('样式数据升级与备份',()=>{
 it('旧安装外观留作独立快照并应用公文模板，读取不写入避免并发覆盖',async()=>{
  const legacy:Record<string,unknown>={...structuredClone(defaults),fontSize:24,fontFamily:'Georgia, serif',paragraphSpace:18,appearance:{...structuredClone(legacyAppearance),fontWeight:700,toolbarX:155,toolbarY:233},shortcuts:{toggle:'q q'},modules:{gallery:false}};delete legacy.savedStyles;delete legacy.defaultStyleId;delete (legacy.appearance as Record<string,unknown>).toolbarAnchor;
  const raw=JSON.stringify(legacy);localStorage.setItem('circle.replica.settings',raw);localStorage.setItem('other-app','kept');
  const upgraded=await getSettings();expect(localStorage.getItem('circle.replica.settings')).toBe(raw);expect(upgraded.fontFamily).toBe(defaults.fontFamily);expect(upgraded.defaultStyleId).toBe('policy-document');expect(upgraded.savedStyles).toHaveLength(1);expect(upgraded.savedStyles[0]).toMatchObject({id:'pre-template',name:'升级前阅读样式',values:{fontSize:24,fontFamily:'Georgia, serif',paragraphSpace:18}});
  expect(upgraded.savedStyles[0].values.appearance.fontWeight).toBe(700);expect(upgraded.shortcuts.toggle).toBe('q q');expect(upgraded.modules.gallery).toBe(false);expect(upgraded.appearance.toolbarX).toBe(-1);
  await saveSettings(upgraded);expect((await getSettings()).savedStyles).toHaveLength(1);expect(localStorage.getItem('other-app')).toBe('kept');
 });
 it('备份往返保留命名样式和默认选择',async()=>{
  const first=saveReadingStyle({...structuredClone(defaults),fontSize:28},'可备份样式');await saveSettings(setDefaultReadingStyle(first,first.savedStyles[0].id));const backup=await exportBackup();localStorage.clear();await importBackup(backup);expect((await getSettings()).savedStyles).toEqual(first.savedStyles);expect((await getSettings()).defaultStyleId).toBe(first.savedStyles[0].id);
 });
 it('旧版合法的大字号大标题迁移为可保存的降级副本，保留非样式设置',async()=>{
  const legacy:Record<string,unknown>={...structuredClone(defaults),fontSize:80,appearance:{...structuredClone(legacyAppearance),headingSizes:Array(6).fill(5),toolbarX:85},shortcuts:{toggle:'z z'},blacklist:['private.example.com']};delete legacy.savedStyles;delete legacy.defaultStyleId;delete (legacy.appearance as Record<string,unknown>).toolbarAnchor;
  localStorage.setItem('circle.replica.settings',JSON.stringify(legacy));const migrated=await getSettings();const prior=migrated.savedStyles[0].values;
  expect(prior.fontSize).toBe(80);expect(prior.appearance.headingSizes).toEqual(Array(6).fill(5));expect(prior.appearance.headingLineHeights).toEqual(Array(6).fill(240));expect(prior.appearance.headingSpaceBefore).toEqual(Array(6).fill(240));expect(prior.appearance.headingSpaceAfter).toEqual(Array(6).fill(240));expect(prior.appearance.titleLineHeight).toBeLessThanOrEqual(240);
  await saveSettings(migrated);const loaded=await getSettings();expect(loaded.savedStyles).toEqual(migrated.savedStyles);expect(loaded.shortcuts.toggle).toBe('z z');expect(loaded.blacklist).toEqual(['private.example.com']);expect(loaded.appearance.toolbarX).toBe(-1);
 });
 it('旧版合法的极低标题倍率迁移时行距不低于10px，副本仍可保存',async()=>{
  const legacy:Record<string,unknown>={...structuredClone(defaults),fontSize:12,appearance:{...structuredClone(legacyAppearance),headingSizes:Array(6).fill(.1)}};delete legacy.savedStyles;delete legacy.defaultStyleId;delete (legacy.appearance as Record<string,unknown>).toolbarAnchor;
  localStorage.setItem('circle.replica.settings',JSON.stringify(legacy));const migrated=await getSettings();expect(migrated.savedStyles[0].values.appearance.headingLineHeights).toEqual(Array(6).fill(10));expect(migrated.savedStyles[0].values.appearance.headingSizes).toEqual(Array(6).fill(.1));await saveSettings(migrated);expect((await getSettings()).savedStyles).toEqual(migrated.savedStyles);
 });
 it('合并保留本地与备份所有样式，同名异编号重命名且重导入不会重复，旧备份也不清空样式库',async()=>{
  const local=saveReadingStyle(structuredClone(defaults),'工作报告');await saveSettings(local);
  let incoming=saveReadingStyle({...structuredClone(defaults),fontSize:27},'工作报告');incoming=setDefaultReadingStyle(incoming,incoming.savedStyles[0].id);
  const backup={version:1,createdAt:1,settings:incoming,articles:[],annotations:[]};await importBackup(backup);
  const merged=await getSettings();expect(merged.savedStyles.map(style=>style.name)).toEqual(['工作报告','工作报告（导入2）']);expect(merged.savedStyles[0]).toEqual(local.savedStyles[0]);expect(merged.savedStyles[1].id).toBe(incoming.savedStyles[0].id);expect(merged.defaultStyleId).toBe(incoming.savedStyles[0].id);expect(applyDefaultReadingStyle(merged).fontSize).toBe(27);
  await importBackup(backup);expect((await getSettings()).savedStyles).toEqual(merged.savedStyles);
  const legacy:Record<string,unknown>={...structuredClone(defaults)};delete legacy.savedStyles;delete legacy.defaultStyleId;delete (legacy.appearance as Record<string,unknown>).toolbarAnchor;await importBackup({...backup,settings:legacy});expect((await getSettings()).savedStyles).toEqual(merged.savedStyles);
  await importBackup({...backup,settings:legacy},'replace');expect((await getSettings()).savedStyles).toEqual([]);
 });
 it('同编号不同快照或合并超过100套均在首写前拒绝，文章和设置保持原样',async()=>{
  const saved=saveReadingStyle(structuredClone(defaults),'本地快照');await saveSettings(saved);const before=await exportBackup();const raw=localStorage.getItem('circle.replica.settings');
  const conflict=structuredClone(saved);conflict.savedStyles[0].values.fontSize=39;
  await expect(importBackup({...before,settings:conflict})).rejects.toThrow('冲突');expect(localStorage.getItem('circle.replica.settings')).toBe(raw);expect((await exportBackup()).articles).toEqual(before.articles);
  const filled={...saved,savedStyles:Array.from({length:100},(_,i)=>({...structuredClone(saved.savedStyles[0]),id:`local-${i}`,name:`本地-${i}`}))};await saveSettings(filled);const fullRaw=localStorage.getItem('circle.replica.settings');
  const incoming=saveReadingStyle(structuredClone(defaults),'第101套');await expect(importBackup({...before,settings:incoming})).rejects.toThrow('超过100');expect(localStorage.getItem('circle.replica.settings')).toBe(fullRaw);
 });
 it('同名样式导入编号递增，截断长名后仍不超80字',async()=>{
  const name='长'.repeat(80),first=saveReadingStyle(structuredClone(defaults),name);await saveSettings(first);const incoming=saveReadingStyle(structuredClone(defaults),name),backup={version:1,createdAt:1,settings:incoming,articles:[],annotations:[]};await importBackup(backup);
  const third=saveReadingStyle(structuredClone(defaults),name);await importBackup({...backup,settings:third});const names=(await getSettings()).savedStyles.map(style=>style.name);expect(names).toHaveLength(3);expect(names[1]).toBe(name.slice(0,75)+'（导入2）');expect(names[2]).toBe(name.slice(0,75)+'（导入3）');expect(names.every(value=>value.length===80)).toBe(true);
 });
 it('拒绝未知嵌套字段、无效数组、CSS字体注入、重复样式及损坏默认引用，导入前后数据不变',async()=>{
  const saved=saveReadingStyle(structuredClone(defaults),'合法样式');await saveSettings(saved);const backup=await exportBackup();const valid=saved.savedStyles[0];
  const invalidStyles=[{...valid,name:' '},{...valid,extra:true},{...valid,values:{...valid.values,modules:{gallery:false}}},{...valid,values:{...valid.values,appearance:{...valid.values.appearance,toolbarX:1}}},{...valid,values:{...valid.values,appearance:{...valid.values.appearance,headingFonts:['Arial']}}},{...valid,values:{...valid.values,appearance:{...valid.values.appearance,titleFont:'Arial; color:red'}}},{...valid,values:{...valid.values,appearance:{...valid.values.appearance,headingStyles:Array(6).fill('bold')}}},{...valid,values:{...valid.values,appearance:{...valid.values.appearance,headingLineHeights:Array(6).fill(Infinity)}}}];
  const before=localStorage.getItem('circle.replica.settings');
  for(const style of invalidStyles)await expect(importBackup({...backup,settings:{...backup.settings,savedStyles:[style]}})).rejects.toThrow();
  expect(()=>validateSettings({...saved,savedStyles:[valid,valid]})).toThrow('重复');expect(()=>validateSettings({...saved,defaultStyleId:'not-found'})).toThrow('不存在');
  expect(()=>validateAppearance({headingDecorations:Array(6).fill('overline')})).toThrow();expect(()=>validateAppearance({fontStyle:{value:'italic'}})).toThrow();expect(()=>validateAppearance({letterSpacing:-11})).toThrow();expect(validateAppearance({letterSpacing:-.4}).letterSpacing).toBe(-.4);
  const cycle:Record<string,unknown>={};cycle.values=cycle;expect(()=>validateSettings({...saved,savedStyles:[cycle]})).toThrow();
  expect(localStorage.getItem('circle.replica.settings')).toBe(before);expect(captureReadingStyle(await getSettings())).toEqual(captureReadingStyle(saved));
 });
});
