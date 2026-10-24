const {normalize}=require('./rules.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
async function fillSelect2Multiple(page,select,labels){
 if(!Array.isArray(labels)||!labels.length)throw Error('多选缺少已确认选项集合');
 const options=await select.evaluate(e=>[...e.options].map(o=>({label:o.textContent.trim(),value:o.value,selected:o.selected,disabled:o.disabled})));
 const targets=labels.map(label=>{const found=options.filter(o=>!o.disabled&&normalize(o.label)===normalize(label));if(found.length!==1)throw Error('多选目标不唯一或不存在：'+label);return found[0];});
 if(options.some(o=>o.selected&&!targets.some(t=>t.value===o.value)))throw Error('已有额外工作城市，未自动移除');
 const container=select.locator('xpath=following-sibling::*[contains(concat(" ",normalize-space(@class)," ")," select2-container ")][1]');
 let changed=false;
 for(const target of targets){
  if(await select.evaluate((e,value)=>[...e.selectedOptions].some(o=>o.value===value),target.value))continue;
  const selection=container.locator('.select2-selection');
  if(await selection.getAttribute('aria-expanded')!=='true')await selection.click({timeout:2000});
  const owned=await selection.getAttribute('aria-owns');
  const panel=owned?page.locator('[id='+JSON.stringify(owned)+']'):page.locator('.select2-results:visible');
  const choice=panel.locator('.select2-results__option').filter({hasText:exact(target.label)}).filter({visible:true});
  await choice.first().waitFor({timeout:3000});if(await choice.count()!==1)throw Error('可见多选选项不唯一');await choice.click({timeout:2000});changed=true;
 }
 await container.locator('.select2-search__field').press('Escape').catch(()=>{});
 if(await container.locator('.select2-selection').getAttribute('aria-expanded')==='true')await container.locator('.select2-selection').click({timeout:2000});
 const actual=await select.evaluate(e=>[...e.selectedOptions].map(o=>o.textContent.trim()));
 if(actual.length!==targets.length||targets.some(t=>!actual.includes(t.label)))throw Error('Select2 多选实际提交值回读失败');
 const visible=await container.locator('.select2-selection__choice').allTextContents();
 if(targets.some(t=>!visible.some(v=>v.replace(/^×/,'').trim()===t.label)))throw Error('Select2 多选标签与提交值不一致');
 return {status:changed?'filled':'existing',controlType:'select2-multiple',value:actual};
}
module.exports={fillSelect2Multiple};
