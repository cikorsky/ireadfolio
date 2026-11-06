export const filenameFields = [
 {token:'[title]',value:'title',description:'文章标题'},
 {token:'[node:title]',value:'title',description:'文章标题，与 [title] 相同'},
 {token:'[date]',value:'date',description:'导出日期（UTC），格式为 YYYY-MM-DD'},
] as const;

/** Expand supported fields once, keeping unknown fields and literal title text intact. */
export function formatFilenameTemplate(template:string,title:string,date=new Date()):string {
 const values={title,date:date.toISOString().slice(0,10)};
 const fields=new Map<string,string>(filenameFields.map(field=>[field.token,values[field.value]]));
 return template.replace(/\[(?:title|node:title|date)\]/g,token=>fields.get(token)!);
}
