import type {Settings} from '../types';
import {printPageCSS} from '../document-style';

/** Serialize CSS declarations through the browser so values cannot escape a rule. */
function rule(selector:string,values:Record<string,string|number>,important=false):string {
 const style=document.createElement('span').style;
 for(const [key,value]of Object.entries(values))style.setProperty(key,String(value),important?'important':'');
 return `${selector}{${style.cssText.replace(/</g,'\\3c ')}}`;
}

/** Shared table CSS keeps reading, standalone HTML and printed tables consistent. */
export function documentContentCSS(s:Settings,scope='main'):string{
 const t=s.appearance.table;
 return [
  rule(`${scope} table`,{'display':'table','table-layout':'fixed','border-collapse':'collapse','width':t.width==='full'?'100%':'auto','max-width':'100%','font-family':t.fontFamily,'font-size':`${t.fontSize}px`,'font-weight':t.fontWeight,'font-style':t.fontStyle,'line-height':`${t.lineHeight}px`,'color':t.color,'text-align':t.align,'letter-spacing':'normal','break-inside':'auto'},true),
  rule(`${scope} :is(td,th)`,{'border':`${t.borderWidth}px ${t.borderStyle} ${t.borderColor}`,'padding':`${t.cellPaddingY}px ${t.cellPaddingX}px`,'min-width':'0','font-family':t.fontFamily,'font-size':`${t.fontSize}px`,'font-weight':t.fontWeight,'font-style':t.fontStyle,'line-height':`${t.lineHeight}px`,'color':t.color,'text-align':t.align,'vertical-align':t.cellVerticalAlign,'overflow-wrap':'anywhere','text-indent':'0','letter-spacing':'normal'},true),
  rule(`${scope} th`,{'font-family':t.headerFontFamily,'font-size':`${t.headerFontSize}px`,'font-weight':t.headerFontWeight,'color':t.headerColor,'background-color':t.headerBackground},true),
  rule(`${scope} tbody tr:nth-child(even) td`,{'background-color':t.striped?t.stripeColor:'transparent'},true),
  rule(`${scope} :is(td,th) :is(p,li,blockquote,span,font)`,{'font-family':'inherit','font-size':'inherit','font-weight':'inherit','font-style':'inherit','line-height':'inherit','color':'inherit','text-align':'inherit','text-indent':'0','letter-spacing':'normal','margin':'0'},true),
  rule(`${scope} thead`,{'display':'table-header-group'}),rule(`${scope} tr`,{'break-inside':'avoid'}),
 ].join('\n');
}

/** Same typography as the reader, applied to the standalone HTML/print document. */
export function articleTypographyCSS(s:Settings):string {
 const a=s.appearance;
 const align=(value:string)=>value==='default'?'start':value;
 const paper=({white:'#fff',green:'#d9f0da',cream:'#faf3e5',gray:'#494949',dark:'#222',gradient:'#fff'} as Record<string,string>)[s.theme]||'#fff';
 const css=[
  rule('body',{'font-family':s.fontFamily,'font-size':`${s.fontSize}px`,'font-weight':a.fontWeight,'font-style':a.fontStyle,'line-height':a.lineHeightMode==='fixed'?`${a.fixedLineHeight}px`:s.lineHeight,'color':s.color||'#1b1b1b','background-color':paper,'print-color-adjust':'exact','max-width':`${Math.max(280,s.width-2*s.pagePadding)}px`,'text-align':align(a.textAlign),'letter-spacing':`${a.letterSpacing}px`}),
  rule('main p,main li,main blockquote',{'font-family':s.fontFamily,'font-size':`${s.fontSize}px`,'font-weight':a.fontWeight,'font-style':a.fontStyle,'text-decoration':a.textDecoration,'color':s.color||'#1b1b1b','text-align':align(a.textAlign),'line-height':a.lineHeightMode==='fixed'?`${a.fixedLineHeight}px`:s.lineHeight,'letter-spacing':`${a.letterSpacing}px`},true),
  rule('main p',{'margin-top':`${a.paragraphBefore}px`,'margin-bottom':`${s.paragraphSpace}px`,'text-indent':`${a.textIndent}em`},true),
  rule('main :is(p,li,blockquote) :is(span,font)',{'font-family':'inherit','font-size':'inherit','color':'inherit','letter-spacing':'inherit'},true),
  rule('header h1',{'font-family':a.titleFont,'font-size':`${a.titleSize}px`,'font-weight':a.titleWeight,'font-style':a.titleStyle,'text-decoration':a.titleDecoration,'line-height':`${a.titleLineHeight}px`,'margin-top':`${a.titleSpaceBefore}px`,'margin-bottom':`${a.titleSpaceAfter}px`,'text-indent':`${a.titleIndent}em`,'text-align':align(a.titleAlign),'color':a.titleColor,'letter-spacing':'normal'}),
  rule('.article-meta',{'font-family':a.metadata.fontFamily,'font-size':`${a.metadata.fontSize}px`,'font-weight':a.metadata.fontWeight,'font-style':a.metadata.fontStyle,'text-decoration':a.metadata.textDecoration,'color':a.metadata.color,'letter-spacing':`${a.metadata.letterSpacing}px`,'text-indent':'0','text-align':a.metadata.textAlign,'line-height':`${a.metadata.lineHeight}px`,'margin-top':`${a.metadata.spaceBefore}px`,'margin-bottom':`${a.metadata.spaceAfter}px`}),
  rule('.article-meta p',{'font':'inherit','line-height':'inherit','color':'inherit','margin':'0','text-indent':'0'}),
  rule('.article-source',{'font-family':'system-ui,sans-serif','font-size':'12px','font-weight':400,'font-style':'normal','letter-spacing':'normal','text-indent':'0','text-align':'start','line-height':1.6,'margin-top':'32px'}),
  rule('main pre,main code',{'font-family':a.codeFont,'font-size':`${a.codeSize}px`,'line-height':a.codeLineHeight,'font-style':'normal','text-indent':'0','text-align':'start','letter-spacing':'normal'}),
  rule('main a',{'color':a.linkColor}),
 ];
 for(let i=0;i<6;i++)css.push(rule(`main h${i+1}`,{'font-family':a.headingFonts[i],'font-size':`${a.headingSizes[i]*s.fontSize}px`,'font-weight':a.headingWeights[i],'font-style':a.headingStyles[i],'text-decoration':a.headingDecorations[i],'text-align':align(a.headingAligns[i]),'line-height':`${a.headingLineHeights[i]}px`,'margin-top':`${a.headingSpaceBefore[i]}px`,'margin-bottom':`${a.headingSpaceAfter[i]}px`,'text-indent':`${a.headingIndents[i]}em`,'color':a.headingColors[i],'letter-spacing':'normal','break-after':'avoid'},true));
 css.push(rule('main :is(h1,h2,h3,h4,h5,h6) :is(span,font,strong,b,em,i)',{'font-family':'inherit','font-size':'inherit','font-weight':'inherit','font-style':'inherit','letter-spacing':'inherit','color':'inherit'},true));
 if(a.hideImages)css.push(rule('main img',{'display':'none'}));
 if(a.imageAlign!=='default')css.push(rule('main img',{'display':'block','margin-left':a.imageAlign==='left'?'0':'auto','margin-right':a.imageAlign==='right'?'0':'auto'}));
 return css.join('\n')+'\n'+documentContentCSS(s)+'\n'+printPageCSS(s);
}
