(() => {
 const button=document.getElementById('ai');
 button.textContent='✧ AI读取';
 button.title='读取页面 → 修正规则 → 快速填写 → 回读验证；使用本机 Codex 登录';
 let active=false;
 window.showAIReaderState = state => {
   active=!!state.active;
   let bar=document.getElementById('ai-reader-state');
   if(!bar){bar=document.createElement('button');bar.id='ai-reader-state';bar.className='text-button';document.querySelector('.actionbar').append(bar);}
   bar.textContent=state.message;bar.title='点击查看运行结果及待确认问题';
   bar.onclick=()=>attempt(async()=>{await openPanel('AI读取运行记录','自动修正规则');$('panel-body').textContent=state.detail || state.message;});
   button.textContent=active?'停止 AI读取':'✧ AI读取';
   button.disabled=false;
   if(/无法|未完成|重试/.test(state.message))toast(state.message + (state.detail ? '：'+state.detail.slice(0,160) : '')); 
   for(const id of ['fill','inspect','refresh','demo','reload','url'])$(id).disabled=active || busy;
 };
 button.onclick=()=>attempt(async()=>{
   if(!window.aiReaderCommand)throw Error('AI读取服务尚未连接，请稍后重试');
   await closePanel();
   await window.aiReaderCommand({action:active?'stop':'start'});
 });
})();
