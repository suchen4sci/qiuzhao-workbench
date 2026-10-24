const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{_electron}=require('playwright-core');
const {fillFeishuResume,isFeishuResume}=require('../src/feishu-resume.cjs');
test('ATSx search-only schools, paired month dates and repeated degrees fill without duplicate records',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'feishu-resume-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.setContent('<form class="atsx-form"></form>');
  await page.evaluate(()=>{
   const form=document.querySelector('form');
   const section=title=>{const s=document.createElement('section');s.className='createFormSection-container';s.innerHTML='<p class="createFormSection-text">'+title+'</p>';form.append(s);return s;};
   const field=(s,id,label,html)=>{const f=document.createElement('div');f.className='atsx-form-item';f.dataset.cy=id;f.innerHTML='<label class="atsx-form-item-label">'+label+'</label>'+html;s.append(f);return f;};
   const basic=section('基本信息');field(basic,'name','姓名','<input>');field(basic,'email','邮箱','<input>');field(basic,'phone','手机号码','<div class="atsx-select"><span class="atsx-select-selection-selected-value">+86</span></div><input class="atsx-phone-input">');
   const city=field(section('申请信息'),'preferredCity','意向城市','<li class="atsx-select-selection__choice">1CityA</li>');city.querySelector('.atsx-form-item-label').classList.add('atsx-form-item-required');
   const education=section('教育经历');let count=0;
   const addEducation=()=>{const n=count++,id='education['+n+']';
    for(const [key,label,combo] of [['school','学校名称',true],['degree','学历',false]]){
     const f=field(education,id+'.'+key,label,'<div class="atsx-select '+(combo?'atsx-select-combobox':'')+'"><input id="'+id+'.'+key+'"></div>'),root=f.querySelector('.atsx-select'),input=root.querySelector('input');
     const open=()=>{document.querySelectorAll('.atsx-select-dropdown').forEach(e=>e.remove());const panel=document.createElement('div');panel.className='atsx-select-dropdown';const options=combo?[input.value,input.value+' Unrelated College']:['硕士','本科'];
      for(const value of options){const opt=document.createElement('div');opt.className='atsx-select-dropdown-menu-item';opt.textContent=value;opt.onclick=()=>{if(combo)input.value=value;else {let v=root.querySelector('.atsx-select-selection-selected-value');if(!v){v=document.createElement('span');v.className='atsx-select-selection-selected-value';root.append(v);}v.textContent=value;}panel.remove();};panel.append(opt);}document.body.append(panel);};
     if(combo)input.oninput=open;else root.onclick=open;
    }
    field(education,id+'.fieldOfStudy','专业','<input>');const f=field(education,id+'.period','起止时间','<div class="atsx-date-picker"><span class="atsx-date-picker-period-month-label">YYYY-MM</span><span class="atsx-date-picker-period-month-label">YYYY-MM</span></div>');
    for(const label of f.querySelectorAll('.atsx-date-picker-period-month-label'))label.onclick=()=>{const panel=document.createElement('div');panel.className='atsx-date-picker-dropdown';let year;
     for(const y of ['2020','2024','2027']){const option=document.createElement('div');option.className='atsx-date-picker-period-month-panel-list-item';option.textContent=y;option.onclick=()=>year=y;panel.append(option);}
     for(const m of ['06','09']){const option=document.createElement('div');option.className='atsx-date-picker-period-month-panel-list-item';option.textContent=m;option.onclick=()=>{label.textContent=year+'-'+m;panel.remove();};panel.append(option);}document.body.append(panel);};
   };addEducation();const add=document.createElement('button');add.type='button';add.textContent='添加';add.onclick=addEducation;education.append(add);
   field(section('自我评价'),'evaluation','自我评价','<textarea></textarea>');
  });
  assert.equal(await isFeishuResume(page),true);
  const profile={values:{basic:[{name:'Fixture Candidate',phone:'12345678901',email:'candidate@example.com'}],intent:[{}],education:[{school:'Fixture University',level:'硕士研究生',major:'Electronic Engineering',startTime:'2024-09',endTime:'2027-06'},{school:'Fixture University',level:'本科',major:'Electronics',startTime:'2020-09',endTime:'2024-06'}],internship:[],projects:[],awards:[],languages:[],evaluation:[{description:'Confirmed description'}]},autoProjectNames:[]};
  const initial=await fillFeishuResume(page,profile);assert(!initial.fields.some(f=>f.label==='意向城市'&&f.status==='pending'),'selected ordered-city tag must satisfy required field');
  assert.equal(await page.locator('.atsx-form-item[data-cy$=".school"]').count(),2);
  assert.deepEqual(await page.locator('.atsx-form-item[data-cy$=".school"] input').evaluateAll(es=>es.map(e=>e.value)),['Fixture University','Fixture University']);
  assert.deepEqual(await page.locator('.atsx-date-picker-period-month-label').allTextContents(),['2024-09','2027-06','2020-09','2024-06']);
  assert.equal((await fillFeishuResume(page,profile)).counts.filled,0);
  assert.equal(await page.locator('.atsx-form-item[data-cy$=".school"]').count(),2);
 }finally{await app.close();}
});
