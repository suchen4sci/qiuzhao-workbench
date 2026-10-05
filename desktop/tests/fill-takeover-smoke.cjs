const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict'),{_electron}=require('playwright-core');
(async()=>{
 const root=path.resolve(__dirname,'../..'),workspace=fs.mkdtempSync(path.join(os.tmpdir(),'fill-takeover-'));
 require('../../tools/copy-tree.cjs').copyTree(path.join(root,'examples/demo-workspace'),workspace);
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_WORKSPACE:workspace,QIUZHAO_USER_DATA:path.join(workspace,'browser')};delete env.ELECTRON_RUN_AS_NODE;
 let app;try{
  app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'desktop')],env});await app.firstWindow();let ui,page;
  for(let n=0;n<100;n++){ui=app.context().pages().find(p=>p.url().includes('/ui/index.html'));page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(ui&&page)break;await new Promise(r=>setTimeout(r,100));}
  assert(ui&&page);await ui.waitForFunction(()=>!!window.workbenchUI);await ui.evaluate(()=>window.workbenchUI.show('browser'));
  const prepare=async()=>page.setContent('<h2>基本信息</h2><label>姓名<input id="name"></label><label>手机号码<input id="phone"></label><label>电子邮箱<input id="email"></label>');
  const native=async(kind)=>app.evaluate(({webContents},kind)=>{const overlay=webContents.getAllWebContents().find(w=>w.getURL().endsWith('fill-takeover.html'));if(kind==='mouse'){overlay.sendInputEvent({type:'mouseDown',x:100,y:100,button:'left',clickCount:1});overlay.sendInputEvent({type:'mouseUp',x:100,y:100,button:'left',clickCount:1});}else overlay.sendInputEvent({type:'keyDown',keyCode:'a'});},kind);
  for(const kind of ['mouse','key']){
   await prepare();const running=ui.evaluate(()=>run('fill'));await page.waitForFunction(()=>document.querySelector('#name').value.length>0);
   const visible=await app.evaluate(({BrowserWindow})=>{const views=BrowserWindow.getAllWindows()[0].contentView.children;return views.map(v=>({url:v.webContents?.getURL(),visible:v.getVisible?.(),bounds:v.getBounds()}));});
   assert(visible.at(-1).url.endsWith('fill-takeover.html'));assert(visible.at(-1).visible);assert.deepEqual(visible.at(-1).bounds,visible.at(-2).bounds);
   await native(kind);await running;const report=await ui.evaluate(()=>lastReport);assert.equal(report.execution.state,'paused');assert.equal(await page.locator('#phone').inputValue(),'');assert.match(await ui.locator('#fill').innerText(),/重新扫描/);
   await page.locator('#name').fill('人工姓名');await ui.evaluate(()=>run('fill'));assert.equal(await page.locator('#name').inputValue(),'人工姓名');assert((await page.locator('#phone').inputValue()).length>0);assert.equal((await ui.evaluate(()=>lastReport)).execution.state,'complete');
  }
  // Explicit pause and page navigation stop the run; the native barrier is removed only after settlement.
  await prepare();let running=ui.evaluate(()=>run('fill'));await page.waitForFunction(()=>document.querySelector('#name').value.length>0);await ui.evaluate(()=>call('stop'));await running;assert.equal((await ui.evaluate(()=>lastReport)).execution.state,'paused');
  await prepare();running=ui.evaluate(()=>run('fill'));await page.waitForFunction(()=>document.querySelector('#name').value.length>0);await page.evaluate(()=>location.hash='next-step');await running;assert.equal((await ui.evaluate(()=>lastReport)).execution.state,'paused');assert.equal(await page.locator('#phone').inputValue(),'');
  const screenshot=await app.evaluate(async({BrowserWindow})=>(await BrowserWindow.getAllWindows()[0].capturePage()).toDataURL());fs.writeFileSync('/tmp/qiuzhao-fill-paused.png',Buffer.from(screenshot.split(',')[1],'base64'));
  console.log('PASS native click/key takeover, AbortSignal settlement, explicit pause/navigation, rescan preserves manual edits, ordinary fill continues after barrier removal.');
 }finally{if(app)await app.close();fs.rmSync(workspace,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
