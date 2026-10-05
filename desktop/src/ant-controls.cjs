const {controlValue}=require('./control-value.cjs');
const clean=value=>String(value??'').replace(/\s+/g,' ').trim();
function optionNames(value,spec={}){
 const aliases=spec.optionAliases?.[value];
 return [...new Set([value,...(Array.isArray(aliases)?aliases:[])].map(clean).filter(Boolean))];
}
function acceptedOption(actual,value,spec){return optionNames(value,spec).includes(clean(actual));}
function error(code){return Object.assign(new Error(code),{code});}
async function rootOf(locator,selector){
 if(await locator.evaluate((e,s)=>e.matches(s),selector))return locator;
 const root=locator.locator('xpath=ancestor::*['+(selector==='.ant-select'?'contains(concat(" ",normalize-space(@class)," ")," ant-select ")':'contains(concat(" ",normalize-space(@class)," ")," ant-radio-group ")')+'][1]');
 if(await root.count()!==1)throw error('UNSUPPORTED');return root;
}
async function verifySelected(locator,expected){
 for(let attempt=0;attempt<20;attempt++){
  if(await locator.evaluate(controlValue)===expected)return expected;
  await new Promise(resolve=>setTimeout(resolve,50));
 }
 throw error('VERIFY');
}
async function dropdownFor(frame,root){
 const ids=await root.evaluate(e=>{
  const a=e.matches('[role="combobox"]')?e:e.querySelector('[role="combobox"]');
  return (a?.getAttribute('aria-controls')||a?.getAttribute('aria-owns')||'').split(/\s+/).filter(Boolean);
 });
 if(ids.length){
  for(let attempt=0;attempt<20;attempt++){
   const panels=[];
   for(const id of ids){
    const owned=frame.locator('[id='+JSON.stringify(id)+']');
    if(await owned.count()!==1)continue;
    // Ant v4's accessibility list may be visually hidden beside the actual virtual list.
    const panel=owned.locator('xpath=ancestor-or-self::*[contains(concat(" ",normalize-space(@class)," ")," ant-select-dropdown ")][1]');
    if(await panel.count()===1&&await panel.isVisible())panels.push(panel);
    else if(await owned.isVisible())panels.push(owned);
   }
   if(panels.length===1)return panels[0];
   if(panels.length>1)throw error('AMBIGUOUS');
   await new Promise(resolve=>setTimeout(resolve,50));
  }
  throw error('OPTION');
 }
 const panels=frame.locator('.ant-select-dropdown:visible:not(.ant-select-dropdown-hidden)');
 await panels.first().waitFor({state:'visible',timeout:1500});
 if(await panels.count()!==1)throw error('AMBIGUOUS');return panels;
}
async function matchingOption(panel,names){
 // Prefer the actual option nodes over the separate accessibility mirror.
 let options=panel.locator('.ant-select-dropdown-menu-item:not(.ant-select-dropdown-menu-item-group-title),.ant-select-item-option').filter({visible:true});
 if(!await options.count())options=panel.getByRole('option').filter({visible:true});
 const entries=await options.evaluateAll(nodes=>nodes.map((e,index)=>({index,
  label:(e.getAttribute('label')||e.querySelector('.ant-select-item-option-content')?.textContent||e.textContent||'').replace(/\s+/g,' ').trim(),
  disabled:e.getAttribute('aria-disabled')==='true'||e.classList.contains('ant-select-dropdown-menu-item-disabled')||e.classList.contains('ant-select-item-option-disabled')
 })));
 // Exact canonical text has priority; alternatives are allowed only when uniquely matched.
 const exact=entries.filter(e=>e.label===names[0]);
 const matches=exact.length?exact:entries.filter(e=>names.slice(1).includes(e.label));
 if(matches.length>1)throw error('AMBIGUOUS');
 if(!matches.length)return null;
 if(matches[0].disabled)throw error('DISABLED');
 return {locator:options.nth(matches[0].index),label:matches[0].label};
}
async function fillAntSelect(frame,locator,value,{spec={},attempts=[]}={}){
 const root=await rootOf(locator,'.ant-select'),names=optionNames(value,spec);
 try{
  const trigger=root.locator('.ant-select-selection,.ant-select-selector').first();
  if(await trigger.count())await trigger.click({timeout:1500});else await root.click({timeout:1500});
  let panel=await dropdownFor(frame,root),option=await matchingOption(panel,names);
  if(!option){
   const search=root.locator('input.ant-select-search__field,input.ant-select-selection-search-input').filter({visible:true});
   if(await search.count()===1&&!await search.evaluate(e=>e.readOnly||e.disabled)){
    attempts.push({method:'ant-select:search',status:'recovery',reason:'当前选项未找到，使用本控件的搜索输入框'});
    await search.fill(String(value),{timeout:1500});
    for(let attempt=0;attempt<20;attempt++){
     panel=await dropdownFor(frame,root);option=await matchingOption(panel,names);if(option)break;
     await new Promise(resolve=>setTimeout(resolve,75));
    }
   }
  }
  if(!option)throw error('OPTION');
  await option.locator.click({timeout:1500});
  return await verifySelected(root,option.label);
 }catch(cause){await root.press('Escape',{timeout:400}).catch(()=>{});throw cause;}
}
async function fillAntRadio(frame,locator,value,{spec={}}={}){
 const root=await rootOf(locator,'.ant-radio-group'),names=optionNames(value,spec);
 const choices=root.locator('label.ant-radio-wrapper,label.ant-radio-button-wrapper').filter({visible:true});
 const labels=(await choices.allTextContents()).map(clean);
 let indexes=labels.map((label,index)=>({label,index})).filter(e=>e.label===names[0]);
 if(!indexes.length)indexes=labels.map((label,index)=>({label,index})).filter(e=>names.slice(1).includes(e.label));
 if(indexes.length!==1)throw error(indexes.length?'AMBIGUOUS':'OPTION');
 const selected=choices.nth(indexes[0].index),input=selected.locator('input[type="radio"]');
 if(await selected.evaluate(e=>e.classList.contains('ant-radio-wrapper-disabled')||e.classList.contains('ant-radio-button-wrapper-disabled'))||await input.count()===1&&await input.isDisabled())throw error('DISABLED');
 await selected.click({timeout:1500});
 if(await input.count()===1&&!await input.isChecked())throw error('VERIFY');
 return await verifySelected(root,indexes[0].label);
}
async function fillNativeRadioGroup(frame,locator,value,{spec={}}={}){
 const info=await locator.evaluate(e=>{
  const radios=[...e.querySelectorAll('input[type="radio"]')];
  const valid=e.matches('[role="radiogroup"],fieldset')&&radios.length>0&&!!radios[0].name&&radios.every(r=>r.name===radios[0].name&&r.form===radios[0].form)&&!e.querySelector('input:not([type="radio"]),select,textarea');
  return {valid,entries:radios.map((input,index)=>({index,disabled:input.disabled,label:(input.labels?.[0]?.textContent||input.getAttribute('aria-label')||'').replace(/\s+/g,' ').trim()}))};
 });
 if(!info.valid)throw error('AMBIGUOUS');
 const names=optionNames(value,spec),exact=info.entries.filter(e=>e.label===names[0]);
 const options=exact.length?exact:info.entries.filter(e=>names.slice(1).includes(e.label));
 if(options.length!==1)throw error(options.length?'AMBIGUOUS':'OPTION');
 if(options[0].disabled)throw error('DISABLED');
 const radio=locator.locator('input[type="radio"]').nth(options[0].index);
 await radio.check({timeout:1500});if(!await radio.isChecked())throw error('VERIFY');
 return await verifySelected(locator,options[0].label);
}
module.exports={fillAntSelect,fillAntRadio,fillNativeRadioGroup,acceptedOption,optionNames};
