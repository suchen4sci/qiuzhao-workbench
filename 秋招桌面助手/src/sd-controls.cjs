const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
async function fillSelect(frame,locator,value){
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 const title=locator.locator('xpath=ancestor::div[contains(@class,"apply-field-")][1]').locator(':scope > [class*="title-"]');
 if(await title.count()===1)await title.click({timeout:1500});
 await locator.click({timeout:1500});
 const panel=root.locator('[class*="sd-Dropdown-dropdown-"]:visible');
 try{await panel.waitFor({state:'visible',timeout:600});}catch{await locator.fill(value);await panel.waitFor({state:'visible',timeout:2500});}
 let target=value;
 const aliases={'硕士研究生':'硕士','博士研究生':'博士'};
 if(aliases[value]&&await panel.locator('[class*="sd-Menu-content-item-"]').filter({hasText:exact(aliases[value])}).count()===1)target=aliases[value];
 const all=panel.locator('[class*="sd-Menu-content-item-"]:visible');
 const options=all.filter({hasText:exact(target)}).or(all.filter({has:frame.locator(':scope > div:first-child').filter({hasText:exact(target)})}));
 if(!await options.count()){
  await locator.fill(value,{timeout:1500});
  try{await options.first().waitFor({state:'visible',timeout:2500});}catch{
   const add=panel.getByRole('button',{name:'添加专业全称',exact:true});
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
 await locator.click();const panel=root.locator('[class*="sd-panal-menu-wrapper-"]:visible');await panel.waitFor();
 const heading=panel.locator('[class*="sd-basic-selector-year-"]');
 if(!/-/.test(await heading.innerText()))await heading.click();
 for(let i=0;i<30;i++){
  const option=panel.locator('[class*="sd-basic-item-wrapper-"]:not([class*="sd-basic-disabled-"])').filter({hasText:exact(String(year))});
  if(await option.count()===1){await option.click();break;}
  const start=Number((await heading.innerText()).match(/\d{4}/)?.[0]);
  await panel.locator(year>start?'[class*="icondoubleRight-"]':'[class*="icondoubleLeft-"]').click();
  if(i===29)throw new Error('OPTION');
 }
 await panel.locator('[class*="sd-basic-year-item-"]').filter({hasText:exact(['一','二','三','四','五','六','七','八','九','十','十一','十二'][month-1]+'月')}).click();
 await panel.waitFor({state:'hidden',timeout:1200}).catch(()=>{});
 const actual=await locator.inputValue();
 if(!await panel.isVisible()&&actual.startsWith(value.slice(0,7))&&/^\d{4}-\d{2}(?:\s*\([^)]*岁\))?$/.test(actual))return actual;
 const cell=panel.locator('[class*="sd-basic-day-item-"]').filter({hasText:exact(String(day))});
 if(await cell.count()!==1)throw new Error('AMBIGUOUS');await cell.click();return value;
}
async function fillRegion(frame,locator,value){
 const root=locator.locator('xpath=ancestor::div[contains(@class,"sd-Dropdown-container-")][1]');
 await locator.click({timeout:1500});const panel=root.locator('[class*="sd-Dropdown-dropdown-"]:visible');await panel.waitFor({timeout:2000});
 const hot=panel.locator('div').filter({has:frame.locator(':scope > span').filter({hasText:/^热门地区$/})});
 const target=hot.locator('[class*="sd-Tag-text-"]').filter({hasText:exact(value)});
 if(await target.count()!==1)throw new Error('OPTION');
 await target.click({timeout:2000});await panel.getByRole('button',{name:'确认',exact:true}).click();
 await panel.waitFor({state:'hidden',timeout:2000});return value;
}
module.exports={fillSelect,fillDate,fillRegion};
