import DOMPurify from 'dompurify';
import {loadImage} from './images';
interface Dimensions {width:number;height:number}
export interface WordImage extends Dimensions {bytes:Uint8Array<ArrayBuffer>;type:'png'|'jpg'|'gif'|'bmp'}
const MAX_PIXELS=40_000_000;
function validDimensions(width:number,height:number):Dimensions {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>16384||height>16384||width*height>MAX_PIXELS)throw new Error('图片尺寸无效或超过 4000 万像素，无法导出 Word');
  return {width,height};
}
// Read intrinsic raster dimensions without guessing layout or requiring canvas.
export function rasterDimensions(bytes:Uint8Array,mime:string):Dimensions|undefined {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(mime==='image/png'&&bytes.length>=24&&view.getUint32(0)===0x89504e47)return validDimensions(view.getUint32(16),view.getUint32(20));
  if(mime==='image/gif'&&bytes.length>=10&&String.fromCharCode(...bytes.slice(0,3))==='GIF')return validDimensions(view.getUint16(6,true),view.getUint16(8,true));
  if(mime==='image/bmp'&&bytes.length>=26&&view.getUint16(0)===0x424d)return validDimensions(Math.abs(view.getInt32(18,true)),Math.abs(view.getInt32(22,true)));
  if(['image/jpeg','image/jpg'].includes(mime)&&bytes.length>=4&&view.getUint16(0)===0xffd8){
    let offset=2;
    while(offset+4<=bytes.length){
      if(bytes[offset]!==0xff)break;
      const marker=bytes[offset+1];
      if(marker===0xd9||marker===0xda)break;
      if(marker===0xff){offset++;continue;}
      if(marker===0x01||(marker>=0xd0&&marker<=0xd7)){offset+=2;continue;}
      const length=view.getUint16(offset+2);if(length<2||offset+2+length>bytes.length)break;
      if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)&&length>=7)return validDimensions(view.getUint16(offset+7),view.getUint16(offset+5));
      offset+=2+length;
    }
  }
  return undefined;
}
export function safeSVG(bytes:Uint8Array):string {
  const input=new TextDecoder().decode(bytes);
  const clean=DOMPurify.sanitize(input,{USE_PROFILES:{svg:true,svgFilters:true},FORBID_TAGS:['script','foreignObject','style','image','animate','animateMotion','animateTransform','set','a']});
  const doc=new DOMParser().parseFromString(clean,'image/svg+xml');const root=doc.documentElement;
  if(root.localName!=='svg'||doc.querySelector('parsererror'))throw new Error('SVG 图片格式无效，无法转换为 PNG');
  for(const element of [root,...root.querySelectorAll('*')]){
    for(const attr of [...element.attributes]){
      const name=attr.localName.toLowerCase();const value=attr.value.trim();
      if(name.startsWith('on')||name==='style'||name==='base'||((name==='href'||name==='src')&&!value.startsWith('#'))||(/url\s*\(/i.test(value)&&!/^url\(\s*#[\w:.-]+\s*\)$/i.test(value)))element.removeAttributeNode(attr);
    }
  }
  root.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(root);
}
async function decodeImage(dataUrl:string):Promise<HTMLImageElement> {
  return new Promise((resolve,reject)=>{
    const image=new Image();const timer=setTimeout(()=>{image.onload=null;image.onerror=null;image.src='';reject(new Error('图片解码超时，无法导出 Word'))},15000);
    image.onload=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;try{validDimensions(image.naturalWidth,image.naturalHeight);resolve(image)}catch(error){reject(error)}};
    image.onerror=()=>{clearTimeout(timer);image.onload=null;image.onerror=null;reject(new Error('浏览器无法解码图片，请先转换为 PNG/JPEG 后重试'))};
    image.src=dataUrl;
  });
}
export async function prepareWordImage(url:string):Promise<WordImage> {
  const data=await loadImage(url);
  if(data.extension==='webp'||data.extension==='svg'){
    const source=data.extension==='svg'?`data:image/svg+xml;charset=utf-8,${encodeURIComponent(safeSVG(data.bytes))}`:data.dataUrl;
    const image=await decodeImage(source);const {width,height}=validDimensions(image.naturalWidth,image.naturalHeight);
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    try{
      const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器不支持图片转换所需的 Canvas');
      context.drawImage(image,0,0,width,height);
      const png=canvas.toDataURL('image/png');if(!png.startsWith('data:image/png;base64,'))throw new Error('浏览器未能生成 PNG 图片');
      const converted=await loadImage(png);return {bytes:converted.bytes,type:'png',width,height};
    }catch(error){throw new Error(`图片转 PNG 失败：${error instanceof Error?error.message:'请改用 PNG/JPEG 图片'}`)}
  }
  const size=rasterDimensions(data.bytes,data.mime);
  let dimensions:Dimensions;
  if(size) dimensions=size;
  else {const decoded=await decodeImage(data.dataUrl);dimensions=validDimensions(decoded.naturalWidth,decoded.naturalHeight);}
  return {bytes:data.bytes,type:data.extension as 'png'|'jpg'|'gif'|'bmp',...dimensions};
}
export function fitWordImage(size:Dimensions,requestedWidth?:number,requestedHeight?:number):Dimensions {
  const natural=validDimensions(size.width,size.height);
  const limitWidth=requestedWidth&&requestedWidth>0?Math.min(requestedWidth,560):560;
  const limitHeight=requestedHeight&&requestedHeight>0?requestedHeight:760;
  const scale=Math.min(1,limitWidth/natural.width,limitHeight/natural.height);
  return {width:Math.max(1,Math.round(natural.width*scale)),height:Math.max(1,Math.round(natural.height*scale))};
}
