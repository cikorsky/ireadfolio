import type {ExportFormat,Settings} from './types';

export const exportFormats:readonly (readonly [ExportFormat,string])[]=[['txt','纯文本'],['markdown','Markdown'],['html','离线 HTML'],['doc','Word DOC'],['docx','Word DOCX'],['epub','EPUB'],['png','PNG 图片'],['jpeg','JPEG 图片'],['pdf','PDF / 打印']];
export const exportFormatModule:Record<ExportFormat,string>={txt:'export_marked',markdown:'export_marked',html:'export_html',doc:'export_word',docx:'export_word',epub:'export_epub',png:'screenshot',jpeg:'screenshot',pdf:'export_pdf'};
export const toolbarActions:Record<string,string>={settings:'偏好设置',outline:'文章大纲',find:'查找内容',speak:'大声朗读',scroll:'自动滚动',annotate:'批注',later:'保存到稍后读',export:'默认格式导出',print:'打印 / 保存 PDF',fullscreen:'全屏查看',exit:'退出阅读模式',library:'稍后阅读',edit:'编辑内容',remove:'移除内容块',copy_rich:'复制正文',copy_markdown:'复制为 Markdown',imagehide:'隐藏 / 显示图片',imageEmbed:'导出时内嵌图片',next:'加载下一页',...Object.fromEntries(exportFormats.map(([format,label])=>[`export_${format}`,`导出 ${label}`]))};
export const toolbarExtras:Record<keyof Settings['toolbarExtras'],string>={drag:'拖动工具栏',more:'更多工具',top:'返回顶部',bottom:'跳到末尾'};
export function canExport(settings:Settings,format:ExportFormat){return settings.modules[exportFormatModule[format]]!==false;}
export function toolbarActionAllowed(settings:Settings,id:string){
 if(id.startsWith('export_')){const format=id.slice(7);return exportFormats.some(([key])=>key===format)&&canExport(settings,format as ExportFormat);}
 const module:Record<string,string>={settings:'render',outline:'outline',find:'find',speak:'speak',scroll:'scrollpage',annotate:'annotator',later:'export_later',library:'later',edit:'edit',remove:'remove',print:'export_pdf',fullscreen:'fullscreen',exit:'render',next:'nextpage',copy_rich:'copy_rich',copy_markdown:'copy_marked'};
 return !module[id]||settings.modules[module[id]]!==false;
}

/** Clamp the whole toolbar, including the wider export split, inside the viewport. */
export function clampToolbarPosition(x:number,y:number,width:number,height:number,viewportWidth:number,viewportHeight:number,preserveDefault=false){
 if(preserveDefault&&x===-1&&y===-1)return {x:-1,y:-1};
 return {x:Math.max(0,Math.min(x,viewportWidth-width)),y:Math.max(0,Math.min(y,viewportHeight-height))};
}

export interface PreviewBounds {left:number;top:number;right:number;bottom:number}
/** Page-relative anchor stays beside the paper, within the independently scrollable preview. */
export function pageToolbarAnchor(paperRight:number,preview:PreviewBounds,width:number,height:number){
 return {x:Math.max(preview.left,Math.min(paperRight+12,preview.right-width-8)),y:Math.max(preview.top,Math.min(preview.top+16,preview.bottom-height-8))};
}
export function clampToolbarToPreview(x:number,y:number,width:number,height:number,preview:PreviewBounds){
 const position=clampToolbarPosition(x-preview.left,y-preview.top,width,height,preview.right-preview.left,preview.bottom-preview.top);
 return {x:position.x+preview.left,y:position.y+preview.top};
}
