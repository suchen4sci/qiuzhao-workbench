const {_electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {executeControl}=require('../src/control-dispatcher.cjs');
(async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'control-dispatch-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.setContent(`<meta charset="utf-8">
   <input id="text"><input id="keys"><input id="invalid" pattern="[0-9]+">
   <select id="native"><option value="">请选择</option><option value="good">良好</option></select>
   <input id="day" type="date"><input id="month" type="month">
   <input id="aria" role="combobox" readonly aria-controls="list1">
   <input id="search" role="combobox" aria-autocomplete="list" aria-controls="list2">
   <input id="duplicate" role="combobox" readonly aria-controls="list3">
   <input id="unknown" readonly><input id="disabled" disabled><input id="agreement" type="checkbox">
   <div class="el-form-item"><label>等级</label><div class="el-select"><input id="element" readonly></div></div>
   <div class="form-item"><label class="form-item__title">普通选择</label><div id="phoenix" class="phoenix-select"><input></div></div>
   <div class="form-item"><label class="form-item__title">未配置过的新字段</label><div id="phoenixSearch" class="phoenix-select"><input></div></div>
   <script>
   window.picked={};window.keyEvents=0;
   const keys=document.querySelector('#keys');let keyMode=false;keys.onkeydown=()=>keyMode=true;keys.oninput=()=>{if(!keyMode)keys.value=''};
   document.querySelector('#invalid').onkeydown=()=>window.keyEvents++;
   function show(id,list,name,search=false,duplicate=false){const input=document.getElementById(id);input.onclick=()=>{document.getElementById(list)?.remove();const panel=document.createElement('div');panel.id=list;panel.setAttribute('role','listbox');document.body.append(panel);const draw=()=>{panel.innerHTML='';if(search&&input.value!==name)return;for(let i=0;i<(duplicate?2:1);i++){const option=document.createElement('div');option.setAttribute('role','option');option.textContent=name;option.onclick=()=>{input.value=name;window.picked[id]=(window.picked[id]||0)+1;panel.remove()};panel.append(option)}};draw();if(search)input.oninput=()=>setTimeout(draw,80)};input.onkeydown=e=>{if(e.key==='Escape')document.getElementById(list)?.remove()};}
   show('aria','list1','良好');show('search','list2','雅思',true);show('duplicate','list3','良好',false,true);
   document.querySelector('#element').onclick=()=>{const p=document.createElement('div');p.className='el-select-dropdown';p.innerHTML='<div class="el-select-dropdown__item">良好</div>';document.body.append(p);p.firstChild.onclick=()=>{document.querySelector('#element').value='良好';p.remove()}};
   document.querySelector('#phoenix').onclick=()=>{const p=document.createElement('div');p.className='phoenix-selectList__listItem';p.textContent='良好';document.body.append(p);p.onclick=()=>{document.querySelector('#phoenix input').value='良好';p.remove()}};
   document.querySelector('#phoenixSearch').onclick=()=>{const p=document.createElement('div');p.className='constant-main-selector-container';p.innerHTML='<input placeholder="搜索"><div class="list-item-container"><span class="icon-container" style="display:inline-block;width:20px;height:20px"></span>雅思</div><button class="phoenix-button__content">确定</button>';document.body.append(p);let checked=false;p.querySelector('.icon-container').onclick=()=>checked=true;p.querySelector('button').onclick=()=>{if(checked){document.querySelector('#phoenixSearch input').value='雅思';p.remove()}}};
   </script>`);
  const fill=(id,value)=>executeControl(page,page.locator('#'+id),{value});
  const expected=[['text','7.5','text'],['native','良好','native-select'],['aria','良好','aria-combobox'],['element','良好','element-select'],['phoenix','良好','phoenix-widget'],['phoenixSearch','雅思','phoenix-widget'],['month','2024-09-28','native-date']];
  for(const [id,value,type]of expected){const result=await fill(id,value);assert.equal(result.controlType,type);assert.equal(result.status,'filled');}
  const keyboard=await fill('keys','7.5');assert.equal(keyboard.attempts.at(-1).method,'keyboard-and-blur');
  const search=await fill('search','雅思');assert.ok(search.attempts.some(a=>a.method==='choose-search-branch'));assert.equal(await page.evaluate(()=>picked.search),1);
  await assert.rejects(fill('duplicate','良好'),e=>e.code==='AMBIGUOUS');assert.equal(await page.evaluate(()=>picked.duplicate||0),0);
  await page.locator('#duplicate').press('Escape');
  await assert.rejects(fill('unknown','7.5'),e=>e.code==='UNSUPPORTED');
  await assert.rejects(fill('disabled','7.5'),e=>e.code==='DISABLED');
  await assert.rejects(fill('agreement','true'),e=>e.code==='UNSUPPORTED');assert.equal(await page.locator('#agreement').isChecked(),false);
  await assert.rejects(fill('day','2024-09'),e=>e.code==='DATE_PRECISION');assert.equal(await page.locator('#day').inputValue(),'');
  await assert.rejects(fill('invalid','letters'));assert.equal(await page.evaluate(()=>keyEvents),1); // Tab only; no typing retry for invalid input.
  assert.equal((await fill('text','7.5')).status,'existing');await assert.rejects(fill('text','8'),e=>e.code==='CONFLICT');
  await page.setContent(`<input id="dictionary"><input id="after"><script>
  const field=document.querySelector('#dictionary');field.onclick=()=>{
   if(document.querySelector('.school-wrap'))return;
   const modal=document.createElement('div');modal.className='school-wrap';modal.setAttribute('role','dialog');
   modal.style='position:fixed;inset:0;background:white';modal.innerHTML='<div class="tit">请选择专业：</div><button class="ant-modal-close" aria-label="Close">关闭</button>';
   modal.querySelector('button').onclick=()=>modal.remove();document.body.append(modal);
  };field.oninput=()=>field.value='';</script>`);
  await assert.rejects(fill('dictionary','不存在的专业'));assert.equal(await page.locator('[role=dialog]').count(),0);
  await fill('after','下一字段');assert.equal(await page.locator('#after').inputValue(),'下一字段');
  await page.setContent('<div class="school-wrap" role="dialog"><div class="tit">隐私声明</div><button class="ant-modal-close" aria-label="Close">关闭</button></div>');
  assert.equal(await require('../src/control-dispatcher.cjs').dismissDictionaryPicker(page),false);
  assert.equal(await page.locator('[role=dialog]').count(),1);
  await page.setContent(`<div class="ant-form-item"><input id="major" class="ant-input" placeholder="请选择专业"></div><script>
  document.querySelector('#major').onclick=()=>{
   const p=document.createElement('div');p.className='school-wrap';p.setAttribute('role','dialog');
   p.innerHTML='<div class="tit">请选择专业：</div><input placeholder="请输入专业名称"><div class="results"></div><button>选择</button>';
   let chosen;p.querySelector('button').onclick=()=>{if(chosen){document.querySelector('#major').value=chosen;p.remove()}};
   p.querySelector('input').oninput=e=>setTimeout(()=>{
    const result=p.querySelector('.results');result.innerHTML='';
    if(e.target.value!=='新一代电子信息技术(含量子技术等)')return;
    const o=document.createElement('span');o.className='school-item';o.textContent=e.target.value+'(工学类专业学位)';
    o.onclick=()=>chosen=o.textContent;result.append(o);
   },100);document.body.append(p);
  };</script>`);
  const major=await fill('major','新一代电子信息技术(含量子技术等)');
  assert.equal(major.controlType,'dictionary-major');assert.equal(major.value,'新一代电子信息技术(含量子技术等)(工学类专业学位)');
  assert.equal(await page.locator('[role=dialog]').count(),0);
  console.log(JSON.stringify({passed:true,capabilityBranches:7,searchRecovery:true,keyboardRecovery:true,ambiguityStops:true,noFabricatedDates:true,unknownStops:true,existingPreserved:true}));
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
