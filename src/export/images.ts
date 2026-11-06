interface ImageData { dataUrl: string; bytes: Uint8Array<ArrayBuffer>; mime: string; extension: string }
export async function loadImage(url: string): Promise<ImageData> {
  let dataUrl = url;
  if (!/^data:image\/(png|jpe?g|gif|webp|svg\+xml|bmp)(?:;|,)/i.test(url)) {
    if (!/^https?:\/\//i.test(url)) throw new Error('图片地址不支持，请关闭内嵌图片后重试');
    if (typeof chrome !== 'undefined' && chrome.runtime?.id) {
      const response = await chrome.runtime.sendMessage({type:'FETCH_IMAGE',url}) as {ok:boolean;dataUrl?:string;error?:string};
      if (!response.ok || !response.dataUrl) throw new Error(response.error || '图片下载失败');
      dataUrl = response.dataUrl;
    } else {
      const response = await fetch(url,{signal:AbortSignal.timeout(15000)});
      if (!response.ok) throw new Error(`图片下载失败（${response.status}），可关闭内嵌图片后重试`);
      const blob = await response.blob();
      if (blob.size > 20*1024*1024) throw new Error('单张图片超过 20 MB');
      dataUrl = await new Promise<string>((resolve,reject) => {
        const reader = new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片读取失败'));reader.readAsDataURL(blob);
      });
    }
  }
  const match = /^data:(image\/[a-z0-9.+-]+)(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i.exec(dataUrl);
  if (!match) throw new Error('图片格式无效');
  const binary = match[2] ? atob(match[3]) : new TextEncoder().encode(decodeURIComponent(match[3]));
  const bytes = typeof binary === 'string' ? Uint8Array.from(binary,char=>char.charCodeAt(0)) : binary;
  if (bytes.byteLength > 20*1024*1024) throw new Error('单张图片超过 20 MB');
  const mime = match[1].toLowerCase();
  const extension = ({'image/png':'png','image/jpeg':'jpg','image/jpg':'jpg','image/gif':'gif','image/webp':'webp','image/svg+xml':'svg','image/bmp':'bmp'} as Record<string,string>)[mime];
  if (!extension) throw new Error(`不支持的图片格式：${mime}`);
  return {dataUrl,bytes,mime,extension};
}
export async function embedImages(doc: Document): Promise<void> {
  const cache = new Map<string,Promise<ImageData>>();
  for (const img of doc.querySelectorAll('img')) {
    const src=img.getAttribute('src');if (!src) continue;
    if (!cache.has(src)) cache.set(src,loadImage(src));
    const image=await cache.get(src)!;img.src=image.dataUrl;
  }
}
