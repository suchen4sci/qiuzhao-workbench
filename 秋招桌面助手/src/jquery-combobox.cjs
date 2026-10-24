const {normalize}=require('./rules.cjs');
async function fillJqueryCombobox(frame,input,value){
 const select=input.locator('xpath=ancestor::dd[1]').locator('select');
 if(await select.count()!==1)throw Error('AMBIGUOUS');
 const options=await select.evaluate(e=>[...e.options].map(o=>({label:o.textContent.trim(),value:o.value,disabled:o.disabled})));
 const matches=options.filter(o=>!o.disabled&&normalize(o.label)===normalize(value));
 if(matches.length!==1)throw Error(matches.length?'AMBIGUOUS':'OPTION');
 await input.fill(matches[0].label);await input.press('ArrowDown');
 const menu=frame.locator('.ui-autocomplete:visible');
 const option=menu.locator('.ui-menu-item').filter({hasText:new RegExp('^'+matches[0].label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')});
 await option.waitFor({timeout:2000});if(await option.count()!==1)throw Error('AMBIGUOUS');
 await option.click();await input.press('Tab');
 if(await select.inputValue()!==matches[0].value||await input.inputValue()!==matches[0].label)throw Error('VERIFY');
 return matches[0].label;
}
module.exports={fillJqueryCombobox};
