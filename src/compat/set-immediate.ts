type Timer = ReturnType<typeof setTimeout>;

/** Browser-only replacement for setimmediate: callbacks must be functions. */
export function scheduleImmediate<Args extends unknown[]>(callback:(...args:Args)=>void,...args:Args):Timer {
 if(typeof callback!=='function')throw new TypeError('Immediate callback must be a function');
 return setTimeout(()=>callback(...args),0);
}
export function cancelImmediate(handle:Timer):void {clearTimeout(handle);}
interface ImmediateGlobals {
 setImmediate?:typeof scheduleImmediate;
 clearImmediate?:typeof cancelImmediate;
}
export function installImmediate(target:ImmediateGlobals=globalThis as unknown as ImmediateGlobals):void {
 if(typeof target.setImmediate==='function'&&typeof target.clearImmediate==='function')return;
 target.setImmediate=scheduleImmediate;
 target.clearImmediate=cancelImmediate;
}
installImmediate();
