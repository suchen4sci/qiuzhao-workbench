const escape=s=>String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
async function fillElementSelect(frame,locator,value,{search=false}={}){
 const title=locator.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," el-form-item ")][1]').locator('label').first();
 if(await title.count())await title.click({timeout:1500});
 await locator.click({timeout:1500});
 if(search)await locator.fill(String(value),{timeout:1500});
 const panel=frame.locator('.el-select-dropdown:visible:not(.el-zoom-in-top-leave-active):not(.el-zoom-in-bottom-leave-active)');
 await panel.waitFor({state:'visible',timeout:1500});
 const labels=await panel.locator('.el-select-dropdown__item:not(.is-disabled)').allTextContents();
 let expected=String(value);if(expected==='中共党员'&&labels.map(s=>s.trim()).includes('中共党员（含预备党员）'))expected='中共党员（含预备党员）';
 const option=panel.locator('.el-select-dropdown__item:not(.is-disabled)').filter({hasText:new RegExp('^'+escape(expected)+'$')});
 if(search&&!await option.count())await option.first().waitFor({timeout:1500}).catch(()=>{});
 if(await option.count()!==1){const n=await option.count();await locator.press('Escape');throw Error(n?'AMBIGUOUS':'OPTION');}
 await option.click({timeout:1500});await panel.waitFor({state:'hidden',timeout:1500});
 if(await locator.inputValue()!==expected)throw Error('VERIFY');return expected;
}
async function fillElementDate(frame,locator,value){
 const monthOnly=await locator.evaluate(e=>!!e.closest('.el-date-editor--month'));
 if(!(monthOnly?/^\d{4}-\d{2}(?:-\d{2})?$/:/^\d{4}-\d{2}-\d{2}$/).test(value))throw Error('DATE_PRECISION');
 const wrapper=locator.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," apply-form-date-now ")][1]');
 if(await wrapper.count()) {if(!await frame.locator('.el-date-picker:visible').count())await wrapper.locator('.apply-form-date-now__mask').click({timeout:1500});}
 else await locator.click({timeout:1500});const panel=frame.locator('.el-date-picker:visible');await panel.waitFor();
 const [y,m,d]=value.split('-').map(Number);
 if(monthOnly){
 for(let i=0;i<130;i++){const cy=Number((await panel.locator('.el-date-picker__header').innerText()).match(/\d{4}/)?.[0]);if(cy===y)break;await panel.getByRole('button',{name:cy>y?'前一年':'后一年',exact:true}).click();if(i===129)throw Error('CALENDAR');}
 const monthName=['一','二','三','四','五','六','七','八','九','十','十一','十二'][m-1]+'月';
 await panel.locator('.el-month-table td:not(.disabled)').filter({has:frame.getByText(monthName,{exact:true})}).click();
 await panel.waitFor({state:'hidden'});if(await locator.inputValue()!==value.slice(0,7))throw Error('VERIFY');return value.slice(0,7);
 }
 for(let i=0;i<130;i++){
 const text=await panel.locator('.el-date-picker__header').innerText();const parts=text.match(/(\d{4})\s*年\s*(\d+)\s*月/);if(!parts)throw Error('CALENDAR');
 const cy=+parts[1],cm=+parts[2];if(cy===y&&cm===m)break;
 await panel.getByRole('button',{name:cy!==y?(cy>y?'前一年':'后一年'):(cm>m?'上个月':'下个月'),exact:true}).click();
 if(i===129)throw Error('CALENDAR');
 }
 await panel.locator('.el-date-table td.available:not(.disabled)').filter({hasText:new RegExp('^\\s*'+d+'\\s*$')}).click();
 await panel.waitFor({state:'hidden'});if(await locator.inputValue()!==value)throw Error('VERIFY');return value;
}
module.exports={fillElementSelect,fillElementDate};
