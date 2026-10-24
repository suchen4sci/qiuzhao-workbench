const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{execFile}=require('node:child_process');
async function readInWindow(info){
 const {BrowserWindow}=require('electron');const window=new BrowserWindow({show:false,width:1600,height:900,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 try{
  let loadTimer;
  try{await Promise.race([window.loadURL(info.url),new Promise((_,reject)=>{loadTimer=setTimeout(()=>reject(Error('公司介绍页面加载超时')),8000);})]);}finally{clearTimeout(loadTimer);}
  const {snapshot,parseContext}=require('./job-context.cjs');
  const inspect='('+snapshot.toString()+')()';
  let introVisited=false;
  if(info.clickIntro){for(let n=0;n<20;n++){const clicked=await window.webContents.executeJavaScript(`(()=>{const links=[...document.querySelectorAll('a,button,[role="button"]')].filter(e=>e.getClientRects().length&&/^(公司介绍|关于我们|关于公司)$/.test(e.textContent.trim()));if(links.length!==1)return false;links[0].click();return true;})()`);if(clicked){introVisited=true;break;}await new Promise(r=>setTimeout(r,150));}}
  for(let n=0;n<15;n++){const data=await window.webContents.executeJavaScript(inspect);const result=parseContext({...data,companyIntroduction:!info.clickIntro||introVisited});if(result.company)return result;await new Promise(r=>setTimeout(r,200));}
  return null;
 }finally{window.destroy();}
}
async function readBackground(info){
 const electron=require('electron');if(typeof electron!=='string')return readInWindow(info);
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;env.QIUZHAO_COMPANY_READER='1';
 return new Promise((resolve,reject)=>execFile(electron,[path.join(__dirname,'company-reader.cjs'),JSON.stringify(info)],{env,windowsHide:true,timeout:15000,maxBuffer:300000},(error,stdout,stderr)=>{
  if(error)return reject(Error('公司介绍后台读取超时或失败'));
  const line=stdout.split('\n').find(s=>s.startsWith('COMPANY_CONTEXT:'));try{resolve(line?JSON.parse(line.slice(16)):null);}catch{reject(Error('公司介绍读取结果无效'));}
 }));
}
if(process.env.QIUZHAO_COMPANY_READER==='1'){const {app}=require('electron');const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'qiuzhao-company-reader-'));app.setPath('userData',dataDir);app.commandLine.appendSwitch('disable-gpu');app.whenReady().then(async()=>{try{const result=await readInWindow(JSON.parse(process.argv[2]));console.log('COMPANY_CONTEXT:'+JSON.stringify(result));}catch(e){console.log('COMPANY_CONTEXT:null');}finally{app.quit();}});app.on('window-all-closed',()=>{});process.on('exit',()=>{try{if(path.dirname(path.resolve(dataDir))===path.resolve(os.tmpdir())&&path.basename(dataDir).startsWith('qiuzhao-company-reader-'))fs.rmSync(dataDir,{recursive:true,force:true});}catch{}});}
module.exports={readBackground};
