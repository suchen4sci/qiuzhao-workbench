// Bootstrap date picker: use visible month/day modes without inventing precision.
async function fillBootstrapDate(frame, locator, value) {
  const parts=String(value).match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/);
  if(!parts)throw new Error('DATE_PRECISION');
  if(await locator.evaluate(e=>e.classList.contains('dayType'))&&!parts[3])throw new Error('DATE_PRECISION');
  await locator.click();
  const panel=frame.locator('.datetimepicker:visible');
  if(await panel.count()!==1)throw new Error('AMBIGUOUS');
  if(await panel.locator('.datetimepicker-days:visible').count())await panel.locator('.datetimepicker-days:visible .switch').click();
  if(await panel.locator('.datetimepicker-months:visible').count())await panel.locator('.datetimepicker-months:visible .switch').click();
  const exact=s=>new RegExp('^'+s+'$');
  const year=panel.locator('.year').filter({hasText:exact(parts[1])});
  for(let n=0;n<20&&!(await year.count());n++){
    const years=await panel.locator('.year').allTextContents();
    await panel.locator('.datetimepicker-years:visible .'+(Number(parts[1])<Number(years[0])?'prev':'next')).click();
  }
  if(await year.count()!==1)throw new Error('OPTION');
  await year.click();
  await panel.locator('.month').filter({hasText:exact(Number(parts[2])+'月')}).click();
  if(await panel.locator('.datetimepicker-days:visible').count()){
    if(!parts[3])throw new Error('DATE_PRECISION');
    await panel.locator('.day:not(.old):not(.new)').filter({hasText:exact(Number(parts[3]))}).click();
  }
  const actual=await locator.inputValue();
  const normalized=actual.replaceAll('/','-');
  if(normalized!==value&&normalized!==value.slice(0,7))throw new Error('VERIFY');
  return actual;
}
module.exports={fillBootstrapDate};
