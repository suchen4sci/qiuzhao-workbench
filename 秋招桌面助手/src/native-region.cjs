const clean=s=>String(s).trim().replace(/^[A-Z~]\s+/,'');
const compact=s=>clean(s).replace(/[省市区县\s,，/]/g,'');
async function fillNativeRegion(locator,value){
 const root=locator.locator('..');const target=compact(value);
 for(let index=0;index<4;index++){
   const control=root.locator('select.citySelect').nth(index);
   if(!await control.count())break;
   const options=await control.evaluate(e=>[...e.options].filter(o=>o.value&&o.value!=='0'&&!o.disabled).map(o=>({value:o.value,text:o.textContent})));
   let matches=options.filter(o=>{const name=compact(o.text);return name&&target.includes(name)});
   if(!matches.length&&options.length===1&&/^市辖区$/.test(clean(options[0].text)))matches=options;
   if(matches.length===0)break;
   if(matches.length!==1)throw Error('AMBIGUOUS');
   if(await control.inputValue()!==matches[0].value)await control.selectOption(matches[0].value);
   if(await control.inputValue()!==matches[0].value)throw Error('VERIFY');
   // A dependent selector is created asynchronously after the parent's change event.
   await root.evaluate(async(e,index)=>{for(let n=0;n<15;n++){if(e.querySelectorAll('select.citySelect').length>index+1)break;await new Promise(r=>setTimeout(r,50));}},index);
 }
 const display=await locator.evaluate(e=>[...e.parentElement.querySelectorAll('select.citySelect')].filter(n=>n.value&&n.value!=='0').map(n=>n.selectedOptions[0].textContent.trim().replace(/^[A-Z~]\s+/,'')).join('/'));
 const selected=compact(display).replace(/市辖/g,'');
 if(!selected||!selected.includes(target))throw Error('VERIFY');
 return display;
}
module.exports={fillNativeRegion};
