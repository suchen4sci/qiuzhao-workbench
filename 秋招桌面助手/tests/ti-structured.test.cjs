const {test}=require('node:test'),assert=require('node:assert/strict');
const {matchField,sectionFrom}=require('../src/rules.cjs');
const {_electron}=require('playwright-core'),fs=require('fs'),os=require('os'),path=require('path');
test('custom form aliases remain scoped and do not reuse unconfirmed company facts',()=>{
 assert.equal(matchField(['您的专业属于'],'education').key,'majorCategory');
 assert.equal(matchField(['期待工作地点排序三'],'intent').key,'tertiaryCity');
 assert.equal(matchField(['目前所在城市'],'intent').key,'currentCity');
 assert.equal(matchField(['期待工作地点(多选)'],'intent').spec.multiple,true);
 assert.equal(sectionFrom('其他'),'additional');
 assert.equal(matchField(['是否曾在全国大学生电子设计竞赛（TI杯）中获奖？'],'education').key,'electronicCompetition');
 assert.equal(matchField(['专业名称'],'education').key,'major');
});
test('visible verification login prevents all form writes, hidden login does not block',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'ti-structured-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.setContent('<label>姓名<input id="name"></label><div class="sd-Modal-container-fixture">邮箱登录<input placeholder="请输入验证码"></div>');
  const {fillPage}=require('../src/engine.cjs'),{loginBarrier}=require('../src/login-barrier.cjs');
  assert.equal(await loginBarrier(page),true);
  const r=await fillPage(page,{values:{basic:[{name:'Fixture Candidate'}]}},{});
  assert.equal(r.counts.filled,0);assert.equal(await page.locator('#name').inputValue(),'');
  assert(r.fields.some(f=>f.label==='登录验证'));
  await page.locator('.sd-Modal-container-fixture').evaluate(e=>e.hidden=true);
  assert.equal(await loginBarrier(page),false);
  await page.setContent(`<section data-nav-id="intent"><div class="blockTitle-fixture"><span class="text-fixture">求职意向</span></div><div class="apply-fields-fixture"><div class="apply-field-fixture"><div class="title-fixture">期待工作地点(多选)</div><div class="sd-Dropdown-container-fixture"><label class="sd-Select-container-fixture multi_select_info"><span id="tags"><span class="sd-Tag-text-fixture">Alpha</span></span><input id="multi"></label><div class="sd-Dropdown-dropdown-fixture" hidden><div class="sd-Menu-content-item-fixture">Alpha</div><div class="sd-Menu-content-item-fixture">Beta</div><div class="sd-Menu-content-item-fixture">Other</div></div></div></div></div></section>`);
  await page.evaluate(()=>{const root=document.querySelector('.sd-Dropdown-container-fixture'),panel=root.querySelector('.sd-Dropdown-dropdown-fixture');root.querySelector('label').onclick=()=>panel.hidden=!panel.hidden;panel.querySelectorAll('.sd-Menu-content-item-fixture').forEach(e=>e.onclick=()=>{const tag=document.createElement('span');tag.className='sd-Tag-text-fixture';tag.textContent=e.textContent;document.querySelector('#tags').append(tag);e.remove();});});
  const multiProfile={values:{intent:[{workLocations:'Alpha,Beta'}]},autoProjectNames:[],autoAwardNames:[],learnedFields:[]};
  await fillPage(page,multiProfile,{});
  assert.deepEqual(await page.locator('[class*=sd-Tag-text-]').allTextContents(),['Alpha','Beta']);
  assert.equal((await fillPage(page,multiProfile,{})).counts.filled,0,'multi-select tags must be read as selected state');

 }finally{await app.close();}
});
