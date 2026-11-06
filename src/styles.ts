import {builtInReadingStyles} from './defaults';
import type {ReadingStyle,ReadingStyleValues,Settings} from './types';

export const readingStyleKeys=['fontFamily','fontSize','lineHeight','paragraphSpace','width','pagePadding','pageMargin','columns','paper','footer','theme','followSystem','customCSS','background','color','appearance'] as const;
export const toolbarAppearanceKeys=['toolbarItemGap','toolbarGroupGap','toolbarAutoHide','toolbarAnchor','toolbarX','toolbarY'] as const;
const copy=<T,>(value:T):T=>structuredClone(value);

/** A style captures the reading page, leaving commands, library and toolbar placement alone. */
export function captureReadingStyle(settings:Settings):ReadingStyleValues{
 const values=Object.fromEntries(readingStyleKeys.map(key=>[key,copy(settings[key])])) as unknown as ReadingStyleValues;
 for(const key of toolbarAppearanceKeys)delete (values.appearance as unknown as Record<string,unknown>)[key];
 return values;
}
export function getReadingStyles(settings:Settings):ReadingStyle[]{
 return copy([...builtInReadingStyles,...settings.savedStyles]);
}
export function applyReadingStyle(settings:Settings,style:ReadingStyle):Settings{
 const values=copy(style.values);
 return {...settings,...values,appearance:{...settings.appearance,...values.appearance}};
}
export function saveReadingStyle(settings:Settings,name:string):Settings{
 const trimmed=name.trim();
 if(!trimmed||trimmed.length>80)throw Error('样式名称须为1至80个字符。');
 if(getReadingStyles(settings).some(style=>style.name.toLocaleLowerCase()===trimmed.toLocaleLowerCase()))throw Error('该样式名称已存在，请使用新的名称。');
 if(settings.savedStyles.length>=100)throw Error('自定义样式最多保存100个。');
 const style:ReadingStyle={id:crypto.randomUUID(),name:trimmed,values:captureReadingStyle(settings)};
 return {...settings,savedStyles:[...copy(settings.savedStyles),style]};
}
export function setDefaultReadingStyle(settings:Settings,id:string):Settings{
 const style=getReadingStyles(settings).find(item=>item.id===id);
 if(!style)throw Error('默认样式不存在，请重新选择。');
 return {...applyReadingStyle(settings,style),defaultStyleId:id};
}
export function applyDefaultReadingStyle(settings:Settings):Settings{
 return setDefaultReadingStyle(settings,settings.defaultStyleId);
}
