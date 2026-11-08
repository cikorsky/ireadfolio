export interface Article { id: string; url: string; title: string; author: string; published: string; signature?:string; signedDate?:string; excerpt: string; html: string; text: string; nextUrl?: string; savedAt: number; tags: string[]; category: string; archived: boolean; deletedAt?: number }
export interface Annotation { id: string; articleId: string; quote: string; prefix: string; suffix: string; note: string; color: string; createdAt: number }
export interface Rule { id: string; pattern: string; title: string; content: string; next: string; remove: string }
export interface TextBlockStyle {
 fontFamily:string; fontSize:number; fontWeight:number; fontStyle:'normal'|'italic'; textDecoration:'none'|'underline'|'line-through'; color:string; lineHeight:number; textAlign:'left'|'center'|'right'; spaceBefore:number; spaceAfter:number; letterSpacing:number;
}
export interface TableAppearance {
 fontFamily:string; fontSize:number; fontWeight:number; fontStyle:'normal'|'italic'; lineHeight:number; color:string;
 headerFontFamily:string; headerFontSize:number; headerFontWeight:number; headerColor:string; headerBackground:string;
 borderColor:string; borderWidth:number; borderStyle:'solid'|'dashed'|'none'; cellPaddingX:number; cellPaddingY:number; align:'left'|'center'|'right'; width:'auto'|'full'; striped:boolean; stripeColor:string; cellVerticalAlign:'top'|'middle'|'bottom';
}
export interface PageNumberAppearance {
 differentOddEven:boolean; evenAlign:'left'|'center'|'right';
 enabled:boolean; fontFamily:string; fontSize:number; color:string; align:'left'|'center'|'right'; format:'dash'|'plain'|'page-total'; start:number; firstPage:boolean; marginBottom:number;
}
export interface Appearance {
 metadata:TextBlockStyle & {showStats:boolean}; table:TableAppearance; pageNumber:PageNumberAppearance;
 fontStyle:'normal'|'italic'; textDecoration:'none'|'underline'|'line-through'; paragraphBefore:number; lineHeightMode:'multiple'|'fixed'; fixedLineHeight:number;
 titleFont:string; titleSize:number; titleWeight:number; titleStyle:'normal'|'italic'; titleDecoration:'none'|'underline'|'line-through'; titleColor:string; titleLineHeight:number; titleSpaceBefore:number; titleSpaceAfter:number; titleIndent:number;
 headingFonts:string[]; headingStyles:('normal'|'italic')[]; headingDecorations:('none'|'underline'|'line-through')[]; headingAligns:string[]; headingLineHeights:number[]; headingSpaceBefore:number[]; headingSpaceAfter:number[]; headingIndents:number[];
 fontWeight:number; letterSpacing:number; textIndent:number; textAlign:string; titleAlign:string; imageAlign:string; hideImages:boolean;
 codeFont:string; codeSize:number; codeLineHeight:number; headingSizes:number[]; headingWeights:number[]; headingColors:string[];
 linkColor:string; selectionColor:string; selectionBackground:string; backgroundImage:string;
 toolbarItemGap:number; toolbarGroupGap:number; toolbarAutoHide:boolean; toolbarAnchor:'page'; toolbarX:number; toolbarY:number;
}
export interface Settings { defaultStyleOverride:ReadingStyleValues|null; savedStyles:ReadingStyle[]; defaultStyleId:string; appearance:Appearance; theme: string; followSystem: boolean; fontFamily: string; fontSize: number; lineHeight: number; paragraphSpace: number; width: number; pagePadding: number; pageMargin: number; columns: number; paper: boolean; footer: boolean; customCSS: string; background: string; color: string; modules: Record<string, boolean>; whitelist: string[]; blacklist: string[]; rules: Rule[]; shortcuts: Record<string,string>; toolbar: string[]; toolbarExtras:{drag:boolean;more:boolean;top:boolean;bottom:boolean}; defaultExportFormat:ExportFormat; scrollSpeed: number; speechRate: number; speechPitch: number; speechVoice: string; imageEmbed: boolean; filenameTemplate: string }
export interface Taxonomy {categories:string[];tags:string[]}
export type ReadingStyleValues = Pick<Settings,'fontFamily'|'fontSize'|'lineHeight'|'paragraphSpace'|'width'|'pagePadding'|'pageMargin'|'columns'|'paper'|'footer'|'theme'|'followSystem'|'customCSS'|'background'|'color'> & {appearance:Omit<Appearance,'toolbarItemGap'|'toolbarGroupGap'|'toolbarAutoHide'|'toolbarAnchor'|'toolbarX'|'toolbarY'>};
export interface ReadingStyle {id:string;name:string;values:ReadingStyleValues}
export interface Backup { taxonomy?:Taxonomy; version: 1; createdAt: number; settings: Settings; articles: Article[]; annotations: Annotation[] }
export type ExportFormat = 'txt'|'markdown'|'html'|'doc'|'docx'|'epub'|'png'|'jpeg'|'pdf';
