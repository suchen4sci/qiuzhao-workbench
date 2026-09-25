const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
console.log('starting smoke');
const {_electron}=require('playwright-core');
(async()=>{
 const root=path.resolve(__dirname,'../..'),workspace=fs.mkdtempSync(path.join(os.tmpdir(),'qiuzhao-public-'));
 require('../../tools/copy-tree.cjs').copyTree(path.join(root,'examples/demo-workspace'),workspace);
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_WORKSPACE:workspace,QIUZHAO_USER_DATA:path.join(workspace,'browser')};delete env.ELECTRON_RUN_AS_NODE;
 console.log('launching smoke desktop');
 const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'秋招桌面助手')],env});
 try{
  await app.firstWindow();let ui;for(let n=0;n<100;n++){ui=app.context().pages().find(p=>p.url().includes('/src/ui/index.html'));if(ui)break;await new Promise(r=>setTimeout(r,100));}assert(ui);await ui.waitForSelector('.record',{timeout:10000}).catch(async e=>{console.log(await ui.locator('body').innerText());throw e;});let page;
  for(let n=0;n<100;n++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert(page);await page.waitForSelector('#name');await ui.evaluate(()=>run('fill'));
  assert.equal(await page.locator('#name').inputValue(),'林知远（虚构演示）');
  const report=await ui.evaluate(()=>lastReport);assert(report.counts.filled>0);assert.equal(report.counts.failed,0);
  await ui.evaluate(()=>run('fill'));assert.equal((await ui.evaluate(()=>lastReport)).counts.filled,0);
  console.log('PASS desktop starts, loads fictional KB, real quick-fill and idempotent readback');
 }finally{await app.close();}
 process.env.QIUZHAO_WORKSPACE=workspace;
 const store=await import('../../秋招看板/网页看板/lib/store.mjs');
 const baseline=(await store.listJobs()).length;
 const job=await store.addJob({'公司名称':'演示企业','投递岗位':'Agent开发','当前状态':'待投递'});
 const changed=await store.updateJob(job['记录ID'],{'当前状态':'已投递'},job.__version);
 assert.equal(changed['当前状态'],'已投递');assert.equal((await store.listJobs()).length,baseline+1);
 await assert.rejects(store.addJob({'公司名称':'演示企业','投递岗位':'Agent开发'}),e=>e.code==='DUPLICATE');
 await assert.rejects(store.updateJob(job['记录ID'],{'当前状态':'Offer'},job.__version),e=>e.code==='CONFLICT');
 console.log('PASS portable dashboard create/update/persistence/deduplication/conflict');
})().catch(e=>{console.error(e);process.exitCode=1;});
