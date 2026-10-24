const {groups,normalize}=require('./rules.cjs');
async function ensureMetadataSkills(page,profile,cancelled){
 if(!await page.locator('.ci select[cname="技能"]').count())return;
 const selections=await page.locator('.ci select[cname="技能"]').evaluateAll(es=>es.flatMap(e=>[...e.options].map(o=>o.textContent.trim())));
 const available=[...new Set(selections)],records=(profile.values.skills||[]).filter(r=>available.some(label=>[r.name,...(groups.skills.fields.name.optionAliases?.[r.name]||[])].some(n=>normalize(n)===normalize(label))));
 for(const record of records){if(cancelled())break;
  const alias=[record.name,...(groups.skills.fields.name.optionAliases?.[record.name]||[])];
  const current=await page.locator('.ci select[cname="技能"]').evaluateAll(es=>es.map(e=>e.value?e.selectedOptions[0]?.textContent.trim():''));
  if(current.some(label=>alias.some(n=>normalize(n)===normalize(label))))continue;
  const before=await page.locator('.ci select[cname="技能"]').count();
  const add=page.locator('input[title="添加"][onclick^="AppendControls"]');if(!await add.count())break;await add.first().click();
  if(await page.locator('.ci select[cname="技能"]').count()!==before+1)throw Error('新增技能后记录数量未增加');
  const child=page.locator('.ci select[cname="技能"]').last(),row=child.locator('xpath=ancestor::div[contains(concat(" ",normalize-space(@class)," ")," ci ")][1]');
  const parent=row.locator('select[onchange*="DDL_OnChange1"]');await parent.selectOption({label:'开发编程类'});
  const options=await child.evaluate(e=>[...e.options].map(o=>({label:o.textContent.trim(),value:o.value})));
  const matches=options.filter(o=>alias.some(n=>normalize(n)===normalize(o.label)));if(matches.length!==1)throw Error('新增技能目标选项不唯一');await child.selectOption(matches[0].value);
 }
}
module.exports={ensureMetadataSkills};
