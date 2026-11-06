import {afterEach,describe,it,expect,vi} from 'vitest';
import {normalizeSystemFonts,fontFamilyFor,querySystemFonts,requestSystemFonts} from '../src/fonts';

afterEach(()=>vi.unstubAllGlobals());
describe('真实系统字体列表边界',()=>{
 it('去重排序并拒绝不安全名称，保留字体的原始标识',()=>{
  const result=normalizeSystemFonts([{fontId:'SimHei',displayName:'黑体'},{fontId:'FangSong',displayName:'仿宋'},{fontId:'SimHei',displayName:'重复'},null,{fontId:'bad; color:red'},{fontId:'bad\nfont'},{fontId:'"break"'},{fontId:'Valid Font'}]);
  expect(result).toHaveLength(3);expect(result.find(font=>font.fontId==='SimHei')?.displayName).toBe('黑体');expect(result.some(font=>font.fontId==='FangSong')).toBe(true);
  expect(fontFamilyFor('方正小标宋简体')).toBe('"方正小标宋简体", serif');
  expect(()=>fontFamilyFor('bad;}body{}')).toThrow();expect(()=>normalizeSystemFonts({fonts:[]})).toThrow();
 });
 it('只调用浏览器读取API，不修改浏览器字体设置',async()=>{
  const getFontList=vi.fn(async()=>[{fontId:'KaiTi',displayName:'楷体'}]),setFont=vi.fn();
  vi.stubGlobal('chrome',{fontSettings:{getFontList,setFont}});
  expect(await querySystemFonts()).toEqual([{fontId:'KaiTi',displayName:'楷体'}]);expect(getFontList).toHaveBeenCalledTimes(1);expect(setFont).not.toHaveBeenCalled();
 });
 it('不支持系统字体枚举时明确报错，不把候选字体冒充已安装',async()=>{
  vi.stubGlobal('chrome',{});await expect(querySystemFonts()).rejects.toThrow('未提供系统字体列表');
 });
 it('UI通过扩展后台读取列表，同一会话复用结果，刷新会重新请求',async()=>{
  const sendMessage=vi.fn(async()=>({ok:true,fonts:[{fontId:'SimSun',displayName:'宋体'}]}));
  vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage}});
  const first=requestSystemFonts(true),second=requestSystemFonts();expect(first).toBe(second);
  expect(await first).toEqual([{fontId:'SimSun',displayName:'宋体'}]);expect(sendMessage).toHaveBeenCalledWith({type:'FONT_LIST'});expect(sendMessage).toHaveBeenCalledTimes(1);
  await requestSystemFonts(true);expect(sendMessage).toHaveBeenCalledTimes(2);
 });
 it('拒绝后台失败或非法结果，失败后可重试',async()=>{
  const sendMessage=vi.fn().mockResolvedValueOnce({ok:false,error:'权限不可用'}).mockResolvedValueOnce({ok:true,fonts:'bad'}).mockResolvedValue({ok:true,fonts:[{fontId:'FangSong',displayName:'仿宋'}]});
  vi.stubGlobal('chrome',{runtime:{id:'test',sendMessage}});
  await expect(requestSystemFonts(true)).rejects.toThrow('权限不可用');await expect(requestSystemFonts()).rejects.toThrow('格式无效');expect((await requestSystemFonts())[0].fontId).toBe('FangSong');
 });
});
