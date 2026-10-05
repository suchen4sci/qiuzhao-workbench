const {acceptedOption}=require('./ant-controls.cjs');
async function fillLayuiSelect(locator,value,spec={}){
 const all=await locator.evaluate(e=>[...e.previousElementSibling.options].map(o=>({text:o.textContent.trim(),value:o.value,disabled:o.disabled})));
 let options=all.filter(o=>o.value&&!o.disabled&&acceptedOption(o.text,value,spec));
 if(!options.length&&spec.rank&&/^前\d+%$/.test(value)){
   const n=Number(value.match(/\d+/)[0]);const bands=all.filter(o=>/^前\d+%$/.test(o.text)&&Number(o.text.match(/\d+/)[0])>=n).sort((a,b)=>parseInt(a.text.slice(1))-parseInt(b.text.slice(1)));
   if(bands.length)options=[bands[0]];
 }
 if(options.length!==1)throw Error(options.length?'AMBIGUOUS':'OPTION');
 const prior=await locator.evaluate(e=>({value:e.previousElementSibling.value,text:e.querySelector('.layui-select-title input')?.value}));
 if(prior.value===options[0].value&&prior.text===options[0].text)return options[0].text;
 await locator.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
 if(!await locator.locator('dl').isVisible())await locator.locator('.layui-select-title').click({timeout:10000,noWaitAfter:true});
 const option=locator.locator('dd[lay-value='+JSON.stringify(options[0].value)+']');
 if(await option.count()!==1||String(await option.textContent()).trim()!==options[0].text){
   await locator.locator('.layui-select-title').click({timeout:1500}).catch(()=>{});
   throw Error('AMBIGUOUS');
 }
 await option.click({timeout:10000,noWaitAfter:true});
 const actual=await locator.evaluate(e=>({value:e.previousElementSibling.value,text:e.querySelector('.layui-select-title input')?.value}));
 if(actual.value!==options[0].value||actual.text!==options[0].text)throw Error('VERIFY');
 return options[0].text;
}
module.exports={fillLayuiSelect};
