const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {_electron}=require('playwright-core');
(async()=>{
 const root=path.resolve(__dirname,'../..'), workspace=fs.mkdtempSync(path.join(os.tmpdir(),'workbench-ui-'));
 require('../../tools/copy-tree.cjs').copyTree(path.join(root,'templates/blank-workspace'),workspace);
 if(process.env.TEST_RECOVERY){const facts=require('../src/services/profile-service.cjs').createProfileService(workspace);const prior=facts.read();facts.save(prior.profile,prior.hash);fs.writeFileSync(path.join(workspace,'知识库/profile.json'),'{corrupt');}
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_WORKSPACE:workspace,QIUZHAO_USER_DATA:path.join(workspace,'browser')};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'desktop')],env});
 const errors=[];
 try{
  await app.firstWindow();let ui;for(let i=0;i<100;i++){ui=app.context().pages().find(p=>p.url().includes('/ui/index.html'));if(ui)break;await new Promise(r=>setTimeout(r,100));}assert(ui);ui.on('pageerror',e=>errors.push(e.message));
  await ui.locator('#workbench-content h1').waitFor();
  if(await ui.evaluate(()=>document.body.dataset.screen==='onboarding'))await ui.locator('[data-action="onboarding-defer"]').click();
  await ui.locator('#workbench-content h1').filter({hasText:'今日'}).waitFor();
  if(process.env.TEST_RECOVERY){
   await ui.locator('[data-action="profile-edit"]').first().click();
   await ui.locator('[data-action="profile-restore"]').first().click();
   await ui.locator('#panel-body button[type="submit"]').click();
   await ui.waitForFunction(()=>window.workbenchUI.getState().profileStatus.valid);
   await ui.locator('[data-route="today"]').first().click();
  }
  assert.equal(await ui.locator('#workbench-sidebar nav button').count(),4);
  assert.ok(await ui.locator('.wb-calendar .wb-day').count()>=28);
  await ui.locator('[data-route="settings"]').click();
  await ui.locator('[data-action="profile-edit"]').first().click();
  await ui.locator('#wb-profile-form input[name="0:name"]').fill('界面测试用户');
  await ui.locator('#wb-profile-form button[type="submit"]').click();
  await ui.waitForFunction(()=>window.workbenchUI.getState().profile.profile.values.basic[0].name==='界面测试用户');
  await ui.locator('[data-action="preferences-edit"]').first().click();
  await ui.locator('[data-action="preference-add"]').click();
  await ui.locator('input[name="0:name"]').fill('技术或销售');
  await ui.locator('input[name="0:direction"]').fill('技术,销售');
  await ui.locator('#wb-preferences-form button[type="submit"]').click();
  await ui.locator('#panel-body input[name="confirmed"]').check();
  await ui.locator('#panel-body button[type="submit"]').click();
  await ui.waitForFunction(()=>window.workbenchUI.getState().preferences.plans.length===1);
  await ui.locator('[data-route="today"]').first().click();
  await ui.locator('[data-action="task-new"]').first().click();
  await ui.locator('#panel-body input[name="title"]').fill('整理项目表达');
  await ui.locator('#panel-body button[type="submit"]').click();
  await ui.locator('.wb-task-row').filter({hasText:'整理项目表达'}).waitFor();
  await ui.locator('[data-action="task-complete"]').first().click();
  await ui.locator('#panel-body textarea[name="result"]').fill('整理了问题、行动和结果');
  await ui.locator('#panel-body button[type="submit"]').click();
  await ui.locator('.wb-task-row.is-complete').waitFor();
  assert.ok(await ui.locator('.wb-calendar .heat-1').count()>=1);
  await ui.locator('[data-route="opportunities"]').first().click();
  await ui.locator('[data-action="opportunity-new"]').first().click();
  await ui.locator('#panel-body input[name="company"]').fill('测试公司');
  await ui.locator('#panel-body input[name="title"]').fill('软件工程师');
  await ui.locator('#panel-body input[name="direction"]').fill('技术');
  await ui.locator('#panel-body button[type="submit"]').click();
  await ui.locator('[data-action="plan-add"]').click();
  await ui.locator('#panel-body input[name="confirmed"]').check();
  await ui.locator('#panel-body button[type="submit"]').click();
  await ui.locator('[data-route="applications"]').first().click();
  await ui.locator('[data-action="plan-open"]').click();
  assert.match(await ui.locator('#panel-body').innerText(),/填写完成和网页保存均不等于正式提交/);
  await ui.locator('#close-panel').click();
  await ui.locator('[data-route="today"]').first().click();
  const output=path.join(root,'desktop/artifacts/workbench-today.png');fs.mkdirSync(path.dirname(output),{recursive:true});
  await ui.screenshot({path:output});
  assert.deepEqual(errors,[]);
  console.log('PASS four-entry desktop, profile GUI, preferences, real task completion/month heat, opportunity -> plan; screenshot:',output);
 }finally{await app.close();fs.rmSync(workspace,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
