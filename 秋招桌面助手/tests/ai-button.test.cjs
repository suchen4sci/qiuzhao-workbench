const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('page AI button sends start, shows progress immediately and stops only an active task',async()=>{
 const elements=new Map(),commands=[];
 const el=id=>{if(!elements.has(id))elements.set(id,{textContent:'',disabled:false});return elements.get(id)};
 let release;const pending=new Promise(r=>release=r);
 const context={window:{__aiReaderHeartbeat:Date.now(),aiReaderCommand:async r=>{commands.push(r.action);if(r.action==='start')await pending;}},document:{getElementById:el,createElement:()=>({}),querySelector:()=>({append:e=>elements.set('ai-reader-state',e)})},attempt:f=>f(),closePanel:async()=>{},openPanel:async()=>{},$:el,busy:false,toast:()=>{},Date,setInterval:()=>1,clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/ui/ai-reader.js'),'utf8'),context);
 const task=el('ai').onclick();await new Promise(r=>setImmediate(r));
 assert.deepEqual(commands,['start']);assert.match(el('ai-reader-state').textContent,/发送/);assert.equal(el('fill').disabled,true);
 release();await task;await el('ai').onclick();assert.deepEqual(commands,['start','stop']);
});
test('Codex worker gets rg and node even when desktop PATH is missing', {skip:process.platform!=='win32'},()=>{
 const {findCodex,codexEnvironment}=require('../src/ai-reader.cjs');
 const executable=findCodex(),old=process.env.PATH;
 try{
 process.env.PATH=process.env.SystemRoot+'\\System32';
 const env=codexEnvironment(executable),{execFileSync}=require('node:child_process');
 const shell=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
 const result=execFileSync(shell,['-NoProfile','-Command','(Get-Command rg -ErrorAction Stop).Source; (Get-Command node -ErrorAction Stop).Source'],{env,encoding:'utf8',windowsHide:true});
 assert.match(result,/rg\.exe/);assert.match(result,/node\.exe/);
 }finally{process.env.PATH=old;}
});
test('AI progress sits beside its button, exposes task evidence and unlocks on lost heartbeat',()=>{
 let now=100000,tick;const elements=new Map();
 const el=id=>{if(!elements.has(id))elements.set(id,{style:{},textContent:'',disabled:false,after:child=>elements.set('adjacent',child)});return elements.get(id)};
 const context={window:{__aiReaderHeartbeat:now},document:{getElementById:el,createElement:()=>({style:{}}),querySelector:()=>({append:e=>elements.set('ai-reader-state',e)})},attempt:f=>f(),closePanel:async()=>{},openPanel:async()=>{},$:el,busy:false,toast:()=>{},Date:{now:()=>now},setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{}};
 vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../src/ui/ai-reader.js'),'utf8'),context);
 context.window.showAIReaderState({active:true,message:'Codex执行第3步',detail:'Codex任务：verified-thread'});
 assert.equal(elements.get('adjacent'),el('ai-reader-state'));assert.match(el('ai-reader-state').title,/verified-thread/);
 now+=3000;tick();assert.match(el('ai-reader-state').textContent,/3秒/);assert.equal(el('fill').disabled,true);
 now+=4000;tick();assert.equal(el('fill').disabled,false);assert.match(el('ai-reader-state').textContent,/连接已断开/);
});
test('equivalent Moka routes retain exact employer isolation',()=>{
 const {confirmedRecordValue}=require('../src/engine.cjs');
 const record={portalOverrides:[{key:'referralCode',origin:'https://app.mokahr.com',path:'/campus-recruitment/tenant-a/123',value:'confirmed-code'}]};
 assert.equal(confirmedRecordValue(record,'referralCode','https://app.mokahr.com','https://app.mokahr.com/campus_apply/tenant-a/123#/apply').value,'confirmed-code');
 assert.equal(confirmedRecordValue(record,'referralCode','https://app.mokahr.com','https://app.mokahr.com/campus_apply/tenant-b/123').value,undefined);
 assert.equal(confirmedRecordValue(record,'referralCode','https://app.mokahr.com','https://different.example/campus_apply/tenant-a/123').value,undefined);
});
test('attachment evidence waits do not rerun repair, real upload failures still do',()=>{
 const {technicalPending}=require('../src/ai-reader.cjs');
 const waits={label:'上传简历',status:'pending',reason:'附件上传入口尚未核验，须检查所需真实文件；未自动上传'};
 assert.deepEqual(technicalPending([waits]),[]);
 assert.deepEqual(technicalPending([{...waits,reason:'页面显示附件文件名，须单独核验真实文件及上传结果；未自动上传'}]),[]);
 assert.equal(technicalPending([{...waits,status:'failed'}]).length,1);
 assert.equal(technicalPending([{...waits,reason:'附件控件无法定位'}]).length,1);
 assert.equal(technicalPending([{label:'民族',status:'pending',reason:'没有找到目标选项'}]).length,1);
});
