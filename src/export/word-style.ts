import {AlignmentType,LineRuleType,UnderlineType} from 'docx';
import type {IParagraphStylePropertiesOptions,IRunStylePropertiesOptions,IParagraphStyleOptions} from 'docx';
import {requestSystemFonts} from '../fonts';
import type {Settings,TextBlockStyle} from '../types';

export const twips=(px:number)=>Math.round(px*15);
export const color=(value:string,fallback='1b1b1b')=>/^#[0-9a-f]{6}$/i.test(value)?value.slice(1):fallback;
export const alignment=(value:string)=>value==='center'?AlignmentType.CENTER:value==='right'?AlignmentType.RIGHT:value==='justify'?AlignmentType.JUSTIFIED:AlignmentType.LEFT;
export interface WordStyle {id:string;run:IRunStylePropertiesOptions;paragraph:IParagraphStylePropertiesOptions}

/** A CSS stack is not a Word font name. Prefer the first family installed locally. */
export async function fontResolver():Promise<(stack:string)=>string>{
 const installed=await requestSystemFonts().catch(()=>[]);
 const names=new Map(installed.flatMap(f=>[[f.fontId.toLowerCase(),f.fontId],[f.displayName.toLowerCase(),f.fontId]]));
 const generic:Record<string,string>={'serif':'SimSun','sans-serif':'Arial','system-ui':'Arial','monospace':'Consolas'};
 return stack=>{
  const families=stack.split(',').map(name=>name.trim().replace(/^["']|["']$/g,''));
  for(const family of families){const match=names.get(family.toLowerCase());if(match)return match;}
  const first=families.find(family=>family&&!Object.hasOwn(generic,family.toLowerCase()));
  return first||generic[families[0]?.toLowerCase()]||'SimSun';
 };
}

export function makeWordStyles(s:Settings,font:(stack:string)=>string){
 const a=s.appearance;
 const run=(family:string,size:number,weight:number,italic:string,decoration:string,ink:string,spacing=0):IRunStylePropertiesOptions=>{
  const name=font(family);
  return {font:{ascii:name,hAnsi:name,eastAsia:name,cs:name},size:Math.round(size*1.5),sizeComplexScript:Math.round(size*1.5),bold:weight>=600,boldComplexScript:weight>=600,italics:italic==='italic',italicsComplexScript:italic==='italic',strike:decoration==='line-through',underline:{type:decoration==='underline'?UnderlineType.SINGLE:UnderlineType.NONE},color:color(ink),characterSpacing:twips(spacing),snapToGrid:false};
 };
 const paragraph=(align:string,line:number,before:number,after:number,indent=0,multiple=false):IParagraphStylePropertiesOptions=>({alignment:alignment(align),spacing:{line:multiple?Math.round(line*240):twips(line),lineRule:multiple?LineRuleType.AUTO:LineRuleType.EXACT,before:twips(before),after:twips(after)},indent:{firstLine:twips(indent)},contextualSpacing:false});
 const textBlock=(id:string,m:TextBlockStyle):WordStyle=>({id,run:run(m.fontFamily,m.fontSize,m.fontWeight,m.fontStyle,m.textDecoration,m.color,m.letterSpacing),paragraph:paragraph(m.textAlign,m.lineHeight,m.spaceBefore,m.spaceAfter)});
 const body:WordStyle={id:'Normal',run:run(s.fontFamily,s.fontSize,a.fontWeight,a.fontStyle,a.textDecoration,s.color,a.letterSpacing),paragraph:paragraph(a.textAlign,a.lineHeightMode==='fixed'?a.fixedLineHeight:s.lineHeight,a.paragraphBefore,s.paragraphSpace,a.textIndent*s.fontSize,a.lineHeightMode!=='fixed')};
 const title:WordStyle={id:'Title',run:run(a.titleFont,a.titleSize,a.titleWeight,a.titleStyle,a.titleDecoration,a.titleColor,a.letterSpacing),paragraph:{...paragraph(a.titleAlign==='default'?'left':a.titleAlign,a.titleLineHeight,a.titleSpaceBefore,a.titleSpaceAfter,a.titleIndent*a.titleSize),keepNext:true}};
 const headings:WordStyle[]=Array.from({length:6},(_,i)=>({id:`Heading${i+1}`,run:run(a.headingFonts[i],s.fontSize*a.headingSizes[i],a.headingWeights[i],a.headingStyles[i],a.headingDecorations[i],a.headingColors[i],a.letterSpacing),paragraph:{...paragraph(a.headingAligns[i]==='default'?'left':a.headingAligns[i],a.headingLineHeights[i],a.headingSpaceBefore[i],a.headingSpaceAfter[i],a.headingIndents[i]*s.fontSize*a.headingSizes[i]),outlineLevel:i,keepNext:true}}));
 const signature=textBlock('Signature',a.metadata);
 const t=a.table;
 const table:WordStyle={id:'TableBody',run:run(t.fontFamily,t.fontSize,t.fontWeight,t.fontStyle,'none',t.color),paragraph:paragraph(t.align,t.lineHeight,0,0)};
 const tableHeader:WordStyle={id:'TableHeader',run:run(t.headerFontFamily,t.headerFontSize,t.headerFontWeight,t.fontStyle,'none',t.headerColor),paragraph:table.paragraph};
 const code:WordStyle={id:'CodeBlock',run:run(a.codeFont,a.codeSize,400,'normal','none',s.color),paragraph:paragraph('left',a.codeSize*a.codeLineHeight,0,s.paragraphSpace)};
 const p=a.pageNumber;
 const page:WordStyle={id:'PageNumber',run:run(p.fontFamily,p.fontSize,400,'normal','none',p.color),paragraph:paragraph(p.align,Math.max(p.fontSize*1.2,20),0,0)};
 const source:WordStyle={...body,id:'Source',paragraph:{...body.paragraph,indent:{firstLine:0},spacing:{...body.paragraph.spacing,before:240}}};
 const all=[body,title,...headings,signature,table,tableHeader,code,page,source];
 const definitions:IParagraphStyleOptions[]=all.map(style=>({id:style.id,name:style.id,quickFormat:true,next:'Normal',...style.id!=='Normal'?{basedOn:'Normal'}:{},run:style.run,paragraph:style.paragraph}));
 return {body,title,headings,signature,table,tableHeader,code,page,source,definitions};
}
