const {normalize}=require('./rules.cjs');
async function selected(input){return input.evaluate(e=>{const s=e.closest('.next-select');if(!s)return e.value;const tags=[...s.querySelectorAll('.next-tag-body')].map(n=>n.textContent.trim());return tags.length?tags.join(' / '):(s.querySelector('.next-select-values')?.textContent||'').trim();});}
async function choose(page,input,value,{search=false,replace=false}={}){
 if(normalize(await selected(input))===normalize(value))return false;
 const select=input.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," next-select ")][1]');
 if(replace){const tags=select.locator('.next-tag-close-btn');if(await tags.count()>1)throw Error('已有多选内容，未自动覆盖');if(await tags.count()===1)await tags.click();}
 await input.click({timeout:2000});
 if(search)await input.fill(value);
 const choice=page.locator('.next-menu-item').filter({hasText:new RegExp('^'+value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')}).filter({visible:true});
 try{await choice.first().waitFor({state:'visible',timeout:2500});if(await choice.count()!==1)throw Error('选项不唯一');await choice.click({timeout:2000});}
 finally{await input.press('Escape').catch(()=>{});await input.press('Tab').catch(()=>{});}
 if(normalize(await selected(input))!==normalize(value))throw Error('下拉选项回读不一致');return true;
}
async function month(page,input,value){
 value=String(value).slice(0,7);if(await input.inputValue()===value)return false;
 if(!/^\d{4}-\d{2}$/.test(value))throw Error('缺少确认年月');
 await input.click({timeout:2500});
 const panels=page.locator('.next-calendar-panel').filter({visible:true});
 const end=(await input.getAttribute('placeholder'))==='结束日期';
 const panel=end?panels.last():panels.first();
 const target=Number(value.slice(0,4));
 for(let i=0;i<15;i++){
  const year=Number((await panel.locator('.next-calendar-panel-header-full').innerText()).trim());
  if(year===target)break;if(!year||i===14)throw Error('日历年份不能确认');
  const btn=panel.getByTitle(year<target?'下一年':'上一年',{exact:true});
  await btn.focus();await btn.press('Enter');
 }
 const cell=panel.locator('td[title="'+Number(value.slice(5))+'月"]:not([aria-disabled="true"])');
 await cell.click({timeout:2000}).catch(async()=>{const box=await cell.boundingBox();if(!box)throw Error('月份格消失');await page.mouse.click(box.x+box.width/2,box.y+box.height/2);});
 const confirm=page.getByText('确定',{exact:true}).filter({visible:true});if(await confirm.count()===1)await confirm.click({timeout:2000});
 if(await input.inputValue()!==value)throw Error('年月回读不一致');return true;
}
module.exports={selected,choose,month};
