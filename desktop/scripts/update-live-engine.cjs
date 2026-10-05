// Update the shell's quick-fill bridge without reloading the user's recruitment page.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require('playwright-core');
const { loadProfile } = require('../src/profile.cjs');
const { loadLearnedFields } = require('../src/learned-fields.cjs');
const { fillPage, scanPage, report } = require('../src/engine.cjs');
const { runtimeInfo, withRuntime } = require('../src/runtime-version.cjs');
const { ensureRendering } = require('../src/render-health.cjs');
const { execFile } = require('node:child_process');
(async () => {
  const { port, pid: appPid } = JSON.parse(fs.readFileSync(path.join(process.env.APPDATA,'QiuzhaoWorkbench/app-connection.json'),'utf8'));
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  const ui = browser.contexts().flatMap(c=>c.pages()).find(p=>p.url().includes('/src/ui/index.html'));
  if (!ui) throw new Error('找不到填表助手窗口');
  let busy = false, cancelled = false;
  const bridge = '__updatedQuickFill_' + Date.now();
  const sync = request => ui.evaluate(request => window.desktop.call('sync-hot-report', request), request);
  let hostSync = false;
  try { hostSync = (await sync({ phase: 'probe' })).supported === true; }
  catch (error) {
    if (!/Unknown action|No handler registered/.test(error.message)) throw error;
    console.log('Hot engine connected; the running main process has no report-sync channel. Runtime will explicitly show unsynchronized host state.');
  }
  const execute = async request => {
    if (request.mode === 'stop') { cancelled = true; return; }
    if (busy || !['fill','inspect','draft','profile'].includes(request.mode)) throw new Error('请等待当前填写结束');
    if (request.mode === 'profile') {
      const profile = loadProfile(path.resolve(__dirname, '../..'));
      return { library: profile.library, sources: profile.sources, notes: profile.notes };
    }
    if ((await ui.evaluate(()=>window.desktop.call('teaching',{action:'status'}))).active) throw new Error('请先结束教学');
    const pages = browser.contexts().flatMap(c=>c.pages()).filter(p=>p!==ui && !p.url().startsWith('http://127.0.0.1:33210'));
    if (pages.length !== 1) throw new Error('无法唯一识别当前招聘页');
    if(request.mode==='draft')return require('../src/job-context.cjs').readContext(pages[0]);
    const profile = loadProfile(path.resolve(__dirname,'../..'));
    profile.learnedFields = loadLearnedFields(path.resolve(__dirname,'../..'));
    busy = true; cancelled = false;
    const runId = bridge + ':' + Date.now();
    let result, syncedBegin = false;
    try {
      if (hostSync) { await sync({ phase: 'begin', runId }); syncedBegin = true; }
      const renderHealth = request.mode === 'fill' ? await ensureRendering(pages[0], process.platform === 'win32' ? () => new Promise((resolve, reject) => {
        if (!Number.isInteger(appPid) || appPid <= 0) return reject(new Error('连接记录缺少有效应用进程，不能恢复窗口'));
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', path.join(__dirname, 'restore-window.ps1'), '-ProcessId', String(appPid)], { windowsHide: true, timeout: 10000 }, error => error ? reject(new Error('招聘窗口恢复失败，请手动恢复后重试')) : resolve());
      }) : undefined) : undefined;
      const cleanSelections = Object.fromEntries(Object.entries(request.selections || {}).filter(([key, value]) => profile.values[key] && Number.isInteger(value) && value >= 0 && value < profile.values[key].length));
      result = request.mode === 'fill' ? await fillPage(pages[0], profile, cleanSelections, ()=>cancelled) : require('../src/qiyuan.cjs').isQiyuan(pages[0]) ? await require('../src/qiyuan.cjs').fillQiyuan(pages[0],profile,()=>cancelled,true) : require('../src/aircas.cjs').isAircas(pages[0]) ? await require('../src/aircas.cjs').fillAircas(pages[0],profile,()=>cancelled,true) : require('../src/wjx.cjs').isWjx(pages[0]) ? await require('../src/wjx.cjs').fillWjx(pages[0],profile,()=>cancelled,true) : report(await scanPage(pages[0],profile,cleanSelections));
      result = withRuntime(result, 'hot', { hostSync: hostSync ? 'connected' : 'unavailable', renderHealth });
      return result;
    } finally {
      if (syncedBegin) {
        try { await sync({ phase: 'end', runId, report: result }); }
        catch (error) { if (result) result.runtime.hostSync = 'failed'; console.error('Hot report could not synchronize to main: ' + error.message); }
      }
      busy = false;
    }
  };
  const session=await ui.context().newCDPSession(ui);
  const native=bridge+'_native';
  await session.send('Runtime.addBinding',{name:native});
  session.on('Runtime.bindingCalled',async event=>{
    if(event.name!==native)return;
    let message;try{message=JSON.parse(event.payload)}catch{return}
    try{const result=await execute(message.request);await session.send('Runtime.evaluate',{expression:'window['+JSON.stringify(bridge+'_settle')+']('+JSON.stringify({id:message.id,result})+')'});}
    catch(e){await session.send('Runtime.evaluate',{expression:'window['+JSON.stringify(bridge+'_settle')+']('+JSON.stringify({id:message.id,error:e.message})+')'}).catch(()=>{});}
  });
  await ui.evaluate(({bridge,native})=>{
    const pending=new Map();let id=0;
    window[bridge]=request=>new Promise((resolve,reject)=>{pending.set(++id,{resolve,reject});window[native](JSON.stringify({id,request}));});
    window[bridge+'_settle']=message=>{const p=pending.get(message.id);if(!p)return;pending.delete(message.id);message.error?p.reject(new Error(message.error)):p.resolve(message.result);};
  },{bridge,native});
  await ui.evaluate(bridge => {
    window.__jobDraft=()=>window[bridge]({mode:'draft'});
    run = async mode => {
      await closePanel(); setBusy(true);
      try { lastReport = await window[bridge]({mode,selections}); updateSummary(); toast(`已填写 ${lastReport.counts.filled} 项，保留 ${lastReport.counts.existing} 项，${lastReport.counts.pending} 项待处理。`); }
      finally { setBusy(false); }
    };
    document.getElementById('stop').onclick = () => window[bridge]({mode:'stop'});
  }, bridge);
  await ui.addScriptTag({url:new URL('control-trace.js',ui.url()).href});
  await ui.addScriptTag({url:new URL('runtime-status.js',ui.url()).href});
  await ui.addScriptTag({url:new URL('hot-profile.js',ui.url()).href});
  await ui.evaluate(bridge => window.installHotProfile(bridge), bridge);
  await ui.evaluate(info => window.showRuntimeStatus(info), runtimeInfo('hot', { hostSync: hostSync ? 'connected' : 'unavailable' }));
  console.log('Updated live quick-fill engine; recruitment page preserved.');
  ui.on('close',()=>process.exit(0)); browser.on('disconnected',()=>process.exit(0));
  setInterval(()=>{},30000);
})().catch(e=>{console.error(e.message);process.exitCode=1;});


