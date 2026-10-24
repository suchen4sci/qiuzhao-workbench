const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path');
const {_electron}=require('playwright-core');
const {fillPage}=require('../src/engine.cjs');
test('conditional work, dated campus rows and education aliases survive repeat fill',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'conditional-records-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  const field=(name,html)=>`<div class="form-item"><label class="form-item__title">${name}</label>${html}</div>`;
  const row=html=>`<div class="ux-standard-form">${html}</div>`;
  await page.setContent(`<section><div>教育经历</div>${row(field('学校名称','<input value="Fixture University">')+field('学历','<div class="phoenix-select"><input value="硕士研究生"><span class="phoenix-select__calcEle">硕士研究生</span></div>')+field('院校所在城市','<input id="city">')+field('学制','<select id="duration"><option value="">请选择</option><option>3年制</option></select>')+field('实验室名称','<input id="lab">'))}</section>
  <section><div>在校职务</div>${row(field('开始时间','<input type="month" value="2024-09">')+field('结束时间','<input type="month" value="2025-09">')+field('职务名称','<input id="office">'))}</section>
  <section><div>实习/工作经历</div>${row(field('是否有实习/工作经历','<div class="phoenix-radio-group"><span id="gate">是</span><span>否</span></div>'))}</section>`);
  await page.evaluate(()=>document.querySelector('#gate').onclick=()=>{const r=document.querySelector('#gate').closest('.ux-standard-form');for(const label of ['单位名称','实习/工作岗位','实习/工作内容']){const f=document.createElement('div');f.className='form-item';f.innerHTML='<label class="form-item__title">'+label+'</label><input>';r.append(f);}});
  const profile={values:{education:[{school:'Fixture University',level:'硕士研究生',schoolLocation:'北京市',duration:3,laboratory:'Fixture Laboratory'}],campus:[{name:'Fixture student role',role:'Fixture student role',startTime:'2024-09',endTime:'2025-09'}],internship:[{company:'Fixture Chip Company',position:'Fixture IC Intern',description:'Confirmed RTL verification work',hasExperience:'是'}]},autoProjectNames:[],autoAwardNames:[],learnedFields:[]};
  await fillPage(page,profile,{});
  assert.equal(await page.locator('#duration').inputValue(),'3年制');assert.equal(await page.locator('#city').inputValue(),'北京市');assert.equal(await page.locator('#lab').inputValue(),'Fixture Laboratory');assert.equal(await page.locator('#office').inputValue(),'Fixture student role');
  assert.deepEqual(await page.locator('.ux-standard-form').last().locator('input').evaluateAll(es=>es.map(e=>e.value)),['Fixture Chip Company','Fixture IC Intern','Confirmed RTL verification work']);
  assert.equal((await fillPage(page,profile,{})).counts.filled,0);
  // Unknown date intervals must never be assigned the first student role.
  await page.locator('#office').fill('');await page.locator('input[type=month]').first().fill('2023-09');
  await assert.rejects(require('../src/phoenix-campus.cjs').ensurePhoenixCampus(page,profile),/先核对/);
  assert.equal(await page.locator('#office').inputValue(),'');
  // Delete confirmation is scoped even while unrelated yes answers are visible.
  const wrong={'项目名称':'Fixture duplicate','开始时间':'','结束时间':'','项目描述':''};
  await page.setContent(`<span>是</span><section><div>项目经历</div><div class="record"><div>${row(Object.entries(wrong).map(([k,v])=>field(k,`<input value="${v}">`)).join(''))}</div><button id="delete">删除</button></div></section>`);
  await page.evaluate(()=>document.querySelector('#delete').onclick=()=>setTimeout(()=>{const pop=document.createElement('div');pop.className='phoenix-popconfirm';pop.innerHTML='<span>是否要删除该组信息？</span><button>是</button>';pop.querySelector('button').onclick=()=>{document.querySelector('.record').remove();pop.remove();};document.body.append(pop);},50));
  await require('../src/phoenix-record-repair.cjs').repairPhoenixRecords(page,{recordRepairs:[{origin:new URL(page.url()).origin,path:new URL(page.url()).pathname,status:'user-confirmed',remove:[{group:'projects',fingerprint:wrong}]}]});
  assert.equal(await page.locator('.record').count(),0);
  await page.setContent(`<section><div>项目经历</div>${row(field('项目名称','<input value="Fixture project">')+field('项目描述','<textarea id="project-description"></textarea>'))}</section>`);
  const projectProfile={values:{projects:[{name:'Fixture project',role:'负责人',description:'Confirmed FPGA project'}]},autoProjectNames:[],autoAwardNames:[],learnedFields:[],recordRepairs:[{origin:new URL(page.url()).origin,path:new URL(page.url()).pathname,status:'user-confirmed',overwrite:{projects:['description']}}]};
  await fillPage(page,projectProfile,{});assert.equal(await page.locator('#project-description').inputValue(),'负责人\nConfirmed FPGA project');
  assert.equal((await fillPage(page,projectProfile,{})).counts.filled,0,'role-prefixed narratives must compare before overwrite');

  await page.setContent(`<section><div>在校实践</div>${row(field('实践名称','<input id="practice">')+field('实践描述','<textarea></textarea>'))}<button id="practice-add">添加在校实践</button></section><section><div>项目经历</div>${row(field('项目名称','<input>')+field('职务','<input value="负责人">')+field('项目描述','<textarea></textarea>'))}<button id="project-add">添加项目经历</button></section>`);
  await page.evaluate(()=>document.querySelector('#project-add').onclick=()=>{const btn=document.querySelector('#project-add'),original=btn.parentElement.querySelector('.ux-standard-form'),copy=original.cloneNode(true);copy.querySelectorAll('input,textarea').forEach(e=>e.value='');btn.before(copy);});
  const isolated={values:{projects:[{name:'Alpha project',role:'负责人',description:'Alpha detail'},{name:'Beta project',role:'负责人',description:'Beta detail'}]},autoProjectNames:['Alpha project','Beta project'],autoAwardNames:[],learnedFields:[]};
  await fillPage(page,isolated,{});
  assert.equal(await page.locator('#practice').inputValue(),'','separate practice must not receive research projects');
  assert.deepEqual(await page.locator('section').nth(1).locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^项目名称$/})}).locator('input').evaluateAll(es=>es.map(e=>e.value)),['Alpha project','Beta project']);
  assert.equal((await fillPage(page,isolated,{})).counts.filled,0);
  await page.setContent(`<section><div>在校职务</div>${row(field('职务名称','<input id="campus-name">')+field('开始时间','<input value="2023-09">')+field('结束时间','<input value="2024-06">')+field('职务描述','<textarea>Confirmed role, existing duties</textarea>'))}</section>`);
  await require('../src/phoenix-campus.cjs').ensurePhoenixCampus(page,{values:{campus:[{name:'Confirmed role',startTime:'2023-09',endTime:'2024-06',description:'Confirmed role, existing duties'}]}});
  assert.equal(await page.locator('#campus-name').inputValue(),'Confirmed role');
 }finally{await app.close();}
});

