// Desktop entry point: use the same authenticated AI workflow as the workbench button.
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require('playwright-core'),{triggerAI}=require('../src/desktop-ai-trigger.cjs');
const repo=path.resolve(__dirname,'..'),directory=path.join(process.env.APPDATA,'QiuzhaoWorkbench');
async function connect(){const c=JSON.parse(fs.readFileSync(path.join(directory,'app-connection.json'),'utf8'));return chromium.connectOverCDP('http://127.0.0.1:'+c.port,{timeout:2000});}
(async()=>{fs.mkdirSync(directory,{recursive:true});let browser;
 try{browser=await connect();}catch(error){
  if(process.argv.includes('--check'))throw Error('工作台未打开');
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const app=spawn(require('electron'),[path.join(repo,'scripts/start.cjs')],{env:{...env,ELECTRON_RUN_AS_NODE:'1'},cwd:repo,windowsHide:true,detached:true,stdio:'ignore'});app.unref();
  const deadline=Date.now()+30000;
  while(Date.now()<deadline){await new Promise(r=>setTimeout(r,200));try{browser=await connect();break;}catch{}}
 }
 if(!browser)throw Error('工作台启动失败，请先打开秋招工作台');
 try{const ui=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/src/ui/index.html'));if(!ui)throw Error('找不到工作台窗口');
  const result=await triggerAI(ui,{checkOnly:process.argv.includes('--check')});
  fs.writeFileSync(path.join(directory,'desktop-ai-result.json'),JSON.stringify({at:new Date().toISOString(),...result},null,2));
  console.log(JSON.stringify(result));
 }finally{await browser.close();}
})().catch(error=>{fs.mkdirSync(directory,{recursive:true});fs.writeFileSync(path.join(directory,'desktop-ai-result.json'),JSON.stringify({status:'failed',message:error.message}));console.error(error.message);process.exitCode=1;});
