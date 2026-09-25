// Ant v3 calendar: interact with the actual year/month/day controls and wait for
// its closing animation. A month-only fact must never become a made-up day.
function fault(code){return Object.assign(new Error(code),{code});}
async function dismissCalendars(frame,input){
 const handles=await frame.locator('.ant-calendar:visible').elementHandles();
 if(!handles.length)return;
 for(const handle of handles)await handle.press('Escape',{timeout:400}).catch(()=>{});
 for(const handle of handles){
  try{await handle.waitForElementState('hidden',{timeout:1500});}
  catch{throw fault('CALENDAR_OPEN');}
 }
}
async function fillCalendar(frame,input,value){
 if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))throw fault('CALENDAR');
 const [year,month,day]=value.split('-').map(Number);
 if(month<1||month>12)throw fault('CALENDAR');
 if(day!==undefined){const date=new Date(Date.UTC(year,month-1,day));if(date.getUTCFullYear()!==year||date.getUTCMonth()+1!==month||date.getUTCDate()!==day)throw fault('CALENDAR');}
 if(!await input.evaluate(el=>!!el.closest('.ant-calendar-picker')))throw fault('CALENDAR');
 await dismissCalendars(frame,input);
 await input.click({timeout:1200});
 const popup=frame.locator('.ant-calendar:visible');
 try{
  await popup.first().waitFor({state:'visible',timeout:1500});
  if(await popup.count()!==1)throw fault('AMBIGUOUS');
  const click=async locator=>{if(await locator.count()!==1)throw fault('CALENDAR');await locator.click({timeout:1200});};
  const monthOnly=await popup.evaluate(e=>e.classList.contains('ant-calendar-month')||(!e.querySelector('.ant-calendar-date-panel')&&!!e.querySelector('.ant-calendar-month-panel')));
  if(!monthOnly&&day===undefined)throw fault('DATE_PRECISION');
  const expected=monthOnly?value.slice(0,7):value;
  if(monthOnly){
   // A true MonthPicker has a year selector and month cells, but no day grid.
   await click(popup.locator('.ant-calendar-month-panel-year-select'));
  }else await click(popup.locator('.ant-calendar-year-select'));
  for(let step=0;step<30;step++){
   const cells=popup.locator('.ant-calendar-year-panel-cell:not(.ant-calendar-year-panel-last-decade-cell):not(.ant-calendar-year-panel-next-decade-cell)');
   const years=(await cells.allTextContents()).map(s=>Number(s.trim())).filter(Number.isFinite);
   if(!years.length)throw fault('CALENDAR');
   if(year>=Math.min(...years)&&year<=Math.max(...years))break;
   await click(popup.locator(year<Math.min(...years)?'.ant-calendar-year-panel-prev-decade-btn':'.ant-calendar-year-panel-next-decade-btn'));
   if(step===29)throw fault('CALENDAR');
  }
  await click(popup.locator('.ant-calendar-year-panel-year').filter({hasText:new RegExp('^'+year+'$')}));
  if(!monthOnly)await click(popup.locator('.ant-calendar-month-select'));
  const months=popup.locator('.ant-calendar-month-panel-month');
  if(await months.count()!==12)throw fault('CALENDAR');
  const chosenMonth=months.nth(month-1);
  if(await chosenMonth.evaluate(e=>!!e.closest('.ant-calendar-month-panel-cell-disabled')||e.getAttribute('aria-disabled')==='true'))throw fault('DISABLED');
  await click(chosenMonth);
  if(!monthOnly){
   const dates=popup.locator('.ant-calendar-cell:not(.ant-calendar-last-month-cell):not(.ant-calendar-next-month-btn-day):not(.ant-calendar-disabled-cell) .ant-calendar-date');
   await click(dates.filter({hasText:new RegExp('^'+day+'$')}));
  }
  // Reading the input alone is insufficient: the prior popup may still be
  // visible during its leave animation and collide with the next date field.
  await popup.waitFor({state:'hidden',timeout:1800});
  if(await input.inputValue()!==expected)throw fault('VERIFY');
  return expected;
 }catch(error){await dismissCalendars(frame,input).catch(()=>{});throw error;}
}
module.exports={fillCalendar,dismissCalendars};
