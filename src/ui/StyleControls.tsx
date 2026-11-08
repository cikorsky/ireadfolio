import {useEffect,useState} from 'react';
import type {ReactNode} from 'react';
import type {Appearance,Settings,TableAppearance,TextBlockStyle,PageNumberAppearance} from '../types';
import {validateAppearance} from '../core/storage';
import {requestSystemFonts} from '../fonts';
import type {FontOption} from '../fonts';
import {FontSelect} from './FontSelect';
import {pageNumberLabel} from '../document-style';
const alignments=[['default','默认'],['left','左对齐'],['center','居中'],['right','右对齐'],['justify','两端对齐']];
const simpleAlignments=alignments.slice(1,4);
const styles=[['normal','常规'],['italic','斜体']];
const decorations=[['none','无'],['underline','下划线'],['line-through','删除线']];

/** Basic typography stays compact; detailed typography is opt-in per section. */
export function StyleControls({settings,onChange}:{settings:Settings;onChange:(settings:Settings)=>void}){
 const a=settings.appearance;
 const [error,setError]=useState(''),[fonts,setFonts]=useState<FontOption[]>([]),[fontStatus,setFontStatus]=useState('正在读取系统字体…'),[fontBusy,setFontBusy]=useState(false);
 useEffect(()=>{let mounted=true;void requestSystemFonts().then(list=>{if(mounted){setFonts(list);setFontStatus(`已读取 ${list.length} 种系统字体，可下拉选择。`);}}).catch(reason=>{if(mounted)setFontStatus(reason instanceof Error?reason.message:String(reason));});return()=>{mounted=false;};},[]);
 async function refreshFonts(){setFontBusy(true);try{const list=await requestSystemFonts(true);setFonts(list);setFontStatus(`已读取 ${list.length} 种系统字体，可下拉选择。`);}catch(reason){setFontStatus(reason instanceof Error?reason.message:String(reason));}finally{setFontBusy(false);}}
 function update<K extends keyof Appearance>(key:K,value:Appearance[K]){try{const appearance=validateAppearance({...a,[key]:value});setError('');onChange({...settings,appearance});}catch(reason){setError(reason instanceof Error?reason.message:String(reason));}}
 const set=<K extends keyof Settings>(key:K,value:Settings[K])=>onChange({...settings,[key]:value});
 const row=(label:string,control:ReactNode)=><label className="circle-setting-row" data-setting-label={label} key={label}><span>{label}</span>{control}</label>;
 const details=(label:string,children:ReactNode)=><details className="circle-style-details"><summary>{label}</summary><div>{children}</div></details>;
 function numberControl(label:string,value:number,change:(n:number)=>void,min:number,max:number,step=1){
  const apply=(input:HTMLInputElement)=>{const n=input.valueAsNumber;if(Number.isFinite(n))change(Math.max(min,Math.min(max,n)));};
  return row(label,<div className="circle-range"><input aria-label={`${label}滑块`} type="range" min={min} max={max} step={step} value={value} onChange={e=>apply(e.target)}/><input aria-label={label} type="number" min={min} max={max} step="any" value={Number(value.toFixed(3))} onChange={e=>apply(e.target)}/></div>);
 }
 const numeric=(key:keyof Appearance,label:string,min:number,max:number,step=1)=>numberControl(label,Number(a[key]),n=>update(key,n as never),min,max,step);
 const numericSetting=(key:keyof Settings,label:string,min:number,max:number,step=1)=>numberControl(label,Number(settings[key]),n=>set(key,n as never),min,max,step);
 const select=(label:string,value:string,options:string[][],change:(value:string)=>void)=>row(label,<select aria-label={label} value={value} onChange={e=>change(e.target.value)}>{options.map(([key,name])=><option key={key} value={key}>{name}</option>)}</select>);
 const alignment=(key:'textAlign'|'titleAlign'|'imageAlign',label:string)=>select(label,a[key],alignments,v=>update(key,v));
 const colorControl=(label:string,value:string,change:(color:string)=>void)=>row(label,<input aria-label={label} type="color" value={value} onChange={e=>change(e.target.value)}/>);
 const color=(key:'linkColor'|'selectionColor'|'selectionBackground'|'titleColor',label:string)=>colorControl(label,a[key],v=>update(key,v));
 const font=(label:string,value:string,change:(value:string)=>void)=>row(label,<FontSelect label={label} value={value} fonts={fonts} onChange={change}/>);
 const toggle=(label:string,value:boolean,change:(value:boolean)=>void)=>row(label,<input aria-label={label} type="checkbox" role="switch" checked={value} onChange={event=>change(event.target.checked)}/>);
 function headingNumber(index:number,key:'headingSizes'|'headingWeights'|'headingLineHeights'|'headingSpaceBefore'|'headingSpaceAfter'|'headingIndents',label:string,min:number,max:number,step=1){return numberControl(label,a[key][index],value=>update(key,a[key].map((old,i)=>i===index?value:old)),min,max,step);}
 function headingSelect(index:number,key:'headingStyles'|'headingDecorations'|'headingAligns',label:string,options:string[][]){return select(label,a[key][index],options,value=>update(key,a[key].map((old,i)=>i===index?value:old) as never));}
 function metadata<K extends keyof Appearance['metadata']>(key:K,value:Appearance['metadata'][K]){update('metadata',{...a.metadata,[key]:value});}
 function table<K extends keyof TableAppearance>(key:K,value:TableAppearance[K]){update('table',{...a.table,[key]:value});}
 function page<K extends keyof PageNumberAppearance>(key:K,value:PageNumberAppearance[K]){update('pageNumber',{...a.pageNumber,[key]:value});}
 const metaNumber=(key:keyof TextBlockStyle,label:string,min:number,max:number,step=1)=>numberControl(label,Number(a.metadata[key]),n=>metadata(key,n as never),min,max,step);
 const tableNumber=(key:keyof TableAppearance,label:string,min:number,max:number,step=1)=>numberControl(label,Number(a.table[key]),n=>table(key,n as never),min,max,step);
 const pageNumber=(key:keyof PageNumberAppearance,label:string,min:number,max:number,step=1)=>numberControl(label,Number(a.pageNumber[key]),n=>page(key,n as never),min,max,step);
 async function upload(file?:File){if(!file)return;if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type)){setError('请选择 PNG、JPEG、WebP 或 GIF 图片。');return;}if(file.size>2*1024*1024){setError('背景图片不能超过 2 MB。');return;}const reader=new FileReader();reader.onerror=()=>setError('无法读取背景图片，请重试。');reader.onload=()=>{if(typeof reader.result==='string')update('backgroundImage',reader.result);};reader.readAsDataURL(file);}
 return <>
  {error&&<p className="circle-panel-status" role="alert">{error}</p>}
  <div className="circle-font-inventory"><p role="status">{fontStatus}</p><button disabled={fontBusy} onClick={()=>void refreshFonts()}>{fontBusy?'正在刷新…':'刷新系统字体'}</button></div>
  <p className="circle-style-help">Word 1 磅 = 4/3 px，16 磅约 21.333 px。下拉选择本机字体；其他格式在“详细设置”中调整。</p>
  <section className="circle-setting-group" data-style-section="body"><h3>正文样式</h3>
   {font('正文字体',settings.fontFamily,v=>set('fontFamily',v))}{numericSetting('fontSize','字体大小',10,80,.1)}
   {details('正文详细设置',<>
    {numeric('fontWeight','正文粗细',100,900,100)}{select('正文字形',a.fontStyle,styles,v=>update('fontStyle',v as Appearance['fontStyle']))}{select('正文装饰',a.textDecoration,decorations,v=>update('textDecoration',v as Appearance['textDecoration']))}
    {numeric('letterSpacing','字间距（px）',-10,10,.1)}{numeric('textIndent','首行缩进（em）',0,10,.1)}{numeric('paragraphBefore','正文段前（px）',0,160,.5)}{numericSetting('paragraphSpace','段落间距',0,160,.5)}
    {select('正文行距方式',a.lineHeightMode,[['multiple','倍数行距'],['fixed','固定行距']],v=>update('lineHeightMode',v as Appearance['lineHeightMode']))}
    {a.lineHeightMode==='fixed'?numeric('fixedLineHeight','正文固定行距（px）',10,240,.5):numericSetting('lineHeight','行高',1,4,.1)}
    {alignment('textAlign','正文对齐')}{row('正文颜色',<input aria-label="正文颜色" value={settings.color} placeholder="#222222" onChange={e=>set('color',e.target.value)}/>)}
    {row('背景颜色',<input aria-label="背景颜色" value={settings.background} placeholder="#eeeeee 或 CSS 渐变" onChange={e=>set('background',e.target.value)}/>)}
   </>)}
  </section>
  <section className="circle-setting-group" data-style-section="title"><h3>文章主标题</h3>
   {font('主标题字体',a.titleFont,v=>update('titleFont',v))}{numeric('titleSize','主标题字号（px）',10,160,.5)}
   {details('主标题详细设置',<>
    {numeric('titleWeight','主标题粗细',100,900,100)}{select('主标题字形',a.titleStyle,styles,v=>update('titleStyle',v as Appearance['titleStyle']))}{select('主标题装饰',a.titleDecoration,decorations,v=>update('titleDecoration',v as Appearance['titleDecoration']))}
    {color('titleColor','主标题颜色')}{alignment('titleAlign','标题对齐')}{numeric('titleIndent','主标题首行缩进（em）',0,10,.1)}{numeric('titleLineHeight','主标题行距（px）',10,240,.5)}{numeric('titleSpaceBefore','主标题段前（px）',0,240,.5)}{numeric('titleSpaceAfter','主标题段后（px）',0,240,.5)}
   </>)}
  </section>
  <section className="circle-setting-group" data-style-section="metadata" data-setting-label="署名与日期"><h3>署名与日期</h3>
   {font('署名字体',a.metadata.fontFamily,v=>metadata('fontFamily',v))}{metaNumber('fontSize','署名字号（px）',10,80,.5)}
   {details('署名详细设置',<>
    {metaNumber('fontWeight','署名粗细',100,900,100)}{select('署名字形',a.metadata.fontStyle,styles,v=>metadata('fontStyle',v as TextBlockStyle['fontStyle']))}{select('署名装饰',a.metadata.textDecoration,decorations,v=>metadata('textDecoration',v as TextBlockStyle['textDecoration']))}
    {colorControl('署名颜色',a.metadata.color,v=>metadata('color',v))}{select('署名对齐',a.metadata.textAlign,simpleAlignments,v=>metadata('textAlign',v as TextBlockStyle['textAlign']))}
    {metaNumber('lineHeight','署名行距（px）',10,240,.5)}{metaNumber('letterSpacing','署名字间距（px）',-10,10,.1)}{metaNumber('spaceBefore','署名段前（px）',0,240,.5)}{metaNumber('spaceAfter','署名段后（px）',0,240,.5)}
    {toggle('显示字数和阅读时间',a.metadata.showStats,v=>metadata('showStats',v))}
   </>)}
  </section>
  {['一级','二级','三级','四级','五级','六级'].map((name,index)=><section className="circle-setting-group" data-style-section={`heading-${index+1}`} data-setting-label={`${name}标题`} key={name}><h3>{name}标题</h3>
   {font(`${name}标题字体`,a.headingFonts[index],value=>update('headingFonts',a.headingFonts.map((old,i)=>i===index?value:old)))}
   {headingNumber(index,'headingSizes',`${name}标题字号（em）`,.1,5,.05)}
   <p className="circle-style-help">当前约 {Number((a.headingSizes[index]*settings.fontSize).toFixed(3))} px / {Number((a.headingSizes[index]*settings.fontSize*.75).toFixed(2))} 磅</p>
   {details(`${name}标题详细设置`,<>
    {headingNumber(index,'headingWeights',`${name}标题粗细`,100,900,100)}{headingSelect(index,'headingStyles',`${name}标题字形`,styles)}{headingSelect(index,'headingDecorations',`${name}标题装饰`,decorations)}
    {colorControl(`${name}标题颜色`,a.headingColors[index],value=>update('headingColors',a.headingColors.map((old,i)=>i===index?value:old)))}{headingSelect(index,'headingAligns',`${name}标题对齐`,alignments)}
    {headingNumber(index,'headingIndents',`${name}标题首行缩进（em）`,0,10,.1)}{headingNumber(index,'headingLineHeights',`${name}标题行距（px）`,10,240,.5)}{headingNumber(index,'headingSpaceBefore',`${name}标题段前（px）`,0,240,.5)}{headingNumber(index,'headingSpaceAfter',`${name}标题段后（px）`,0,240,.5)}
   </>)}
  </section>)}
  <section className="circle-setting-group" data-style-section="table" data-setting-label="表格样式"><h3>表格样式</h3>
   {font('表格字体',a.table.fontFamily,v=>table('fontFamily',v))}{tableNumber('fontSize','表格字号（px）',10,80,.5)}
   {details('表格详细设置',<>
    {tableNumber('fontWeight','表格粗细',100,900,100)}{select('表格字形',a.table.fontStyle,styles,v=>table('fontStyle',v as TableAppearance['fontStyle']))}{tableNumber('lineHeight','表格行距（px）',10,240,.5)}
    {colorControl('表格文字颜色',a.table.color,v=>table('color',v))}{select('表格文字对齐',a.table.align,simpleAlignments,v=>table('align',v as TableAppearance['align']))}{select('单元格垂直对齐',a.table.cellVerticalAlign,[['top','顶部'],['middle','居中'],['bottom','底部']],v=>table('cellVerticalAlign',v as TableAppearance['cellVerticalAlign']))}
    {font('表头字体',a.table.headerFontFamily,v=>table('headerFontFamily',v))}{tableNumber('headerFontSize','表头字号（px）',10,80,.5)}{tableNumber('headerFontWeight','表头粗细',100,900,100)}
    {colorControl('表头文字颜色',a.table.headerColor,v=>table('headerColor',v))}{colorControl('表头背景颜色',a.table.headerBackground,v=>table('headerBackground',v))}
    {select('表格宽度',a.table.width,[['auto','按内容'],['full','占满正文']],v=>table('width',v as TableAppearance['width']))}
    {select('表格边框',a.table.borderStyle,[['solid','实线'],['dashed','虚线'],['none','无边框']],v=>table('borderStyle',v as TableAppearance['borderStyle']))}{tableNumber('borderWidth','边框宽度（px）',0,8,.25)}{colorControl('边框颜色',a.table.borderColor,v=>table('borderColor',v))}
    {tableNumber('cellPaddingX','单元格横向内边距（px）',0,80,.5)}{tableNumber('cellPaddingY','单元格纵向内边距（px）',0,80,.5)}{toggle('表格隔行底色',a.table.striped,v=>table('striped',v))}{a.table.striped&&colorControl('隔行底色',a.table.stripeColor,v=>table('stripeColor',v))}
   </>)}
  </section>
  <section className="circle-setting-group" data-style-section="page-number" data-setting-label="页码样式"><h3>页码样式</h3>
   {font('页码字体',a.pageNumber.fontFamily,v=>page('fontFamily',v))}{pageNumber('fontSize','页码字号（px）',8,80,.5)}
   {details('页码详细设置',<>
    {toggle('启用打印页码',a.pageNumber.enabled,v=>page('enabled',v))}{colorControl('页码颜色',a.pageNumber.color,v=>page('color',v))}
    {toggle('奇偶页不同',a.pageNumber.differentOddEven,v=>page('differentOddEven',v))}
    {select(a.pageNumber.differentOddEven?'奇数页页码对齐':'页码对齐',a.pageNumber.align,simpleAlignments,v=>page('align',v as PageNumberAppearance['align']))}
    {a.pageNumber.differentOddEven&&select('偶数页页码对齐',a.pageNumber.evenAlign,simpleAlignments,v=>page('evenAlign',v as PageNumberAppearance['evenAlign']))}
    {select('页码格式',a.pageNumber.format,[['dash','— 1 —'],['plain','1'],['page-total','第 1 页 / 共 5 页']],v=>page('format',v as PageNumberAppearance['format']))}
    {pageNumber('start','起始页码',1,9999)}{toggle('首页显示页码',a.pageNumber.firstPage,v=>page('firstPage',v))}{pageNumber('marginBottom','页码距纸张底边（px）',0,240,.5)}
   </>)}
   <p className="circle-style-help">页码示例：{pageNumberLabel(a.pageNumber.start,a.pageNumber.start+4,a.pageNumber.format)}。开启“奇偶页不同”后可分别设置两侧页码位置，用于 DOCX 和 Chrome 打印/PDF。默认距纸张底边约 25 mm，增大此值会将页码上移。请关闭打印窗口中浏览器自带的页眉和页脚。</p>
  </section>
  <section className="circle-setting-group"><h3>代码块样式</h3>{font('代码字体',a.codeFont,v=>update('codeFont',v))}{numeric('codeSize','代码字号',12,50)}{details('代码详细设置',numeric('codeLineHeight','代码行高',1,3,.1))}</section>
  <section className="circle-setting-group"><h3>其他外观</h3>
   {details('图片、链接和背景详细设置',<>
    {alignment('imageAlign','图片对齐')}{toggle('隐藏图片',a.hideImages,v=>update('hideImages',v))}{color('linkColor','链接颜色')}{color('selectionColor','选中文字颜色')}{color('selectionBackground','选中背景颜色')}
    {row('背景图片网址',<input key={a.backgroundImage} aria-label="背景图片网址" defaultValue={a.backgroundImage.startsWith('data:')?'':a.backgroundImage} placeholder="https://…" onBlur={e=>{if(!e.target.value&&a.backgroundImage.startsWith('data:'))return;update('backgroundImage',e.target.value.trim());}}/>)}
    {row('上传背景图片',<input aria-label="上传背景图片" type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={e=>{void upload(e.target.files?.[0]);e.target.value='';}}/>)}
    {a.backgroundImage&&<button onClick={()=>update('backgroundImage','')}>移除背景图片</button>}
   </>)}
   {details('工具栏布局详细设置',<>{numeric('toolbarItemGap','工具栏项距',0,50)}{numeric('toolbarGroupGap','工具栏组距',0,50)}{toggle('隐藏工具栏',a.toolbarAutoHide,v=>update('toolbarAutoHide',v))}</>)}
  </section>
 </>;
}
