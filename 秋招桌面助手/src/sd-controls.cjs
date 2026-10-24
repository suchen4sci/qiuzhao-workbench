const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
async function fillSelect(frame,locator,value,spec={}){
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 const title=locator.locator('xpath=ancestor::div[contains(@class,"apply-field-")][1]').locator(':scope > [class*="title-"]');
 // Closing an old menu must not abort a valid field because the page is still scrolling.
 if(await title.count()===1)await title.click({timeout:1500}).catch(()=>locator.press('Escape'));
 await locator.locator('xpath=ancestor::*[contains(@class,"sd-Select-container-")][1]').click({timeout:1500});
 const panel=root.locator('[class*="sd-Dropdown-dropdown-"]:visible');
 try{await panel.waitFor({state:'visible',timeout:600});}catch{await locator.fill(value,{timeout:1500});await panel.waitFor({state:'visible',timeout:2500});}
 let target=value;
 const aliases={'硕士研究生':'硕士','博士研究生':'博士'};
 if(aliases[value]&&await panel.locator('[class*="sd-Menu-content-item-"]').filter({hasText:exact(aliases[value])}).count()===1)target=aliases[value];
 const all=panel.locator('[class*="sd-Menu-content-item-"]:visible');
 if(!await all.filter({hasText:exact(target)}).count()){
  const configured=(spec.optionAliases?.[value]||[]).filter(alias=>typeof alias==='string');
  const available=[];
  for(const alias of configured)if(await all.filter({hasText:exact(alias)}).count()===1)available.push(alias);
  if(available.length===1)target=available[0];
  else if(available.length>1)throw new Error('AMBIGUOUS');
 }
 if(spec.rank&&!await all.filter({hasText:exact(target)}).count()){
  const rank=String(value).match(/^前(\d+(?:\.\d+)?)%$/);
  if(rank){const labels=await all.allTextContents();target=rankOption(labels,value)||target;}
 }
 const options=all.filter({hasText:exact(target)}).or(all.filter({has:frame.locator(':scope > div:first-child').filter({hasText:exact(target)})}));
 if(!await options.count()){
  await locator.fill(value,{timeout:1500});
  try{await options.first().waitFor({state:'visible',timeout:2500});}catch{
   const add=panel.getByText('添加专业全称',{exact:true});
   if(await add.count()===1){await add.click();await panel.getByPlaceholder('请输入就读专业全称',{exact:true}).fill(value);await panel.getByRole('button',{name:'添加',exact:true}).click();await panel.waitFor({state:'hidden',timeout:2000});return value;}
   await locator.press('Escape');throw new Error('OPTION');
  }
 }
 if(await options.count()!==1)throw new Error('AMBIGUOUS');
 await options.click({timeout:4000});
 await panel.waitFor({state:'hidden',timeout:2000});
 return target;
}
async function fillDate(frame,locator,value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw new Error('DATE_PRECISION');
 const [year,month,day]=value.split('-').map(Number);
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 await locator.click({timeout:2000});const panel=root.locator('[class*="sd-panal-menu-wrapper-"]:visible');await panel.waitFor({timeout:2000});
 const heading=panel.locator('[class*="sd-basic-selector-year-"]');
 if(!/-/.test(await heading.innerText({timeout:2000})))await heading.click({timeout:2000});
 for(let i=0;i<30;i++){
  const option=panel.locator('[class*="sd-basic-item-wrapper-"]:not([class*="sd-basic-disabled-"])').filter({hasText:exact(String(year))});
  if(await option.count()===1){await option.click({timeout:2000});break;}
  const start=Number((await heading.innerText({timeout:2000})).match(/\d{4}/)?.[0]);
  await panel.locator(year>start?'[class*="icondoubleRight-"]':'[class*="icondoubleLeft-"]').click({timeout:2000});
  if(i===29)throw new Error('OPTION');
 }
 const months=panel.locator('[class*="sd-basic-year-item-"]');
 // A day picker returns to days after choosing a year; a month picker returns to months.
 if(!await months.count()){
  const monthHeading=panel.locator('[class*="sd-basic-selector-month-"]');
  if(await monthHeading.count()!==1)throw new Error('CALENDAR');
  await monthHeading.click({timeout:2000});
 }
 await months.filter({hasText:exact(['一','二','三','四','五','六','七','八','九','十','十一','十二'][month-1]+'月')}).click({timeout:2000});
 await panel.waitFor({state:'hidden',timeout:1200}).catch(()=>{});
 const actual=await locator.inputValue();
 if(!await panel.isVisible()&&actual.startsWith(value.slice(0,7))&&/^\d{4}-\d{2}(?:\s*\([^)]*岁\))?$/.test(actual))return actual;
 const cell=panel.locator('[class*="sd-basic-day-item-"]').or(panel.locator('[class*="sd-basic-item-wrapper-"]:not([class*="sd-basic-fade-"]):not([class*="sd-basic-disabled-"]) > [class*="sd-basic-date-item-"]')).filter({hasText:exact(String(day))});
 if(await cell.count()!==1)throw new Error('AMBIGUOUS');await cell.click();return value;
}
async function fillRegion(frame,locator,value){
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 await locator.click({timeout:1500});const panel=root.locator('[class*="sd-Dropdown-dropdown-"]:visible');await panel.waitFor({timeout:2000});
 const tags=panel.locator('[class*="sd-Tag-text-"]');
 const steps=regionSteps(value);
 for(const step of steps){const target=tags.filter({hasText:exact(step)});if(await target.count()<1)throw new Error('OPTION');await target.first().click({timeout:2000});}
 if(await panel.isVisible())await panel.getByRole('button',{name:'确认',exact:true}).click();
 await panel.waitFor({state:'hidden',timeout:2000});return await locator.inputValue();
}
function rankOption(labels,value){
 const r=String(value).match(/^前(\d+(?:\.\d+)?)%$/);if(!r)return null;
 const n=+r[1],ranges=labels.map(s=>s.trim()).filter(s=>{const m=s.match(/^(\d+(?:\.\d+)?)%\s*[-～~]\s*(\d+(?:\.\d+)?)%$/);return m&&n>+m[1]&&n<=+m[2];});
 if(ranges.length===1)return ranges[0];if(ranges.length>1)return null;
 const upper=labels.map(s=>s.trim()).map(label=>({label,m:label.match(/^前\s*(\d+(?:\.\d+)?)\s*%$/)})).filter(o=>o.m&&+o.m[1]>=n).sort((a,b)=>+a.m[1]-+b.m[1]);return upper[0]?.label||null;
}
function regionSteps(value){
 const text=String(value).trim();
 if(/[\/\s]/.test(text))return text.split(/[\/\s]+/).filter(Boolean).map((s,i)=>i===0?s.replace(/省$/,''):s);
 const provincial=text.match(/^(.+?省)(.+?市)(.*)$/);
 if(provincial)return [provincial[1].replace(/省$/,''),provincial[2],provincial[3]].filter(Boolean);
 const city=text.match(/^(北京市|天津市|上海市|重庆市)(.*)$/);
 return city?[city[1],city[2]].filter(Boolean):[text];
}
module.exports={fillSelect,fillDate,fillRegion,rankOption,regionSteps};

async function fillMultiple(frame,locator,value){
 const wanted=String(value).split(/[,、]/).map(s=>s.trim()).filter(Boolean);
 if(!wanted.length||new Set(wanted).size!==wanted.length)throw Error('AMBIGUOUS');
 const select=locator.locator('xpath=ancestor::*[contains(@class,"sd-Select-container-")][1]');
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 const read=()=>select.locator('[class*="sd-Tag-text-"]').allTextContents();
 let current=(await read()).map(s=>s.trim());
 if(current.some(s=>!wanted.includes(s)))throw Error('CONFLICT');
 for(const label of wanted){
  if(current.includes(label))continue;
  const panel=root.locator('[class*="sd-Dropdown-dropdown-"]:visible');
  if(!await panel.isVisible())await select.click({timeout:2000});
  await panel.waitFor({timeout:2000});
  const option=panel.locator('[class*="sd-Menu-content-item-"]').filter({hasText:exact(label)});
  if(await option.count()!==1)throw Error('OPTION');
  await option.click({timeout:2000});
  current=(await read()).map(s=>s.trim());
  if(!current.includes(label))throw Error('VERIFY');
 }
 await locator.press('Escape');
 const title=locator.locator('xpath=ancestor::div[contains(@class,"apply-field-")][1]').locator(':scope > [class*="title-"]');
 if(await title.count()===1)await title.click({timeout:1500});
 current=(await read()).map(s=>s.trim());
 if(current.length!==wanted.length||wanted.some(s=>!current.includes(s)))throw Error('VERIFY');
 return current.join(',');
}
module.exports.fillMultiple=fillMultiple;
