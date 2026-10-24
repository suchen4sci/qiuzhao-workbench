function isAttachmentDownload(url){
 try{
  const u=new URL(url);
  return /^https?:$/.test(u.protocol)&&/(^|\.)zhiye\.com$/i.test(u.hostname)&&/^\/AccessAuthorityPortalFile\/download\//i.test(u.pathname);
 }catch{return false;}
}
async function openAttachment(wc,url){
 if(!/\.pdf$/i.test(new URL(url).pathname)){wc.downloadURL(url);return;}
 const {app,shell,net}=require('electron'),fs=require('node:fs/promises'),path=require('node:path');
 // net.request preserves native header handling. session.fetch can throw in
 // Electron's Headers conversion when Content-Disposition contains Chinese.
 const data=await new Promise((resolve,reject)=>{
  const request=net.request({url,session:wc.session,useSessionCookies:true});
  const timer=setTimeout(()=>{request.abort();reject(Error('附件读取超时'));},30000);
  const fail=e=>{clearTimeout(timer);reject(e);};request.on('error',fail);
  request.on('response',response=>{
   if(response.statusCode!==200){request.abort();fail(Error('服务器返回 '+response.statusCode));return;}
   const chunks=[];let size=0;response.on('error',fail);
   response.on('data',chunk=>{size+=chunk.length;if(size>50*1024*1024){request.abort();fail(Error('附件超过50MB'));}else chunks.push(chunk);});
   response.on('end',()=>{clearTimeout(timer);resolve(Buffer.concat(chunks));});
  });request.end();
 });
 if(data.length>50*1024*1024||!data.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('未返回有效PDF，请刷新简历页后重试');
 const dir=await fs.mkdtemp(path.join(app.getPath('temp'),'qiuzhao-preview-'));
 const file=path.join(dir,'简历附件.pdf');await fs.writeFile(file,data);
 const error=await shell.openPath(file);if(error)throw Error(error);
 return {bytes:data.length,file};
}
module.exports={isAttachmentDownload,openAttachment};
