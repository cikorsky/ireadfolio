/** Conservative structure recovery for policies published as styled paragraphs. */
const chineseNumber='[一二三四五六七八九十百零〇]{1,6}';
const protectedBlock='table,pre,code,blockquote,li';
const headingPrefix=new RegExp(`^(?:${chineseNumber}、|[（(]${chineseNumber}[）)]|[1-9]\\d{0,2}[、.．](?!\\d)|[（(][1-9]\\d{0,2}[）)])`);
const titleKey=(value:string)=>value.normalize('NFKC').replace(/[\s\u200b-\u200d\ufeff，,：:。.!！?？·•\-—]/g,'');

export interface PolicyMetadata {signature?:string;signedDate?:string}

/** Remove only metadata positively identified next to the repeated document title. */
export function recoverPolicyMetadata(root:Element,title:string):PolicyMetadata{
 const result:PolicyMetadata={};
 const blocks=[...root.querySelectorAll('p,h1,h2,h3,h4,h5,h6')].filter(el=>!el.closest(protectedBlock)).slice(0,12);
 let titleSeen=false;
 for(const block of blocks){
  if(!block.isConnected&&block.parentNode===null)continue;
  if(block.querySelector('img,video,audio,table,math,svg'))continue;
  const text=(block.textContent||'').trim();
  if(headingPrefix.test(text))break;
  if(text.length<=80&&/^(?:新华社|中新社|中国新闻社|本报)[^。！？]{0,70}电$/.test(text)){
   result.signature=text;block.remove();continue;
  }
  const date=text.match(/[（(]\s*(\d{4}年\d{1,2}月\d{1,2}日)\s*[）)]/);
  const withoutDate=date?text.replace(date[0],''):text;
  if(title&&titleKey(withoutDate)===titleKey(title)){
   titleSeen=true;if(date)result.signedDate=date[1];block.remove();continue;
  }
  if(date&&titleKey(withoutDate)===''&&(titleSeen||result.signature)){
   result.signedDate=date[1];block.remove();
  }
 }
 return result;
}

interface HeadingMatch {level:number;end:number}
function classify(text:string):HeadingMatch|undefined{
 const leading=text.length-text.trimStart().length,content=text.trim();
 if(!content||content.length>5000)return;
 const primary=content.match(new RegExp(`^${chineseNumber}、\\s*(.+)$`));
 // Chapter headings are standalone. Sentence-like enumerations stay paragraphs.
 if(primary&&content.length<=60&&!/[。！？；;\n]/.test(content))return{level:1,end:text.length};
 const secondary=content.match(new RegExp(`^[（(]${chineseNumber}[）)]\\s*`));
 const numeric=content.match(/^[1-9]\d{0,2}[、.．](?!\d)\s*/);
 const numericParenthesized=content.match(/^[（(][1-9]\d{0,2}[）)]\s*/);
 const prefix=secondary||numeric||numericParenthesized;
 if(!prefix)return;
 const level=secondary?2:numeric?3:4;
 const rest=content.slice(prefix[0].length);
 if(!rest||/^\d/.test(rest)||/^(?:\d|[零〇一二三四五六七八九十百])+(?:毫米|厘米|米|公里|千米|吨|公斤|毫升|升|元|万元|亿元|%|％)/.test(rest))return;
 const sentence=rest.indexOf('。');
 if(sentence>=1){
  const lead=rest.slice(0,sentence);
  // Only Chinese policy subclauses permit a plain inline lead sentence.
  if(secondary&&lead.length<=48&&!/[，,；;：:！？\n]/.test(lead))return{level,end:leading+prefix[0].length+sentence+1};
  return;
 }
 if(content.length<=60&&!/[，,。！？；;：:\n]/.test(rest))return{level,end:text.length};
}

function boundary(element:Element,offset:number):{node:Node;offset:number}{
 const walker=element.ownerDocument.createTreeWalker(element,4);
 let node:Node|null,total=0,last:Node=element;
 while((node=walker.nextNode())){
  const length=node.textContent?.length||0;
  if(total+length>=offset)return{node,offset:Math.max(0,offset-total)};
  total+=length;last=node;
 }
 return{node:last,offset:last.nodeType===3?(last.textContent?.length||0):last.childNodes.length};
}
function fragment(element:Element,start:number,end:number):DocumentFragment{
 const a=boundary(element,start),b=boundary(element,end),range=element.ownerDocument.createRange();
 if(start===0)range.setStart(element,0);else range.setStart(a.node,a.offset);
 if(end>=(element.textContent?.length||0))range.setEnd(element,element.childNodes.length);else range.setEnd(b.node,b.offset);
 return range.cloneContents();
}

/** Original source selectors survive retagging and splitting for remembered removals. */
export function detectPolicyHeadings(root:Element):void{
 const candidates=[...root.querySelectorAll('p,h1,h2,h3,h4,h5,h6')];
 for(const block of candidates){
  if(!root.contains(block)||block.closest(protectedBlock))continue;
  if(block.querySelector('img,video,audio,table,math,svg'))continue;
  const text=block.textContent||'',match=classify(text);if(!match)continue;
  const heading=root.ownerDocument.createElement(`h${match.level}`);
  const source=block.getAttribute('data-circle-source');if(source)heading.setAttribute('data-circle-source',source);
  heading.append(fragment(block,0,match.end));
  if(match.end<text.length&&text.slice(match.end).trim()){
   const paragraph=root.ownerDocument.createElement('p');if(source)paragraph.setAttribute('data-circle-source',source);
   paragraph.append(fragment(block,match.end,text.length));block.replaceWith(heading,paragraph);
  }else block.replaceWith(heading);
 }
}
