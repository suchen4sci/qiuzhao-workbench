const {executeControl}=require('./control-dispatcher.cjs');
const level=v=>String(v||'').replace('研究生','');
// Repeated SD form blocks with an explicit request for highest and first degree.
async function ensureEducation(page,profile,cancelled){
 const block=page.locator('[data-nav-id]').filter({has:page.locator('[class*="blockTitle-"]').filter({hasText:/教育背景/})});
 if(await block.count()!==1||!(await block.innerText()).includes('填写最高学历和第一学历'))return;
 const records=profile.values.education||[];
 const wanted=[records[0],records.find(r=>r.level==='本科')].filter((r,i,a)=>r&&a.indexOf(r)===i);
 for(const record of wanted){
  if(cancelled())return;
  const rows=block.locator('[class*="apply-fields-"]');
  const values=await rows.evaluateAll(es=>es.map(e=>{const f=[...e.querySelectorAll('[class*="apply-field-"]')].find(f=>f.querySelector(':scope > [class*="title-"]')?.textContent.trim()==='学历');return f?.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()||'';}));
  if(values.filter(v=>level(v)===level(record.level)).length===1)continue;
  if(values.filter(v=>level(v)===level(record.level)).length>1)throw new Error('教育经历重复，需先核对');
  let index=values.indexOf('');
  if(index<0){const add=block.locator('button').filter({hasText:/^添加$/});if(await add.count()!==1)throw new Error('未找到唯一教育添加按钮');await add.click();await rows.nth(values.length).waitFor({state:'visible',timeout:2000});index=values.length;}
  const row=rows.nth(index);
  const field=row.locator('[class*="apply-field-"]').filter({has:page.locator(':scope > [class*="title-"]').filter({hasText:/^学历$/})});
  await executeControl(page,field.locator('input'),{value:record.level,cancelled});
 }
}
module.exports={ensureEducation};
