(() => {
 const button=document.getElementById('ai');
 const previous=window.__aiReaderState||{active:button.textContent==='停止 AI读取',message:document.getElementById('ai-reader-state')?.textContent};
 button.textContent='✧ AI读取';
 button.title='读取页面 → 修正规则 → 快速填写 → 回读验证；使用本机 Codex 登录';
 let active=false,startedAt=0;
 function renderElapsed(){
  const state=window.__aiReaderState;if(!state)return;
  const elapsed=startedAt?Math.floor((Date.now()-startedAt)/1000):0;
  const duration=elapsed>=60?`${Math.floor(elapsed/60)}分${elapsed%60}秒`:`${elapsed}秒`;
  const bar=document.getElementById('ai-reader-state');
  if(bar)bar.textContent=state.message+(state.active?` · ${duration}`:'');
 }
 window.showAIReaderState = state => {
   if(state.active&&!active)startedAt=Date.now();
   if(!state.active)startedAt=0;
   window.__aiReaderState=state;
   active=!!state.active;
   let bar=document.getElementById('ai-reader-state');
   if(!bar){bar=document.createElement('button');bar.id='ai-reader-state';bar.className='text-button';document.querySelector('.actionbar').append(bar);}
   if(button.after)button.after(bar);
   if(bar.style){bar.style.cssText='margin-left:0;max-width:340px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#235ed8;text-align:left';}
   bar.setAttribute?.('aria-live','polite');
   renderElapsed();bar.title=[state.message,state.detail,'点击查看运行结果及待确认问题'].filter(Boolean).join('\n');
   bar.onclick=()=>attempt(async()=>{await openPanel('AI读取运行记录','自动修正规则');$('panel-body').textContent=state.detail || state.message;});
   button.textContent=active?'停止 AI读取':'✧ AI读取';
   button.disabled=false;
   if(/无法|未完成|重试/.test(state.message))toast(state.message + (state.detail ? '：'+state.detail.slice(0,160) : '')); 
   for(const id of ['fill','inspect','refresh','demo','reload','url'])$(id).disabled=active || busy;
 };
 button.onclick=()=>attempt(async()=>{
   if(!window.aiReaderCommand||Date.now()-(window.__aiReaderHeartbeat||0)>5000)throw Error('Codex服务尚未连接，尚未发送任务；请等待服务重连');
   await closePanel();
   const action=active?'stop':'start';
   if(!active)window.showAIReaderState({active:true,message:'正在向 Codex 发送补全与学习任务',detail:'读取当前网页 → 补全并纠错 → 沉淀通用规则 → 快速填写复测 → 独立回读；不最终投递。'});
   try{await window.aiReaderCommand({action});}catch(e){window.showAIReaderState({active:false,message:'Codex任务发送失败',detail:e.message});throw e;}
 });
 if(previous.message)window.showAIReaderState(previous);
 if(window.__aiReaderProgressTimer)clearInterval(window.__aiReaderProgressTimer);
 window.__aiReaderProgressTimer=setInterval(()=>{
  if(active&&Date.now()-(window.__aiReaderHeartbeat||0)>6000){window.showAIReaderState({active:false,message:'AI连接已断开，任务状态待核对',detail:'后台没有心跳，已恢复按钮；请重新连接服务后检查已有任务，勿重复启动。'});return;}
  renderElapsed();
 },1000);
})();
