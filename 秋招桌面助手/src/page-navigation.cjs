// Resolve when the document is usable; slow images must not hold the host IPC open.
// Keep Chromium loading resources normally and still report late navigation errors.
function loadDocument(webContents,url,onLateError=()=>{}){
 return new Promise((resolve,reject)=>{
  let settled=false;
  const finish=error=>{if(settled)return;settled=true;webContents.removeListener('dom-ready',ready);webContents.removeListener('destroyed',destroyed);error?reject(error):resolve();};
  const ready=()=>finish(),destroyed=()=>finish(new Error('网页已关闭'));
  webContents.once('dom-ready',ready);webContents.once('destroyed',destroyed);
  try{Promise.resolve(webContents.loadURL(url)).then(()=>finish(),error=>{if(settled)onLateError(error);else finish(error);});}catch(error){finish(error);}
 });
}
module.exports={loadDocument};
