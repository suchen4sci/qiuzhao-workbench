const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {_electron}=require('playwright-core');
test('closing and reopening restores tabs, session cookie and storage before website scripts; logout is respected',async()=>{
 const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html');res.end('<title>Restart fixture</title><div id="ready">ready</div><script>window.initialToken=sessionStorage.getItem("token");window.initialLocal=localStorage.getItem("local");</script>');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+server.address().port;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qiuzhao-restart-'));
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_TEST_RETENTION:'1',QIUZHAO_USER_DATA:dir};delete env.ELECTRON_RUN_AS_NODE;
 const launch=()=>_electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 const shell=async app=>{await app.firstWindow();for(let i=0;i<100;i++){const p=app.context().pages().find(p=>p.url().includes('/src/ui/index.html'));if(p){await p.waitForSelector('#application-tabbar');return p;}await new Promise(r=>setTimeout(r,100));}throw Error('shell missing');};
 let app;try{
  app=await launch();let ui=await shell(app);
  const tab=await ui.evaluate(url=>window.desktop.call('application-tabs',{action:'open',url,company:'测试公司'}),origin+'/resume');
  let p;for(let i=0;i<100;i++){p=app.context().pages().find(p=>p.url()===origin+'/resume');if(p)break;await new Promise(r=>setTimeout(r,100));}await p.waitForSelector('#ready');
  await p.evaluate(()=>{sessionStorage.setItem('token','fixture-secret');localStorage.setItem('local','local-value');document.cookie='fixtureSession=authenticated; path=/';});
  await app.close();app=null;
  assert.ok(fs.existsSync(path.join(dir,'login-session.encrypted')));
  assert.equal(fs.readFileSync(path.join(dir,'login-session.encrypted')).includes(Buffer.from('fixture-secret')),false);
  app=await launch();ui=await shell(app);
  for(let i=0;i<100;i++){p=app.context().pages().find(p=>p.url()===origin+'/resume');if(p)break;await new Promise(r=>setTimeout(r,100));}await p.waitForSelector('#ready');
  const state=await ui.evaluate(()=>window.desktop.call('application-tabs',{action:'list'}));assert.equal(state.activeId,tab.id);assert(state.tabs.some(t=>t.id===tab.id&&t.company==='测试公司'));
  assert.equal(await p.evaluate(()=>window.initialToken),'fixture-secret');assert.equal(await p.evaluate(()=>window.initialLocal),'local-value');assert.match(await p.evaluate(()=>document.cookie),/fixtureSession=authenticated/);
  await p.evaluate(()=>{sessionStorage.clear();document.cookie='fixtureSession=; Max-Age=0; path=/';});await p.reload();assert.equal(await p.evaluate(()=>window.initialToken),null);
  await app.close();app=null;app=await launch();ui=await shell(app);
  for(let i=0;i<100;i++){p=app.context().pages().find(p=>p.url()===origin+'/resume');if(p)break;await new Promise(r=>setTimeout(r,100));}await p.waitForSelector('#ready');
  assert.equal(await p.evaluate(()=>window.initialToken),null);assert.doesNotMatch(await p.evaluate(()=>document.cookie),/fixtureSession=authenticated/);
 }finally{if(app)await app.close();server.close();}
});
