import http from 'node:http';
const escapeXML=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
/** Local test fixture only. Never connects to a user service. */
export function createWebDAVTestServer({username='test-user',password='test-password',basePath='/dav/'}={}){
 const files=new Map(),requests=[];let directory=false;
 const expected='Basic '+Buffer.from(username+':'+password,'utf8').toString('base64');
 const server=http.createServer(async(req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;requests.push({method:req.method,path:pathname,depth:req.headers.depth,authenticated:req.headers.authorization===expected,ifNoneMatch:req.headers['if-none-match']});
  if(req.headers.authorization!==expected){res.writeHead(401,{'WWW-Authenticate':'Basic realm="test-webdav"'});res.end();return;}
  const folder=basePath+'i-yuedu/';
  if(req.method==='MKCOL'&&pathname===folder){res.statusCode=directory?405:201;directory=true;res.end();return;}
  if(req.method==='PROPFIND'&&(pathname===basePath||pathname===folder&&directory)){
   const item=(href,bytes=0)=>`<d:response><d:href>${escapeXML(href)}</d:href><d:propstat><d:prop><d:getcontentlength>${bytes}</d:getcontentlength><d:getlastmodified>Thu, 05 Nov 2026 08:00:00 GMT</d:getlastmodified></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
   res.writeHead(207,{'Content-Type':'application/xml;charset=utf-8'});res.end(`<?xml version="1.0"?><d:multistatus xmlns:d="DAV:">${item(pathname)}${req.headers.depth==='1'?[...files].map(([id,data])=>item(folder+id,Buffer.byteLength(data))).join(''):''}</d:multistatus>`);return;
  }
  if(pathname.startsWith(folder)&&!pathname.slice(folder.length).includes('/')){
   const id=decodeURIComponent(pathname.slice(folder.length));
   if(req.method==='PUT'&&directory){if(req.headers['if-none-match']==='*'&&files.has(id)){res.statusCode=412;res.end();return;}const chunks=[];for await(const chunk of req)chunks.push(chunk);files.set(id,Buffer.concat(chunks).toString('utf8'));res.statusCode=201;res.end();return;}
   if(req.method==='GET'&&files.has(id)){res.writeHead(200,{'Content-Type':'application/json'});res.end(files.get(id));return;}
  }
  res.statusCode=404;res.end();
 });
 return {server,files,requests};
}
