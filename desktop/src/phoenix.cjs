const { normalize } = require('./rules.cjs');
const { fillRegion } = require('./region.cjs');
const { controlValue } = require('./control-value.cjs');
async function fillPhoenix(frame, locator, item) {
  const input = await locator.evaluate(el=>el.tagName==='INPUT') ? locator : locator.locator('input');
  const fieldTitle=locator.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," form-item ")][1]').locator('.form-item__title');
  const closePreviousPicker=async()=>{
    const panels=frame.locator('.phoenix-calendar-input:visible,.phoenix-calendar-month-calendar:visible,.phoenix-selectList:visible,.constant-main-selector-container:visible,.area-selector-container:visible');
    if(!await panels.count())return;
    const name=(await fieldTitle.textContent()).trim();
    const other=frame.locator('.form-item__title:visible').filter({hasNotText:new RegExp('^'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).first();
    if(!await other.count())throw Error('PICKER_STILL_OPEN');
    await other.click({timeout:1500});
    await panels.first().waitFor({state:'hidden',timeout:1500});
  };
  await closePreviousPicker();
  if (item.regionPath) {
    if(await fieldTitle.count()===1)await fieldTitle.click();
    try{return await fillRegion(frame,input,item.regionPath);}finally{if(await fieldTitle.count()===1)await fieldTitle.click().catch(()=>{});}
  }
  if(await fieldTitle.count()===1)await fieldTitle.click({timeout:1500});
  await locator.click({ timeout: 1200 });
  try {
    // The opened DOM, not the field's name, determines the interaction protocol.
    await frame.locator('.constant-main-selector-container:visible,.area-selector-container:visible,.phoenix-calendar-input:visible,.phoenix-calendar-month-calendar:visible,.phoenix-selectList__listItem:visible').first().waitFor({timeout:1800});
    if (await frame.locator('.constant-main-selector-container:visible,.area-selector-container:visible').count()) {
      const isCity = await frame.locator('.area-selector-container:visible').count()===1;
      const panel = frame.locator(isCity ? '.area-selector-container:visible' : '.constant-main-selector-container:visible');
      await panel.waitFor({timeout:1500});
      const container = isCity ? '.area-item-container' : '.list-item-container';
      const exact=new RegExp(`^${item.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}$`);
      const rows=panel.locator(container);
      // Search rows contain both the actual label and a parent-category breadcrumb.
      const row=rows.filter({has:frame.locator('.item-text-label').filter({hasText:exact})}).or(rows.filter({hasText:exact}));
      if (!isCity) {
        const search=panel.locator('input[placeholder="搜索"]');
        await search.fill(item.value);
        try{await row.first().waitFor({timeout:1200});}catch{
          // Some widget versions do not search punctuation-containing full labels.
          // Broaden the query only; the selected label must still match exactly.
          const keyword=String(item.value).split(/[\/·、（(]/)[0];
          if(keyword.length<2||keyword===item.value)throw new Error('OPTION');
          await search.fill(keyword);
        }
      }
      await row.first().waitFor({timeout:2000});
      if(await row.count()!==1) throw new Error('OPTION');
      await row.locator('.icon-container').click({timeout:1200});
      // Confirmation lives outside the inner list container, within this popup.
      await panel.locator('.phoenix-button__content').filter({hasText:/^确定$/}).click({timeout:1200});
      await panel.waitFor({state:'hidden',timeout:1500});
      const actual = await locator.evaluate(controlValue);
      if(actual!==item.value) throw new Error('VERIFY');
      return actual;
    }
    if (await frame.locator('.phoenix-calendar-input:visible,.phoenix-calendar-month-calendar:visible').count()) {
      await frame.locator('.phoenix-calendar-input:visible,.phoenix-calendar-month-calendar:visible').first().waitFor({timeout:1800});
      const dayInput=frame.locator('.phoenix-calendar-input:visible');
      if(await dayInput.count()===1) {
        if(!/^\d{4}-\d{2}-\d{2}$/.test(item.value)) throw new Error('DATE_PRECISION');
        await dayInput.fill(item.value,{timeout:1200});
        await dayInput.press('Enter',{timeout:1200});
        const actual=await locator.evaluate(controlValue);
        if(actual!==item.value) throw new Error('VERIFY');
        return actual;
      }
      const popup = frame.locator('.phoenix-calendar-month-calendar:visible');
      await popup.waitFor({ timeout: 1200 });
      if (await popup.count() !== 1 || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(item.value)) throw new Error('CALENDAR');
      const [year, month] = item.value.split('-').map(Number);
      const header = popup.locator('.phoenix-calendar-month-panel-year-select-content:visible');
      for (let step = 0; step < 60; step++) {
        const actual = Number(await header.textContent());
        if (actual === year) break;
        if (!Number.isInteger(actual)) throw new Error('CALENDAR');
        await popup.locator(actual > year ? '.phoenix-calendar-month-panel-prev-year-btn:visible' : '.phoenix-calendar-month-panel-next-year-btn:visible').click({ timeout: 900 });
        await header.filter({hasText:new RegExp('^'+(actual>year?actual-1:actual+1)+'$')}).waitFor({state:'visible',timeout:1500});
      }
      if (Number(await header.textContent()) !== year) throw new Error('CALENDAR');
      const target = popup.locator('.phoenix-calendar-month-panel-cell:not(.phoenix-calendar-month-panel-cell-disabled) .phoenix-calendar-month-panel-month').filter({hasText:new RegExp(`^(?:${month}|${["一","二","三","四","五","六","七","八","九","十","十一","十二"][month-1]})月$`)}).filter({visible:true});
      await target.first().waitFor({state:'visible',timeout:1500});
      if (await target.count() !== 1) throw new Error('CALENDAR');
      await target.click({ timeout: 1200 });
      const value = await input.inputValue();
      if (value !== item.value.slice(0,7)) throw new Error('VERIFY');
      return value;
    }
    const options = frame.locator('.phoenix-selectList__listItem:visible');
    await options.first().waitFor({ timeout: 1200 });
    const labels = await options.allTextContents();
    if(item.match.spec.multiple){
      const wanted=String(item.value).split(/[,、]/).filter(Boolean);
      if(wanted.some(v=>labels.filter(t=>normalize(t)===normalize(v)).length!==1))throw Error('OPTION');
      for(const v of wanted){const option=options.filter({hasText:new RegExp('^'+v+'$')});const checked=await option.locator('input:checked,.phoenix-checkbox--checked').count();if(!checked)await option.click();}
      const footer=frame.locator('.phoenix-selectList:visible').getByText('确定',{exact:true});await footer.click();
      const actual=await locator.evaluate(controlValue);if(wanted.some(v=>!actual.includes(v)))throw Error('VERIFY');return actual;
    }
    let desired = item.value;
    if(item.match.groupId==='intent' && item.match.key==='arrivalDate' && /^\d{4}-\d{2}-\d{2}$/.test(desired)){
      const target=new Date(desired+'T00:00:00');const threshold=new Date();threshold.setMonth(threshold.getMonth()+3);threshold.setHours(0,0,0,0);
      if(target>threshold&&labels.includes('三个月以上'))desired='三个月以上';
      else throw new Error('到岗日期无法唯一对应网站相对时间选项，未猜选');
    }
    if(item.match.groupId==='awards' && item.match.key==='scope' && new URL(frame.url()).hostname==='stics.zhiye.com') desired=({'省部级':'省区级','学校级':'院校级'})[desired]||desired;
    if(item.match.spec.rank && /^前\d+(?:\.\d+)?%$/.test(desired)) {
      const rank=Number(desired.match(/[\d.]+/)[0]);
      const bands=labels.filter(t=>/^前\d+(?:\.\d+)?%$/.test(t.trim())).map(t=>({t,n:Number(t.match(/[\d.]+/)[0])})).filter(o=>o.n>=rank).sort((a,b)=>a.n-b.n);
      if(bands.length) desired=bands[0].t;
      else {const intervals=labels.filter(t=>{const m=t.match(/^(\d+)%[-～~](\d+)%$/);return m&&rank>Number(m[1])&&rank<=Number(m[2]);});if(intervals.length===1)desired=intervals[0];}
    }
    if (item.match.groupId === 'education' && item.match.key === 'educationType' && ['全日制','普通全日制'].includes(desired) && labels.includes('全国普通高等院校全日制')) desired = '全国普通高等院校全日制';
    if(!labels.some(t=>normalize(t)===normalize(desired))){
      const aliases=item.match.spec.optionAliases?.[item.value]||[];
      const found=labels.filter(t=>aliases.some(a=>normalize(a)===normalize(t)));
      if(found.length===1)desired=found[0];
    }
    const matches = labels.map((text,i)=>({text,i})).filter(o=>normalize(o.text) === normalize(desired));
    if (matches.length !== 1) throw new Error('OPTION');
    await options.nth(matches[0].i).click({ timeout: 1200 });
    const actual = await locator.evaluate(controlValue);
    if (normalize(actual) !== normalize(desired)) throw new Error('VERIFY');
    return actual;
  } finally {
    // Close the opened popup without touching Save/Submit or another field.
    if(await fieldTitle.count()===1)await fieldTitle.click({timeout:1500}).catch(()=>{});
    await closePreviousPicker();
  }
}
module.exports = { fillPhoenix };
