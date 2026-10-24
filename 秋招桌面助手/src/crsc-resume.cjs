const {executeControl}=require('./control-dispatcher.cjs');
const exact=t=>new RegExp('^'+String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
const isCrsc=page=>{const u=new URL(page.url());return u.hostname==='crscd.zhiye.com'&&u.pathname==='/form';};
async function prepare(page,profile,cancelled=()=>false){
 if(!isCrsc(page))return;
 const field=(scope,label)=>scope.locator('.form-item').filter({has:page.locator('.form-item__text').filter({hasText:exact(label)})});
 const set=async(scope,label,value)=>{if(!value||cancelled())return;const input=field(scope,label).locator('input,textarea');if(await input.count()!==1)throw Error(label+'控件不唯一');if(await input.inputValue()===value)return;await executeControl(page,input,{value,allowOverwrite:true});};
 const rows=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__text').filter({hasText:/^学校名称$/})});
 if(await rows.count()&&await page.getByText('请从第一学历填至最高学历',{exact:true}).count()){
  const wanted=[...(profile.values.education||[])].sort((a,b)=>a.startTime.localeCompare(b.startTime));
  for(const e of wanted){
   if(cancelled())return;
   const levels=await rows.locator('.form-item').filter({has:page.locator('.form-item__text').filter({hasText:/^学历$/})}).locator('input').evaluateAll(es=>es.map(e=>e.value));
   if(levels.includes(e.level))continue;
   let i=levels.indexOf('');if(i<0){i=levels.length;await page.getByText('添加教育经历',{exact:true}).click();}
   const row=rows.nth(i);await set(row,'学历',e.level);await set(row,'学校名称',e.school);await set(row,'专业名称',e.major);await set(row,'开始时间',e.startTime.slice(0,7));await set(row,'结束时间',e.endTime.slice(0,7));
  }
 }
 const practices=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__text').filter({hasText:/^实践名称$/})});
 if(await practices.count())for(const record of profile.values.campus||[]){
  if(cancelled())return;
  const names=await practices.locator('.form-item').filter({has:page.locator('.form-item__text').filter({hasText:/^实践名称$/})}).locator('input').evaluateAll(es=>es.map(e=>e.value));
  if(names.filter(n=>n===record.name).length>1)throw Error('在校实践重复，须先核对');
  let i=names.indexOf(record.name);if(i<0)i=names.indexOf('');if(i<0){i=names.length;await page.getByText('添加在校实践',{exact:true}).click();}
  const row=practices.nth(i);await set(row,'实践名称',record.name);await set(row,'开始时间',record.startTime.slice(0,7));
  if(record.endTime==='至今'){const box=row.locator('.phoenix-checkbox');if(!await box.locator('.phoenix-checkbox__realInput--checked').count())await box.getByText('至今',{exact:true}).click();}else await set(row,'结束时间',record.endTime.slice(0,7));
  await set(row,'实践描述',record.description);
 }
 // This employer exposes province-only selectors for these fields.
 for(const label of ['高考所在地','生源地']){const input=field(page,label).locator('input');if(await input.count()===1&&!await input.inputValue()){const source=profile.values.basic?.[0]?.sourcePlace;const province=Array.isArray(source)?source[0]:source;if(province)await require('./region.cjs').fillRegion(page,input,[province]);}}
 const basic=profile.values.basic?.[0]||{};
 for(const [label,value] of [['特长',basic.skillsSummary],['获得荣誉',profile.values.awards?.[0]?.otherAwards]]){const input=field(page,label).locator('textarea');if(value&&await input.count()===1&&!await input.inputValue())await input.fill(value);}
}
module.exports={isCrsc,prepare};
