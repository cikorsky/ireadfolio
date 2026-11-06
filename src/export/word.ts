import {Document as WordDocument,Paragraph,TextRun,Table,TableRow,TableCell,ImageRun,ExternalHyperlink,Packer,WidthType,BorderStyle,VerticalAlign,Footer,PageNumber,LineRuleType} from 'docx';
import type {IRunStylePropertiesOptions} from 'docx';
import {signatureLines,pageFooterLayout} from '../document-style';
import {defaults} from '../defaults';
import type {Article,Settings} from '../types';
import {articleDocument,sourceURL} from './content';
import {prepareWordImage,fitWordImage} from './word-images';
import {makeWordStyles,fontResolver,twips,color,alignment} from './word-style';
import type {WordStyle} from './word-style';

type Run=TextRun|ImageRun|ExternalHyperlink;
type Block=Paragraph|Table;
type Styles=ReturnType<typeof makeWordStyles>;
interface Context {settings:Settings;styles:Styles;maxImageWidth:number;cell?:WordStyle}
function paragraph(style:WordStyle,children:Run[],extra:Partial<WordStyle['paragraph']>={},images=children.some(child=>child instanceof ImageRun)):Paragraph {
 return new Paragraph({style:style.id,...style.paragraph,...extra,...images?{spacing:{...style.paragraph.spacing,...extra.spacing,lineRule:LineRuleType.AT_LEAST}}:{},run:style.run,children});
}

async function inline(node:Node,context:Context,style:IRunStylePropertiesOptions,semantic=true):Promise<Run[]> {
 if(node.nodeType===Node.TEXT_NODE)return [new TextRun({text:node.textContent||'',...style})];
 if(!(node instanceof Element))return [];
 const tag=node.tagName.toLowerCase();
 if(tag==='br')return [new TextRun({...style,break:1})];
 if(tag==='img'){
  const src=node.getAttribute('src');if(!src||context.settings.appearance.hideImages)return [];
  const image=await prepareWordImage(src);
  const requestedWidth=Number(node.getAttribute('width'));
  const {width,height}=fitWordImage(image,Math.min(requestedWidth>0?requestedWidth:Infinity,context.maxImageWidth),Number(node.getAttribute('height')));
  return [new ImageRun({data:image.bytes,type:image.type,transformation:{width,height},altText:{title:node.getAttribute('alt')||'',description:node.getAttribute('alt')||'',name:'文章图片'}})];
 }
 const next:IRunStylePropertiesOptions={...style,
  ...semantic&&['b','strong'].includes(tag)?{bold:true,boldComplexScript:true}:{},
  ...semantic&&['i','em'].includes(tag)?{italics:true,italicsComplexScript:true}:{},
  ...semantic&&['s','del'].includes(tag)?{strike:true}:{},
  ...semantic&&tag==='u'?{underline:{type:'single'}}:{},
  ...semantic&&['code','pre'].includes(tag)?context.styles.code.run:{},
 };
 const children=(await Promise.all([...node.childNodes].map(child=>inline(child,context,next,semantic)))).flat();
 if(tag==='a'){
  const href=node.getAttribute('href');
  if(href&&/^(https?:|mailto:)/i.test(href))return [new ExternalHyperlink({link:href,children})];
 }
 return children;
}

async function table(node:Element,context:Context):Promise<Table|undefined>{
 const t=context.settings.appearance.table;
 const border={style:t.borderStyle==='none'||!t.borderWidth?BorderStyle.NONE:t.borderStyle==='dashed'?BorderStyle.DASHED:BorderStyle.SINGLE,size:t.borderWidth?Math.max(1,Math.round(t.borderWidth*6)):0,color:color(t.borderColor)};
 const rows:TableRow[]=[];
 // Only direct rows belong to this table; nested tables are handled recursively.
 const sourceRows=[...node.querySelectorAll('tr')].filter(row=>row.closest('table')===node);
 // Spans come from untrusted pages. Bound both individual spans and the whole grid
 // before docx derives column arrays or expands vertical merges.
 const maxColumns=100;
 const occupied=Array<number>(maxColumns).fill(0);
 const span=(value:string|null,max:number)=>{const parsed=Number(value);return Number.isSafeInteger(parsed)&&parsed>0?Math.min(parsed,max):1;};
 for(const [index,row]of sourceRows.entries()){
  const cells:TableCell[]=[];
  let column=0;
  const striped=t.striped&&row.parentElement?.tagName==='TBODY'&&[...row.parentElement.children].indexOf(row)%2===1;
  for(const cell of [...row.children].filter(child=>['TD','TH'].includes(child.tagName))){
   while(column<maxColumns&&occupied[column]>0)column++;
   if(column>=maxColumns)break;
   let free=0;while(column+free<maxColumns&&!occupied[column+free])free++;
   const columnSpan=span(cell.getAttribute('colspan'),free);
   const rowSpan=span(cell.getAttribute('rowspan'),sourceRows.length-index);
   for(let i=column;i<column+columnSpan;i++)occupied[i]=rowSpan;
   column+=columnSpan;
   const isHeader=cell.tagName==='TH';
   const style=isHeader?context.styles.tableHeader:context.styles.table;
   const content=await blocks(cell,{...context,cell:style});
   cells.push(new TableCell({children:content.length?content:[paragraph(style,[])],columnSpan:columnSpan>1?columnSpan:undefined,rowSpan:rowSpan>1?rowSpan:undefined,
    margins:{top:twips(t.cellPaddingY),bottom:twips(t.cellPaddingY),left:twips(t.cellPaddingX),right:twips(t.cellPaddingX)},
    verticalAlign:t.cellVerticalAlign==='middle'?VerticalAlign.CENTER:t.cellVerticalAlign==='bottom'?VerticalAlign.BOTTOM:VerticalAlign.TOP,
    borders:{top:border,bottom:border,left:border,right:border},
    ...isHeader?{shading:{fill:color(t.headerBackground,'ffffff')}}:striped?{shading:{fill:color(t.stripeColor,'ffffff')}}:{},
   }));
  }
  if(!cells.length&&!occupied.some(value=>value>0))cells.push(new TableCell({children:[paragraph(context.styles.table,[])]}));
  rows.push(new TableRow({children:cells,tableHeader:row.children.length>0&&[...row.children].every(cell=>cell.tagName==='TH')}));
  for(let i=0;i<maxColumns;i++)occupied[i]=Math.max(0,occupied[i]-1);
 }
 if(!rows.length)return;
 return new Table({rows,width:{size:t.width==='full'?100:0,type:t.width==='full'?WidthType.PERCENTAGE:WidthType.AUTO},alignment:alignment(t.align),borders:{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border}});
}

async function blocks(root:Element,context:Context):Promise<Block[]>{
 const result:Block[]=[];
 const body=context.cell||context.styles.body;
 for(const node of root.childNodes){
  if(node.nodeType===Node.TEXT_NODE){if(node.textContent?.trim())result.push(paragraph(body,await inline(node,context,body.run)));continue;}
  if(!(node instanceof Element))continue;
  const tag=node.tagName.toLowerCase();
  const hasImage=!context.settings.appearance.hideImages&&(tag==='img'||Boolean(node.querySelector('img')));
  if(tag==='table'){
   const value=await table(node,context);if(value)result.push(value);
  }else if(['ul','ol'].includes(tag)){
   let number=1;
   for(const li of node.children){
    const copy=li.cloneNode(true) as Element;
    for(const nested of copy.querySelectorAll('ul,ol'))nested.remove();
    result.push(paragraph(body,[new TextRun({text:tag==='ol'?`${number++}. `:'• ',...body.run}),...await inline(copy,context,body.run)],{indent:{left:240,firstLine:0}},!context.settings.appearance.hideImages&&Boolean(copy.querySelector('img'))));
    for(const child of li.children)if(['UL','OL'].includes(child.tagName)){
     const container=document.createElement('div');container.append(child.cloneNode(true));result.push(...await blocks(container,context));
    }
   }
  }else if(/^h[1-6]$/.test(tag)){
   const style=context.cell||context.styles.headings[Number(tag[1])-1];
   // Source headings often contain <strong>; the selected heading style owns weight and italics.
   result.push(paragraph(style,await inline(node,context,style.run,false),{},hasImage));
  }else if(['div','section','article','main','figure','blockquote'].includes(tag)){
   result.push(...await blocks(node,context));
  }else{
   const style=tag==='pre'?context.styles.code:body;
   const children=await inline(node,context,style.run);
   if(children.length||(tag==='p'&&!node.querySelector('img')))result.push(paragraph(style,children,hasImage&&!node.textContent?.trim()?{alignment:alignment(context.settings.appearance.imageAlign),indent:{firstLine:0}}:{},hasImage));
  }
 }
 return result;
}

function footer(style:WordStyle,settings:Settings):Footer{
 const format=settings.appearance.pageNumber.format;
 const run=(text:string)=>new TextRun({text,...style.run});
 const current=new TextRun({...style.run,children:[PageNumber.CURRENT]});
 const children=format==='page-total'?[run('第 '),current,run(' 页 / 共 '),new TextRun({...style.run,children:[PageNumber.TOTAL_PAGES]}),run(' 页')]:format==='dash'?[run('— '),current,run(' —')]:[current];
 return new Footer({children:[paragraph(style,children)]});
}

/** Export current reading settings as native Word styles, independent of Office themes. */
export async function buildDocx(article:Article,settings:Settings=defaults):Promise<Blob>{
 const styles=makeWordStyles(settings,await fontResolver());
 const pageWidth=11906;
 const contentWidth=Math.min(pageWidth-1440,Math.max(4200,twips(settings.width-2*settings.pagePadding)));
 const columns=Math.max(1,settings.columns);
 const columnGap=360;
 const maxImageWidth=Math.max(1,Math.floor((contentWidth-(columns-1)*columnGap)/columns/15));
 const content=await blocks(articleDocument(article).body,{settings,styles,maxImageWidth});
 const lines=signatureLines(article);
 const signatures=lines.map((text,i)=>paragraph(styles.signature,[new TextRun({text,...styles.signature.run})],{spacing:{...styles.signature.paragraph.spacing,before:i===0?twips(settings.appearance.metadata.spaceBefore):0,after:i===lines.length-1&&!settings.appearance.metadata.showStats?twips(settings.appearance.metadata.spaceAfter):0}}));
 if(settings.appearance.metadata.showStats)signatures.push(paragraph(styles.signature,[new TextRun({text:`共 ${article.text.replace(/\s/g,'').length} 字 · 阅读需 ${Math.max(1,Math.ceil(article.text.length/500))} 分钟`,...styles.signature.run})],{spacing:{...styles.signature.paragraph.spacing,before:0}}));
 const p=settings.appearance.pageNumber;
 const footerLayout=pageFooterLayout(p);
 const margin=Math.round((pageWidth-contentWidth)/2);
 const footers=p.enabled?{default:footer(styles.page,settings),...!p.firstPage?{first:new Footer({children:[new Paragraph('')]})}:{}}:undefined;
 const source=paragraph(styles.source,[new TextRun({text:'来源：',...styles.source.run}),new ExternalHyperlink({link:sourceURL(article.url),children:[new TextRun({text:article.url,...styles.source.run})]})]);
 const doc=new WordDocument({title:article.title,creator:article.signature||article.author||'iReadFolio · i悦读',description:article.excerpt,features:{updateFields:true},
  styles:{default:{document:{run:styles.body.run,paragraph:styles.body.paragraph}},paragraphStyles:styles.definitions},
  sections:[{properties:{page:{size:{width:pageWidth,height:16838},margin:{top:1587,bottom:footerLayout.bottomTwips,left:margin,right:margin,footer:footerLayout.footerTwips},pageNumbers:{start:p.start}},titlePage:p.enabled&&!p.firstPage,column:{count:columns,space:columnGap,equalWidth:true}},footers,
   children:[paragraph(styles.title,[new TextRun({text:article.title,...styles.title.run})]),...signatures,...content,source]}],
 });
 return Packer.toBlob(doc);
}
