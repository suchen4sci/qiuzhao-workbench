const {_electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {executeControl,chooseBranch,inspectControl}=require('../src/control-dispatcher.cjs');
const {controlValue}=require('../src/control-value.cjs');
(async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'ant-controls-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<80;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(page,'isolated fixture page exists');
  await page.setContent(`<meta charset="utf-8"><style>.ant-select{width:220px;min-height:30px;border:1px solid #888;margin:3px}.ant-select-dropdown{position:relative;background:white;min-height:20px}.ant-select-dropdown-menu-item,.ant-select-item-option{padding:5px;cursor:pointer}.ant-radio-wrapper{padding:6px;display:inline-block}.ant-select-selection{min-height:24px}.ant-select-selection--multiple{min-height:24px}</style>
  <div id="controls"></div>
  <div class="ant-select-dropdown" id="unrelated"><div class="ant-select-dropdown-menu-item">汉族</div></div>
  <div id="radio" class="ant-radio-group"><label class="ant-radio-wrapper"><input type="radio" name="r" value="opaque-yes"><span>是</span></label><label class="ant-radio-wrapper"><input type="radio" name="r" value="opaque-no"><span>否</span></label></div>
  <div id="gender" class="ant-radio-group"><label class="ant-radio-wrapper"><input type="radio" name="g" value="opaque-m"><span>男</span></label><label class="ant-radio-wrapper"><input type="radio" name="g" value="opaque-f"><span>女</span></label></div>
  <div class="ant-calendar-picker"><input id="calendar" readonly></div>
  <fieldset id="nativeGroup"><legend>是否具备该经历</legend><label><input name="nr" type="radio" value="code-yes">是</label><label><input name="nr" type="radio" value="code-no">否</label></fieldset>
  <div role="radiogroup" id="ariaRadio"><input id="has" name="ar" type="radio" value="data-yes"><label for="has">有</label><input id="hasnt" name="ar" type="radio" value="data-no"><label for="hasnt">无</label></div>
  <fieldset id="ambiguousGroup"><label><input name="one" type="radio">是</label><label><input name="two" type="radio">否</label></fieldset>
  <script>
  window.picked={};document.querySelector('#unrelated').onclick=()=>window.wrongPopup=true;
  window.addSelect=(id,choices,settings={})=>{
   const root=document.createElement('div');root.id=id;root.className='ant-select'+(settings.disabled?' ant-select-disabled':'')+(settings.multiple?' ant-select-multiple':'');
   root.innerHTML='<div class="ant-select-selection" role="combobox" aria-controls="'+id+'-list" tabindex="0"><div class="ant-select-selection__placeholder">请选择类型</div><div class="ant-select-selection-selected-value">'+(settings.existing||'')+'</div><input class="ant-select-search__field" style="display:none"></div>';
   document.querySelector('#controls').append(root);const trigger=root.firstChild,input=root.querySelector('input');
   const close=()=>document.getElementById(id+'-dropdown')?.remove();
   trigger.onclick=()=>{
    if(settings.disabled||document.getElementById(id+'-dropdown'))return;
    const panel=document.createElement('div');panel.className='ant-select-dropdown';panel.id=id+'-dropdown';
    const list=document.createElement('div');list.id=id+'-list';list.setAttribute('role','listbox');panel.append(list);
    if(settings.v4)list.style.display='none';document.body.append(panel);
    const draw=()=>{
     (settings.v4?panel:list).querySelectorAll('.ant-select-dropdown-menu-item,.ant-select-item-option').forEach(e=>e.remove());
     if(settings.search&&input.value!==choices[0]){const empty=document.createElement('div');empty.className='ant-select-dropdown-menu-item ant-select-dropdown-menu-item-disabled';empty.setAttribute('aria-disabled','true');empty.textContent='暂无数据';(settings.v4?panel:list).append(empty);return;}
     for(const label of choices){const o=document.createElement('div');o.className=settings.v4?'ant-select-item-option':'ant-select-dropdown-menu-item';o.textContent=label;if(settings.custom){o.setAttribute('label',label);o.textContent='使用“'+label+'”作为我的专业'}
      o.onclick=e=>{e.stopPropagation();picked[id]=(picked[id]||0)+1;if(!settings.reject)root.querySelector('.ant-select-selection-selected-value').textContent=label;input.value='';close()};
      (settings.v4?panel:list).append(o)
     }
    };
    if(settings.search){input.style.display='block';input.oninput=()=>setTimeout(draw,350)}draw();
   };
   root.onkeydown=e=>{if(e.key==='Escape')close()};
  };
  addSelect('ordinary',['汉族','满族']);addSelect('search',['计算机科学与技术'],{search:true});addSelect('alias',['硕士研究生']);
  addSelect('duplicate',['同名选项','同名选项']);addSelect('existing',['汉族','满族'],{existing:'满族'});
  addSelect('custom',['完整专业名称'],{search:true,custom:true});
  addSelect('disabled',['汉族'],{disabled:true});addSelect('multiple',['汉族'],{multiple:true});addSelect('reject',['汉族'],{reject:true});addSelect('v4',['英语'],{v4:true});
  </script>`);
  const fill=(id,value,extra={})=>executeControl(page,page.locator('#'+id),{value,...extra});
  assert.equal(await page.locator('#ordinary').evaluate(controlValue),'','placeholder is not an existing selection');
  assert.equal((await fill('ordinary','汉族')).controlType,'ant-select');assert.equal(await page.evaluate(()=>window.wrongPopup||false),false);
  assert.equal((await fill('ordinary','汉族')).status,'existing');assert.equal(await page.evaluate(()=>picked.ordinary),1);
  const search=await fill('search','计算机科学与技术');assert.ok(search.attempts.some(a=>a.method==='ant-select:search'));assert.equal(await page.evaluate(()=>picked.search),1);
  assert.equal((await fill('custom','完整专业名称')).value,'完整专业名称');assert.equal(await page.evaluate(()=>picked.custom),1);
  const alias={match:{spec:{optionAliases:{硕士:['硕士研究生']}}}};
  assert.equal((await fill('alias','硕士',alias)).value,'硕士研究生');assert.equal((await fill('alias','硕士',alias)).status,'existing');
  await assert.rejects(fill('existing','汉族'),e=>e.code==='CONFLICT');assert.equal(await page.evaluate(()=>picked.existing||0),0);
  await assert.rejects(fill('duplicate','同名选项'),e=>e.code==='AMBIGUOUS');assert.equal(await page.evaluate(()=>picked.duplicate||0),0);
  await assert.rejects(fill('disabled','汉族'),e=>e.code==='DISABLED');await assert.rejects(fill('multiple','汉族'),e=>e.code==='MULTIPLE');
  await assert.rejects(fill('reject','汉族'),e=>e.code==='VERIFY');
  assert.equal((await fill('radio','是')).controlType,'ant-radio');assert.equal(await page.locator('#radio input').first().isChecked(),true);assert.equal((await fill('radio','是')).status,'existing');
  await assert.rejects(fill('radio','否'),e=>e.code==='CONFLICT');assert.equal((await fill('radio','否',{allowOverwrite:true})).value,'否');
  assert.equal((await fill('gender','女')).value,'女');assert.equal((await fill('v4','英语')).value,'英语');
  assert.equal(chooseBranch(await page.locator('#calendar').evaluate(inspectControl)),'ant-date');
  assert.equal((await fill('nativeGroup','否')).controlType,'native-radio-group');assert.equal(await page.locator('#nativeGroup input').nth(1).isChecked(),true);
  assert.equal((await fill('nativeGroup','否')).status,'existing');await assert.rejects(fill('nativeGroup','是'),e=>e.code==='CONFLICT');
  assert.equal((await fill('ariaRadio','无')).value,'无');await assert.rejects(fill('ambiguousGroup','否'),e=>e.code==='UNSUPPORTED');
  console.log(JSON.stringify({passed:true,ordinarySelect:true,searchSelect:true,scopedDropdown:true,selectedValueVerification:true,explicitAliases:true,ambiguousStops:true,existingProtected:true,radioLabels:true,nativeRadioGroups:true,antV4HiddenAriaList:true,antDateBranchPreserved:true}));
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
