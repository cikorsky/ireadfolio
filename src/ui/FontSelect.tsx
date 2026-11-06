import type {FontOption} from '../fonts';
import {fontFamilyFor} from '../fonts';

const genericFonts=[['system-ui, sans-serif','系统界面字体'],['serif','通用衬线字体'],['sans-serif','通用无衬线字体'],['monospace','通用等宽字体']];

/** Native selects support keyboard type-ahead and do not accept unlisted font names. */
export function FontSelect({label,value,onChange,fonts}:{label:string;value:string;onChange:(value:string)=>void;fonts:FontOption[]}){
 const options=fonts.map(font=>({...font,value:fontFamilyFor(font.fontId)}));
 const listed=options.some(font=>font.value===value)||genericFonts.some(([id])=>id===value);
 const families=value.split(',').map(name=>name.trim().replace(/^["']|["']$/g,''));
 const installed=families.map(family=>fonts.find(font=>font.fontId===family||font.displayName===family)).find(Boolean);
 const currentName=installed?.displayName||families[0]||value;
 return <select aria-label={label} value={value} onChange={event=>onChange(event.target.value)}>
  {!listed&&<option value={value}>当前样式：{currentName}</option>}
  <optgroup label="通用字体">{genericFonts.map(([id,name])=><option key={id} value={id}>{name}</option>)}</optgroup>
  {options.length>0&&<optgroup label="系统已安装字体">{options.map(font=><option key={font.fontId} value={font.value}>{font.displayName}{font.displayName!==font.fontId?` · ${font.fontId}`:''}</option>)}</optgroup>}
 </select>;
}
