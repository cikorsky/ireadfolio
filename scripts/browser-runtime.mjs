import {existsSync} from 'node:fs';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {chromium,firefox} from 'playwright';

/** Isolated profiles never read or change the user's installed browser profile. */
export function createBrowserProfile(prefix='ireadfolio-browser-') {
 return mkdtemp(path.join(os.tmpdir(),prefix));
}

export function chromiumExecutable() {
 return process.env.CHROMIUM_PATH || chromium.executablePath();
}

/** Native Firefox is optional; the default CI journey uses Chromium only. */
export function firefoxExecutable() {
 if(process.env.FIREFOX_PATH) {
  if(!existsSync(process.env.FIREFOX_PATH))throw new Error('FIREFOX_PATH does not exist');
  return process.env.FIREFOX_PATH;
 }
 const binary=process.platform==='win32'?'firefox.exe':'firefox';
 const candidates=[
  ...process.platform==='darwin'?['/Applications/Firefox.app/Contents/MacOS/firefox']:[],
  ...process.platform==='win32'?[path.join(process.env.PROGRAMFILES||'C:\\Program Files','Mozilla Firefox','firefox.exe')]:[],
  ...(process.env.PATH||'').split(path.delimiter).filter(Boolean).map(directory=>path.join(directory,binary)),
  firefox.executablePath(),
 ];
 const executable=candidates.find(candidate=>existsSync(candidate));
 if(!executable)throw new Error('Firefox was not found. Set FIREFOX_PATH or install Firefox with npx playwright install firefox.');
 return executable;
}
