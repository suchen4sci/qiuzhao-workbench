const fs=require('node:fs'),path=require('node:path');
const {spawn,execFile}=require('node:child_process');
const {chromium}=require('playwright-core');
const {findCodex,promptFor,verifyChecks,runCodex,technicalPending:classifyTechnicalPending}=require('../src/ai-reader.cjs');
const repo=path.resolve(__dirname,'..'),workspace=process.env.QIUZHAO_WORKSPACE||path.resolve(repo,'../.local-workspace');
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 const connection=JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'QiuzhaoWorkbench/app-connection.json'),'utf8'));
 const browser=await chromium.connectOverCDP(`http://127.0.0.1:${connection.port}`);
 // An observer must not auto-accept/dismiss dialogs owned by another CDP connection.
 for(const context of browser.contexts()){for(const p of context.pages())p.on('dialog',()=>{});context.on('page',p=>p.on('dialog',()=>{}));}
 const ui=browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/src/ui/index.html'));
 if(!ui)throw Error('没有找到工作台');
 if(await ui.evaluate(()=>Date.now()-(window.__aiReaderHeartbeat||0)<5000)){await browser.close();return;}
 let active=false,cancelled=false,worker,lastState,threadId='',timedOut=false;
 const state=async(message,detail)=>{lastState={active,message,detail: `${threadId?'Codex任务：'+threadId+'\n\n':''}${detail||''}`};await ui.evaluate(s=>window.showAIReaderState?.(s),lastState);};
 const stop=()=>{cancelled=true;if(worker?.pid)execFile('taskkill.exe',['/PID',String(worker.pid),'/T','/F'],{windowsHide:true},()=>{});ui.evaluate(()=>document.getElementById('stop').click()).catch(()=>{});};
 async function start(){
  if(active)throw Error('AI读取正在执行');
  if(await ui.evaluate(()=>busy))throw Error('请等待快速填写完成');
  if(active)throw Error('AI读取正在执行'); // Recheck after the async preflight: two desktop clicks must not spawn two workers.
  const pages=[await require('../src/active-page.cjs').resolveActivePage(browser,ui)];
  if(!/^https?:/.test(pages[0].url()))throw Error('请打开真实招聘表单');
  const page=pages[0],target=page.url(),tabId=(await ui.evaluate(()=>window.desktop.call('application-tabs',{action:'context'}))).tabId,executable=findCodex();
  const root=path.join(repo,'artifacts','ai-reader',new Date().toISOString().replace(/[:.]/g,'-'));
  fs.mkdirSync(root,{recursive:true});
  active=true;cancelled=false;threadId='';timedOut=false;let feedback;
  const visited=new Set([target]);
  const sameOrigin=()=>{try{return new URL(page.url()).origin===new URL(target).origin;}catch{return false;}};
  const guard=()=>{if(cancelled)throw Error('已停止，已填写的内容保留');if(!sameOrigin())throw Error('页面已经切换，任务停止，未继续填写');};
  const navigation=frame=>{if(frame!==page.mainFrame())return;if(!sameOrigin())stop();else visited.add(page.url());};page.on('framenavigated',navigation);
  try{
   await state('AI已接收任务：读取页面，准备启动Codex',`已连接当前招聘页。私有运行记录：${root}`);
   fs.writeFileSync(path.join(root,'before.html'),await page.content());
   for(let round=1;round<=3;round++){
    guard();const directory=path.join(root,String(round));fs.mkdirSync(directory);
    await state(`第 ${round}/3 轮：AI读取并修正规则`, `正在使用本机 Codex。私有运行记录：${root}`);
    let steps=0,lastMessage='正在读取页面并检查规则';
    const task=runCodex({executable,workspace,directory,prompt:promptFor({workspace,repo,target,tabId,directory,round,feedback}),onEvent:e=>{if(e.type==='thread.started'){threadId=e.thread_id||'';state('已向 Codex 发送任务',fs.readFileSync(path.join(repo,'一键补全与学习.md'),'utf8')).catch(()=>{});}if(e.type==='turn.started')state('Codex已开始读取页面和规则').catch(()=>{});if(e.type==='startup_timeout')state('Codex后台启动超时',e.message).catch(()=>{});if(e.type==='error')state('Codex连接重试中',e.message).catch(()=>{});if(e.type==='item.started'&&e.item?.type==='command_execution'){steps++;state(`第 ${round}/3 轮：Codex执行第${steps}步`,lastMessage).catch(()=>{});}if(e.type==='item.completed'&&e.item?.type==='agent_message'){lastMessage=e.item.text;state(`第 ${round}/3 轮：Codex处理中`,lastMessage).catch(()=>{});}}});
    worker=task.child;const timer=setTimeout(()=>{timedOut=true;stop();},20*60*1000);
    let result;try{result=await task.promise;}finally{clearTimeout(timer);worker=null;}guard();
    await state(`第 ${round}/3 轮：加载新规则并快速填写`);
    const hot=spawn(process.execPath,[path.join(__dirname,'update-live-engine.cjs')],{cwd:repo,env:{...process.env,ELECTRON_RUN_AS_NODE:'1'},windowsHide:true,stdio:['ignore','pipe','pipe']});
    await new Promise((resolve,reject)=>{let output='';const timer=setTimeout(()=>{hot.kill();reject(Error('新规则加载超时'));},20000);hot.on('error',e=>{clearTimeout(timer);reject(e);});hot.stdout.on('data',d=>{output+=d;if(output.includes('Updated live quick-fill engine')){clearTimeout(timer);resolve();}});hot.on('exit',()=>{clearTimeout(timer);reject(Error('新规则服务已退出'));});});
    guard();await ui.evaluate(()=>run('fill'));guard();
    await state(`第 ${round}/3 轮：独立回读验证`);
    const failures=await verifyChecks(page,result.checks,{allowedUrls:[...visited]});
    const report=await ui.evaluate(()=>lastReport);
    feedback={failures,counts:report?.counts,pending:report?.fields?.filter(f=>['pending','failed','ready'].includes(f.status)).map(f=>({label:f.label,reason:f.reason,status:f.status}))};
    fs.writeFileSync(path.join(directory,'verification.json'),JSON.stringify({result,feedback},null,2));
    const technicalPending=classifyTechnicalPending(feedback.pending,result.blockedLabels);
    if(!technicalPending.length&&!failures.length&&!report?.runtime?.sourceChanged&&!report?.counts?.failed&&!report?.counts?.ready){
      const needs=!!result.questions?.length||!!report?.counts?.pending;
      active=false;await state(needs?'快速填写已复测，仍有待确认项':'快速填写及回读验证通过',`${result.summary}\n\n${(result.questions||[]).join('\n')}\n\n${(feedback.pending||[]).map(f=>`${f.label}：${f.reason||f.status}`).join('\n')}\n\n运行记录：${root}`);return;
    }
   }
   active=false;await state('三轮修正后仍有问题，请查看结果',JSON.stringify(feedback,null,2)+`\n运行记录：${root}`);
  }catch(e){active=false;await state(timedOut?'Codex任务超时，已保留填写内容':cancelled?'AI读取已停止':'AI读取未完成',`${e.message}\n运行记录：${root}`);}
  finally{active=false;page.off('framenavigated',navigation);}
 }
 const binding='aiReaderCommand_'+process.pid+'_'+Date.now();
 const native=binding+'_native', session=await ui.context().newCDPSession(ui);
 await session.send('Runtime.addBinding',{name:native});
 session.on('Runtime.bindingCalled',async event=>{
  if(event.name!==native)return;
  let message;try{message=JSON.parse(event.payload);}catch{return;}
  let result,error;
  try{if(message.request.action==='stop'){stop();result=true;}else if(message.request.action==='start'){start().catch(e=>state('无法开始 AI读取',e.message));result={started:true};}else throw Error('未知操作');}catch(e){error=e.message;}
  await session.send('Runtime.evaluate',{expression:'window['+JSON.stringify(binding+'_settle')+']('+JSON.stringify({id:message.id,result,error})+')'}).catch(()=>{});
 });
 await ui.evaluate(({binding,native})=>{
  const pending=new Map();let next=0;
  window.aiReaderCommand=request=>new Promise((resolve,reject)=>{const id=++next;const timer=setTimeout(()=>{pending.delete(id);reject(Error('AI服务没有响应，请重新连接'));},10000);pending.set(id,{resolve,reject,timer});window[native](JSON.stringify({id,request}));});
  window[binding+'_settle']=m=>{const p=pending.get(m.id);if(!p)return;pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error)):p.resolve(m.result);};
  window.__aiReaderServiceReady=true;
 },{binding,native});
 await ui.addScriptTag({url:new URL('ai-reader.js',ui.url()).href});
 await state('AI读取已连接');
 ui.on('close',()=>{stop();process.exit(0);});browser.on('disconnected',()=>{stop();process.exit(0);});
 setInterval(()=>{ui.evaluate(()=>window.__aiReaderHeartbeat=Date.now()).catch(()=>{});if(active&&lastState)ui.evaluate(s=>window.showAIReaderState?.(s),lastState).catch(()=>{});},1000);
 console.log('AI reader connected');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
