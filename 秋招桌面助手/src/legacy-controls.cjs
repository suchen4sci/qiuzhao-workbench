const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
async function fillRegion(frame,input,value){
 await input.click({timeout:2000});
 if(await input.getAttribute('constname')!=='Areas'&&!await input.evaluate(e=>e.matches('.area'))){
  const option=frame.locator('a[title='+JSON.stringify(value)+']:visible');await option.waitFor({timeout:3000});
  if(await option.count()!==1)throw Error('AMBIGUOUS');
  await option.locator('xpath=parent::li').locator('input[type=radio]').check();
  await frame.getByText('确定',{exact:true}).filter({visible:true}).click();
  const actual=await input.inputValue();if(actual!==value)throw Error('VERIFY');return actual;
 }
 const panels=frame.locator('.bas_select_ctt_wrap:visible');await panels.waitFor({timeout:3000});
 if(await panels.count()!==1)throw Error('AMBIGUOUS');
 const match=value.match(/^(.+?省)(.+?市)/),steps=match?[match[1],match[2]]:[value];
 for(let i=0;i<steps.length;i++){
  const row=panels.locator('.lst_item').filter({has:frame.locator('label').filter({hasText:exact(steps[i])})});
  await row.locator('label').first().waitFor({state:'visible',timeout:3000});
  if(await row.count()!==1)throw Error('OPTION');
  if(i<steps.length-1)await row.locator('label').click({timeout:2000});
  else await row.locator('input[type=radio]').check();
 }
 const dialog=panels.locator('xpath=ancestor::*[contains(@class,"bas_select")][last()]');
 const confirm=frame.getByText('确定',{exact:true}).filter({visible:true});
 if(await confirm.count()!==1)throw Error('AMBIGUOUS');await confirm.click();
 await panels.waitFor({state:'hidden',timeout:3000});
 const actual=await input.inputValue();if(!actual)throw Error('VERIFY');return actual;
}
async function fillDate(frame,input,value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('DATE_PRECISION');
 const [y,m,d]=value.split('-').map(Number);
 await input.click({timeout:2000});
 const page=frame.page?frame.page():frame;
 let calendar;
 for(let i=0;i<30&&!calendar;i++){
  for(const f of page.frames())if(await f.locator('.WdateDiv:visible').count()===1)calendar=f;
  if(!calendar)await new Promise(r=>setTimeout(r,50));
 }
 if(!calendar)throw Error('CALENDAR');
 const yearMonth=calendar.locator('#dpTitle input.yminput,#dpTitle input.yminputfocus');
 if(await yearMonth.count()===2){
  await yearMonth.nth(1).fill(String(y),{timeout:2000});await yearMonth.nth(1).press('Tab',{timeout:2000});
  await yearMonth.nth(0).fill(String(m),{timeout:2000});await yearMonth.nth(0).press('Tab',{timeout:2000});
  const day=calendar.locator('td[onclick='+JSON.stringify(`day_Click(${y},${m},${d});`)+']');
  if(await day.count()===1){await day.click({timeout:2000,noWaitAfter:true});const actual=await input.inputValue();if(actual!==value)throw Error('VERIFY');return actual;}
 }
 for(let i=0;i<120;i++){
  const shown=await calendar.locator('td.Wday,td.Wselday,td.Wwday').first().getAttribute('onclick');
  const parts=shown?.match(/day_Click\((\d+),(\d+),/);if(!parts)throw Error('CALENDAR');
  const diff=(y-Number(parts[1]))*12+m-Number(parts[2]);
  if(diff===0){await calendar.locator('td[onclick='+JSON.stringify(`day_Click(${y},${m},${d});`)+']').click();return await input.inputValue();}
  await calendar.locator(diff>0?'.NavImgr a':'.NavImgl a').click({timeout:2000});
 }
 throw Error('OPTION');
}
module.exports={fillRegion,fillDate};
