// DOM capabilities choose the branch. No hostname or personal answer belongs here.
const {fillTextControl}=require('./text-control.cjs');
const {fillElementSelect,fillElementDate}=require('./element-controls.cjs');
const {fillPhoenix}=require('./phoenix.cjs');
const {fillCalendar}=require('./calendar.cjs');
const {controlValue}=require('./control-value.cjs');
const {fillAntSelect,fillAntRadio,fillNativeRadioGroup,acceptedOption}=require('./ant-controls.cjs');
const {normalize}=require('./rules.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');

function inspectControl(el){
 const family=el.matches('.layui-form-select')?'layui':el.closest('.phoenix-select,.phoenix-radio-group')?'phoenix':el.closest('.el-select,.el-date-editor,.apply-form-date-now')?'element':el.closest('.ant-calendar-picker,.ant-select,.ant-radio-group')?'ant':el.closest('.select2-container,.select2-selection')?'select2':'native';
 const aria=el.closest('[role="combobox"]')||el.querySelector('[role="combobox"]')||el;
 const radios=el.matches('[role="radiogroup"],fieldset')?[...el.querySelectorAll('input[type="radio"]')]:[];
 const nativeRadioGroup=radios.length>0&&!!radios[0].name&&radios.every(r=>r.name===radios[0].name&&r.form===radios[0].form)&&!el.querySelector('input:not([type="radio"]),select,textarea');
 return {nativeRegion:el.matches('select.citySelect'),family,tag:el.tagName.toLowerCase(),type:el.type||'',role:el.getAttribute('role')||aria.getAttribute('role'),
  visible:!!el.getClientRects().length,disabled:!!el.disabled||el.getAttribute('aria-disabled')==='true'||!!el.closest('.ant-select-disabled,.ant-radio-group-disabled'),readonly:!!el.readOnly,
  sdDate:!!el.closest('label')?.querySelector('[class*="sd-picker-addon-"]'),sdSelect:!!el.closest('[class*="sd-Select-container-"]'),editable:el.isContentEditable,hasPopup:aria.getAttribute('aria-haspopup'),controls:aria.getAttribute('aria-controls')||aria.getAttribute('aria-owns'),
  searchable:el.tagName==='INPUT'&&!el.readOnly,autocomplete:el.getAttribute('aria-autocomplete'),
  date:!!el.closest('.el-date-editor,.apply-form-date-now,.ant-calendar-picker'),month:!!el.closest('.el-date-editor--month')||el.type==='month',
  sdRegion:!!el.closest('[class*="region_info-"]'),phoenixRadio:!!el.closest('.phoenix-radio-group'),elementSelect:!!el.closest('.el-select'),antSelect:!!el.closest('.ant-select'),antRadio:!!el.closest('.ant-radio-group'),nativeRadioGroup,
  multiple:!!el.multiple||el.getAttribute('aria-multiselectable')==='true'||!!el.closest('.el-select')?.querySelector('.el-select__tags')||!!el.closest('.ant-select-multiple')||!!el.closest('.ant-select')?.querySelector('.ant-select-selection--multiple'),
  maxLength:el.maxLength>0?el.maxLength:null};
}
const BRANCHES=[
 {id:'native-region',when:d=>d.nativeRegion},
 {id:'layui-select',when:d=>d.family==='layui'},
 {id:'sd-region',when:d=>d.sdRegion},
 {id:'sd-date',when:d=>d.sdDate},
 {id:'sd-select',when:d=>d.sdSelect},
 {id:'phoenix-radio',when:d=>d.family==='phoenix'&&d.phoenixRadio},
 {id:'phoenix-widget',when:d=>d.family==='phoenix'},
 {id:'element-date',when:d=>d.family==='element'&&d.date},
 {id:'element-select',when:d=>d.family==='element'&&d.elementSelect},
 {id:'ant-radio',when:d=>d.family==='ant'&&d.antRadio},
 {id:'ant-select',when:d=>d.family==='ant'&&d.antSelect},
 {id:'ant-date',when:d=>d.family==='ant'&&d.date},
 {id:'select2-select',when:d=>d.family==='select2'},
 {id:'native-select',when:d=>d.tag==='select'},
 {id:'native-radio-group',when:d=>d.nativeRadioGroup},
 {id:'native-radio',when:d=>d.type==='radio'},
 {id:'native-date',when:d=>['date','month'].includes(d.type)},
 {id:'aria-combobox',when:d=>d.role==='combobox'||d.hasPopup==='listbox'||(d.controls&&d.autocomplete==='list')},
 {id:'text',when:d=>!d.readonly&&((d.tag==='input'&&['text','email','tel','url','search','number',''].includes(d.type))||d.tag==='textarea'||d.editable)}
];
function chooseBranch(descriptor){return BRANCHES.find(b=>b.when(descriptor))?.id||'unsupported';}
function fault(code){const error=new Error(code);error.code=code;return error;}
const messages={UNSUPPORTED:'尚无匹配的控件执行分支，未盲试',DISABLED:'控件未启用，需先完成依赖字段',AMBIGUOUS:'存在多个匹配控件或选项，未猜选',MULTIPLE:'多选控件需要明确的选项集合',CONFLICT:'已有内容与目标不同，未覆盖',MISSING:'缺少已确认资料',DATE_PRECISION:'日期精度不足，未补造日期',OPTION:'没有找到目标选项',VERIFY:'回读值不一致',INVALID:'网站字段校验未通过',CANCELLED:'已停止',CHANGED:'页面或控件已变化',MAX_LENGTH:'正文超出限制，未截断'};
async function read(locator,branch){
 if(branch==='native-region'){const value=await locator.evaluate(e=>[...e.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/, '')).join('/'));return {raw:value,display:value,empty:!value,valid:true};}
 if(branch==='native-select')return locator.evaluate(e=>({raw:e.value,display:e.selectedOptions[0]?.textContent.trim()||'',empty:!e.value,valid:!e.validity||e.validity.valid}));
 if(branch==='native-radio')return locator.evaluate(e=>({raw:e.checked,display:e.checked?e.value:'',empty:!e.checked,valid:!e.validity||e.validity.valid}));
 if(branch==='select2-select'){
  const value=await locator.evaluate(e=>{const n=e.querySelector('.select2-selection__rendered')||e;const c=n.cloneNode(true);c.querySelectorAll('.select2-selection__clear,.select2-selection__placeholder').forEach(x=>x.remove());return c.textContent.trim();});
  return {raw:value,display:value,empty:!value||/^请选择/.test(value),valid:true};
 }
 if(branch==='aria-combobox'){
  const value=await locator.evaluate(e=>e.tagName==='INPUT'?e.value:e.textContent.trim());
  return {raw:value,display:value,empty:!value||/^请选择/.test(value),valid:await locator.evaluate(e=>!e.validity||e.validity.valid)};
 }
 const value=await locator.evaluate(controlValue);
 return {raw:value,display:String(value),empty:!value||/^(请选择|请输入|please select|select an option)(?:[.…。\s]*)$/i.test(value),valid:await locator.evaluate(e=>!e.validity||e.validity.valid)};
}
async function popup(frame,locator,d,selector){
 if(d.controls){
  const ids=d.controls.split(/\s+/);let found;
  if(ids.length===1){const owned=frame.locator('[id='+JSON.stringify(ids[0])+']');await owned.waitFor({state:'visible',timeout:1500});return owned;}
  for(const id of ids){const l=frame.locator('[id='+JSON.stringify(id)+']:visible');if(await l.count()){if(found)throw fault('AMBIGUOUS');found=l;}}
  if(found)return found;throw fault('AMBIGUOUS');
 }
 const panels=frame.locator(selector);await panels.first().waitFor({state:'visible',timeout:1500});if(await panels.count()!==1)throw fault('AMBIGUOUS');return panels;
}
async function ariaSelect(frame,locator,d,value,search){
 await locator.click({timeout:1500});
 if(search){if(!d.searchable)throw fault('UNSUPPORTED');await locator.fill(value,{timeout:1500});}
 let panel;try{panel=await popup(frame,locator,d,'[role="listbox"]:visible');}catch(error){
  if(d.searchable&&!search&&error.name==='TimeoutError'){await locator.press('Escape').catch(()=>{});throw fault('OPTION');}throw error;
 }
 const options=panel.getByRole('option',{name:value,exact:true}).filter({visible:true});
 try{await options.first().waitFor({state:'visible',timeout:1500});}catch{await locator.press('Escape').catch(()=>{});throw fault('OPTION');}
 if(await options.count()!==1)throw fault('AMBIGUOUS');
 if(await options.getAttribute('aria-disabled')==='true')throw fault('DISABLED');
 await options.click({timeout:1500});return value;
}
async function select2(frame,locator,value){
 await locator.click({timeout:1500});
 const panel=frame.locator('.select2-results:visible');await panel.waitFor({timeout:1500});
 let option=panel.locator('.select2-results__option').filter({hasText:exact(value)});
 if(!await option.count()){
  const search=frame.locator('.select2-search__field:visible');
  if(await search.count()===1){await search.fill(value);try{await option.first().waitFor({timeout:1500});}catch{throw fault('OPTION');}}
 }
 if(await option.count()!==1)throw fault(await option.count()?'AMBIGUOUS':'OPTION');
 await option.click({timeout:1500});return value;
}
async function recoverOverlay(frame,locator){
 // Only known picker popups; never close login, consent, or arbitrary dialogs.
 const overlays=frame.locator('.el-picker-panel:visible,.el-select-dropdown:visible,.ant-calendar:visible,[role="listbox"]:visible');
 if(await overlays.count()!==1)return false;
 await locator.press('Escape',{timeout:500}).catch(()=>{});
 const label=locator.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," el-form-item ")][1]').locator(':scope > label');
 if(await label.count()===1)await label.click({timeout:800}).catch(()=>{});
 return await overlays.count()===0;
}
async function executeControl(frame,locator,request){
 const attempts=[];let descriptor,branch='unsupported';const url=frame.url();
 const check=()=>{if(request.cancelled?.())throw fault('CANCELLED');if(frame.url()!==url)throw fault('CHANGED');};
 try{
  check();if(request.value===undefined||request.value===null||request.value==='')throw fault('MISSING');
  if(await locator.count()!==1||!await locator.isVisible())throw fault('AMBIGUOUS');
  descriptor=await locator.evaluate(inspectControl);branch=chooseBranch(descriptor);
  if(descriptor.disabled)throw fault('DISABLED');if(descriptor.multiple)throw fault('MULTIPLE');if(branch==='unsupported')throw fault('UNSUPPORTED');
  const value=String(request.value),spec=request.match?.spec||{};
  if(descriptor.maxLength&&value.length>descriptor.maxLength&&branch==='text')throw fault('MAX_LENGTH');
  let before=await read(locator,branch);
  if((before.display===value||(['ant-select','ant-radio','native-radio-group'].includes(branch)&&acceptedOption(before.display,value,spec)))&&before.valid)return {status:'existing',value:before.raw,controlType:branch,attempts:[{method:'read-back',status:'verified'}]};
  if(!before.empty&&!request.allowOverwrite)throw fault('CONFLICT');
  let search=false,overlayRetried=false;
  for(let iteration=0;iteration<3;iteration++){
   check();const now=await locator.evaluate(inspectControl);if(chooseBranch(now)!==branch)throw fault('CHANGED');
   const method=branch+(search?':search':'');
   try{
    let expected=value;
    if(branch==='text'){
     const result=await fillTextControl(locator,value);attempts.push(...result.attempts);expected=result.value;
    }else if(branch==='layui-select'){
     expected=await require('./layui-controls.cjs').fillLayuiSelect(locator,value,spec);
    }else if(branch==='native-region'){expected=await require('./native-region.cjs').fillNativeRegion(locator,value);
    }else if(branch==='native-select'){
     const options=await locator.evaluate(e=>[...e.options].map(o=>({value:o.value,label:o.textContent.trim(),disabled:o.disabled})));
     let matched=options.filter(o=>!o.disabled&&normalize(o.label)===normalize(value));
     if(!matched.length&&spec.rank&&/^前\d+(?:\.\d+)?%$/.test(value)){
      const rank=Number(value.match(/[\d.]+/)[0]);const bands=options.filter(o=>!o.disabled&&/^前\d+(?:\.\d+)?%$/.test(o.label)&&Number(o.label.match(/[\d.]+/)[0])>=rank).sort((a,b)=>Number(a.label.match(/[\d.]+/)[0])-Number(b.label.match(/[\d.]+/)[0]));
      if(bands.length)matched=bands.filter(o=>o.label===bands[0].label);
     }
     if(matched.length!==1)throw fault(matched.length?'AMBIGUOUS':'OPTION');
     if(options.filter(o=>o.value===matched[0].value).length!==1)throw fault('AMBIGUOUS');
     await locator.selectOption({value:matched[0].value},{timeout:1500});expected=matched[0].value;
    }else if(branch==='native-radio'){
     if(await locator.getAttribute('value')!==value)throw fault('CONFLICT');await locator.check({timeout:1500});expected=true;
    }else if(branch==='native-date'){
     const target=descriptor.month?value.slice(0,7):value;
     if(!(descriptor.month?/^\d{4}-\d{2}$/:/^\d{4}-\d{2}-\d{2}$/).test(target))throw fault('DATE_PRECISION');
     await locator.fill(target,{timeout:1500});await locator.press('Tab');expected=target;
    }else if(branch==='element-select')expected=await fillElementSelect(frame,locator,value,{search});
    else if(branch==='element-date')expected=await fillElementDate(frame,locator,value);
    else if(branch==='ant-date')expected=await fillCalendar(frame,locator,value);
    else if(branch==='ant-select')expected=await fillAntSelect(frame,locator,value,{spec,attempts});
    else if(branch==='ant-radio')expected=await fillAntRadio(frame,locator,value,{spec});
    else if(branch==='native-radio-group')expected=await fillNativeRadioGroup(frame,locator,value,{spec});
    else if(branch==='phoenix-radio'){
     const option=locator.locator('.phoenix-radio').filter({hasText:exact(value)});if(await option.count()!==1)throw fault('AMBIGUOUS');await option.click({timeout:1500});
    }else if(branch==='phoenix-widget')expected=await fillPhoenix(frame,locator,{...request,value,match:request.match||{groupId:'',key:'',spec:{}}});
    else if(branch==='aria-combobox')expected=await ariaSelect(frame,locator,descriptor,value,search);
    else if(branch==='select2-select')expected=await select2(frame,locator,value);
    else if(branch==='sd-select')expected=await require('./sd-controls.cjs').fillSelect(frame,locator,value);
    else if(branch==='sd-date')expected=await require('./sd-controls.cjs').fillDate(frame,locator,value);
    else if(branch==='sd-region')expected=await require('./sd-controls.cjs').fillRegion(frame,locator,value);
    check();if(chooseBranch(await locator.evaluate(inspectControl))!==branch)throw fault('CHANGED');
    const after=await read(locator,branch);if(after.raw!==expected)throw fault('VERIFY');if(!after.valid)throw fault('INVALID');
    if(branch!=='text')attempts.push({method,status:'verified'});
    return {status:'filled',value:after.raw,controlType:branch,attempts};
   }catch(error){
    if(error.attempts)attempts.push(...error.attempts);
    const code=error.code||error.message;
    attempts.push({method,status:'failed',reason:messages[code]||code});
    if(code==='OPTION'&&!search&&descriptor.searchable&&['aria-combobox','element-select'].includes(branch)){
     attempts.push({method:'choose-search-branch',status:'recovery',reason:'直接选项未找到，控件支持搜索'});search=true;continue;
    }
    if(error.name==='TimeoutError'&&!overlayRetried&&await recoverOverlay(frame,locator)){
     attempts.push({method:'dismiss-picker',status:'recovery',reason:'发现遮挡弹层，关闭后重新定位同一控件'});overlayRetried=true;continue;
    }
    throw error;
   }
  }
  throw fault('VERIFY');
 }catch(error){
  error.controlType=branch;error.attempts=attempts;error.code=error.code||error.message;
  if(messages[error.code])error.message=messages[error.code];throw error;
 }
}
module.exports={executeControl,inspectControl,chooseBranch,BRANCHES};
