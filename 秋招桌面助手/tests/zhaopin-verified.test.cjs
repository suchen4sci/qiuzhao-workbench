const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadPlan,orderedEntries,fillVerified}=require('../src/zhaopin-verified.cjs');
test('verified employer plans cannot leak to other employers or unapproved projects',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'scrd-plan-'));
 fs.mkdirSync(path.join(root,'知识库/06-网站适配'),{recursive:true});
 fs.writeFileSync(path.join(root,'知识库/06-网站适配/智联逐栏已核验.json'),JSON.stringify({templates:[{projectId:'123',saveAuthorized:true}]}));
 const page=url=>({url:()=>url}),profile={workspaceRoot:root};
 assert.ok(loadPlan(page('https://xiaoyuan.zhaopin.com/scrd/resume2?projectId=123'),profile));
 assert.equal(loadPlan(page('https://xiaoyuan.zhaopin.com/scrd/resume2?projectId=456'),profile),null);
 assert.equal(loadPlan(page('https://example.com/scrd/resume2?projectId=123'),profile),null);
 assert.deepEqual(orderedEntries({'项目开始时间':'2026-01-01','项目结束时间':'2026-05-01'},{'项目结束时间':'2022-06-01'}).map(x=>x[0]),['项目结束时间','项目开始时间']);
});
test('date transition ignores leaving panel; verified fill repairs saved omission and is idempotent',async()=>{
 const {_electron}=require('playwright-core');const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'scrd-ui-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<80;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page);page.setDefaultTimeout(2000);
  await page.setContent(`<input id="date" readonly><div class="el-date-picker el-zoom-in-top-leave-active">old panel</div><div id="active" class="el-date-picker" style="display:none"><div class="el-date-picker__header">2026 年5 月</div><table class="el-date-table"><tr><td class="available">1</td></tr></table></div><script>date.onclick=()=>active.style.display='block';active.querySelector('td').onclick=()=>{date.value='2026-05-01';active.style.display='none'};</script>`);
  assert.equal(await require('../src/element-controls.cjs').fillElementDate(page,page.locator('#date'),'2026-05-01'),'2026-05-01');
  await page.setContent(`<div class="resume-menu-item__title">项目经验</div><div class="form-content--title">项目经验</div><div class="apply-module__form"></div><button id="submit">立即投递</button><script>
   window.value='';window.submitted=false;submit.onclick=()=>window.submitted=true;
   window.draw=()=>{document.querySelector('.apply-module__form').innerHTML='<div class="apply-form"><div class="el-form-item"><label>项目名称</label><div class="el-form-item__content">TDC</div></div><div class="el-form-item"><label>职务</label><div class="el-form-item__content">'+(window.value||'--')+'</div></div><span id="edit">编辑</span></div>';edit.onclick=()=>{document.querySelector('.apply-form').innerHTML='<div class="scrd-web--form-edit"><div class="el-form-item"><label>项目名称</label><div><input value="TDC"></div></div><div class="el-form-item"><label>职务</label><div><input id="role"></div></div><button id="save">保 存</button></div>';save.onclick=()=>{window.value=role.value;draw()}}};draw();</script>`);
  const plan={sections:[{section:'项目经验',records:[{identity:{'项目名称':'TDC'},values:{'项目名称':'TDC','职务':'负责人'}}]}]};
  assert.equal((await fillVerified(page,{},plan)).counts.filled,1);
  assert.equal((await fillVerified(page,{},plan)).counts.existing,1);
  assert.equal(await page.evaluate(()=>window.submitted),false);
  assert.equal(await page.locator('.apply-form').count(),1);
  await page.setContent(`<div class="el-form-item"><label>调剂</label><div class="el-radio-group"><label class="el-radio"><input type="radio" name="adjust" value="1"><span class="el-radio__label">是</span></label><label class="el-radio"><input type="radio" name="adjust" value="2"><span class="el-radio__label">否</span></label></div></div><div class="el-form-item"><label>籍贯</label><div class="s-region"></div><input id="region" readonly></div><div role="dialog" aria-label="请选择行政区" id="regionDialog" style="display:none"><button id="province">示例省</button><button id="city" style="display:none">示例市</button><button id="district" style="display:none">示例区</button></div><script>region.onclick=()=>regionDialog.style.display='block';province.onclick=()=>city.style.display='block';city.onclick=()=>district.style.display='block';district.onclick=()=>{region.value='示例省-示例市-示例区';regionDialog.style.display='none'};</script>`);
  const flow=require('../src/zhaopin-flow.cjs');
  await flow.set(page,'调剂','是');
  assert.equal(await page.locator('input[value="1"]').isChecked(),true);
  assert.equal(await page.locator('input[value="2"]').isChecked(),false);
  await flow.set(page,'籍贯','示例省-示例市-示例区');
  assert.equal(await page.locator('#region').inputValue(),'示例省-示例市-示例区');
  assert.equal((await flow.set(page,'籍贯','示例省-示例市-示例区')).status,'existing');
  await page.setContent(`<div class="resume-menu-item__title">附件</div><div class="form-content--title">附件</div><button id="editFile">编辑</button><input type="file" name="multipartFile" id="stale" style="display:none"><div class="scrd-web--form-edit" id="editArea" style="display:none"><div class="el-form-item"><label>生活照</label><input type="file" name="multipartFile" id="photo"></div><div class="el-form-item"><label>简历附件</label><input type="file" name="multipartFile" id="resume"></div><span id="filename"></span><button id="saveFile">保 存</button></div><script>editFile.onclick=()=>editArea.style.display='block';resume.onchange=()=>filename.textContent=resume.files[0].name;saveFile.onclick=()=>{window.savedName=resume.files[0].name;editArea.style.display='none';};</script>`);
  const fixturePath=path.join(os.tmpdir(),'verified-upload-fixture.pdf');fs.writeFileSync(fixturePath,'fixture only');
  const uploaded=await fillVerified(page,{}, {attachment:{uploadAuthorized:true,name:'verified-upload-fixture.pdf',path:fixturePath},sections:[]});
  assert.equal(uploaded.counts.filled,1);
  assert.equal(await page.evaluate(()=>window.savedName),'verified-upload-fixture.pdf');
  assert.equal(await page.locator('#photo').evaluate(e=>e.files.length),0);
  assert.equal(await page.locator('#stale').evaluate(e=>e.files.length),0);
 }finally{await app.close();}
});
