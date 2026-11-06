// @vitest-environment node
import {afterEach,describe,expect,it,vi} from 'vitest';
import {build} from 'esbuild';
import path from 'node:path';
import {runInNewContext} from 'node:vm';
import {scheduleImmediate,cancelImmediate,installImmediate} from '../src/compat/set-immediate';

afterEach(()=>vi.useRealTimers());
describe('function-only immediate compatibility',()=>{
 it('runs callbacks asynchronously with their arguments in queue order',()=>{
  vi.useFakeTimers();const calls:string[]=[];
  scheduleImmediate((label:string,count:number)=>calls.push(label.repeat(count)),'A',2);
  scheduleImmediate(()=>calls.push('B'));
  expect(calls).toEqual([]);vi.runAllTimers();expect(calls).toEqual(['AA','B']);
 });
 it('cancels queued callbacks and allows callbacks to schedule later work',()=>{
  vi.useFakeTimers();const calls:string[]=[];
  const canceled=scheduleImmediate(()=>calls.push('canceled'));cancelImmediate(canceled);
  scheduleImmediate(()=>{calls.push('first');scheduleImmediate(()=>calls.push('second'));});
  vi.runAllTimers();expect(calls).toEqual(['first','second']);
 });
 it('rejects strings without scheduling or executing them',()=>{
  vi.useFakeTimers();
  expect(()=>scheduleImmediate('globalThis.unwanted=true' as unknown as ()=>void)).toThrow(TypeError);
  expect(vi.getTimerCount()).toBe(0);
 });
 it('installs both methods together and preserves an existing complete implementation',()=>{
  const target:{setImmediate?:typeof scheduleImmediate;clearImmediate?:typeof cancelImmediate}={};
  installImmediate(target);expect(target.setImmediate).toBe(scheduleImmediate);expect(target.clearImmediate).toBe(cancelImmediate);
  function nativeSchedule<Args extends unknown[]>(callback:(...args:Args)=>void,...args:Args){return scheduleImmediate(callback,...args);}
  const existing={setImmediate:nativeSchedule,clearImmediate:(handle:ReturnType<typeof scheduleImmediate>)=>cancelImmediate(handle)};
  const before={...existing};installImmediate(existing);expect(existing).toEqual(before);
 });
 it('bundles the actual JSZip browser dependency without dynamic code generation',async()=>{
  const result=await build({stdin:{contents:"import JSZip from 'jszip';globalThis.zipRoundTrip=async()=>{const zip=new JSZip();zip.file('policy.txt','江河保护');const bytes=await zip.generateAsync({type:'uint8array',compression:'DEFLATE'});const loaded=await JSZip.loadAsync(bytes);return {text:await loaded.file('policy.txt').async('string'),nodeStreams:JSZip.support.nodestream};};",resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',format:'iife',alias:{jszip:path.resolve('node_modules/jszip/lib/index.js'),setimmediate:path.resolve('src/compat/set-immediate.ts'),'readable-stream':path.resolve('src/compat/no-node-stream.ts')}});
  const code=result.outputFiles[0].text;
  expect(code.includes('Immediate callback must be a function')).toBe(true);
  expect(/\bnew\s+Function\s*\(/.test(code)).toBe(false);
  expect(/\beval\s*\(/.test(code)).toBe(false);
  const browser:{zipRoundTrip?:()=>Promise<{text:string;nodeStreams:boolean}>;setTimeout:typeof setTimeout;clearTimeout:typeof clearTimeout;Uint8Array:typeof Uint8Array;ArrayBuffer:typeof ArrayBuffer}={setTimeout,clearTimeout,Uint8Array,ArrayBuffer};
  runInNewContext(code,browser,{timeout:1000});
  expect(await browser.zipRoundTrip!()).toEqual({text:'江河保护',nodeStreams:false});
 });
});
