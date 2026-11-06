export function keyChord(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>):string{
 const key=event.key===' '?'space':event.key.toLowerCase();if(['control','meta','alt','shift'].includes(key))return '';
 return [event.ctrlKey||event.metaKey?'ctrl':'',event.altKey?'alt':'',event.shiftKey&&key.length>1?'shift':'',key==='esc'?'escape':key].filter(Boolean).join('+');
}
function normalize(value:string){return value.toLowerCase().replace(/command|cmd|meta/g,'ctrl').replace(/\besc\b/g,'escape').split(/\s+/).map(v=>v.split('+').map(p=>p.trim()).join('+')).join(' ');}
export class ShortcutMatcher {
 private pending:string[]=[];private last=0;
 match(event:Pick<KeyboardEvent,'key'|'ctrlKey'|'metaKey'|'altKey'|'shiftKey'>,shortcuts:Record<string,string>,now=Date.now()):string|undefined{
  const chord=keyChord(event);if(!chord)return;if(now-this.last>650)this.pending=[];this.last=now;this.pending.push(chord);this.pending=this.pending.slice(-3);
  for(const[id,shortcut]of Object.entries(shortcuts)){const keys=normalize(shortcut);if(keys&&this.pending.slice(-keys.split(' ').length).join(' ')===keys){this.pending=[];return id;}}
 }
}
