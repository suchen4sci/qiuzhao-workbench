const{campusMatches}=require('./campus-identity.cjs');
// Seed only genuinely empty campus records; subsequent engine passes fill by identity.
async function ensurePhoenixCampus(page,profile,cancelled=()=>false){
 const rows=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__title').filter({hasText:/^(在校)?职务名称$/})});
 if(!await rows.count())return;
 const identity=row=>row.locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^(在校)?职务名称$/})}).locator('input');
 // Parsed rows may retain only dates. Reuse a row only when every non-date field is empty
 // and its entire date interval matches a confirmed record; never overwrite unknown text.
 for(const row of await rows.all()){
  if(await identity(row).inputValue())continue;
  const state=await row.evaluate(r=>Object.fromEntries([...r.querySelectorAll('.form-item')].map(f=>[f.querySelector('.form-item__title')?.textContent.trim(),f.querySelector('input,textarea')?.value]).filter(([k,v])=>k&&v!==undefined)));
  const text=String(state['职务描述']||'').replace(/\s/g,'');
  if(text){
   const known=(profile.values.campus||[]).filter(r=>text.startsWith(r.name.replace(/\s/g,''))&&r.startTime===state['开始时间']&&(r.endTime==='至今'?!state['结束时间']:r.endTime===state['结束时间']));
   if(known.length===1){await identity(row).fill(known[0].name);await identity(row).press('Tab');}
   continue;
  }
  if(Object.entries(state).some(([k,v])=>!['开始时间','结束时间','职务名称'].includes(k)&&v.trim()))continue;
  if(!state['开始时间'])continue;
  const names=await Promise.all((await rows.all()).map(r=>identity(r).inputValue()));
  const candidates=(profile.values.campus||[]).filter(r=>!names.some(n=>campusMatches(n,r.name))&&r.startTime===state['开始时间']&&(r.endTime==='至今'?!state['结束时间']:r.endTime===state['结束时间']));
  // Multiple unused records with the same exact interval are interchangeable empty slots.
  if(!candidates.length)continue;
  await identity(row).fill(candidates[0].name);await identity(row).press('Tab');
  if(await identity(row).inputValue()!==candidates[0].name)throw Error('学生经历日期身份回读失败');
 }
 for(const record of profile.values.campus||[]){
  if(cancelled())return;let empty=-1;const names=[];
  for(let i=0;i<await rows.count();i++){const input=identity(rows.nth(i));if(await input.count()!==1)throw Error('学生经历身份控件不唯一');const name=await input.inputValue();names.push(name);if(!name&&!(await rows.nth(i).locator('input,textarea').evaluateAll(es=>es.some(e=>e.type!=='checkbox'&&e.value.trim())))){if(empty>=0)throw Error('学生经历有多条空记录');empty=i;}}
  if(names.filter(n=>campusMatches(n,record.name)).length>1)throw Error('学生经历重复，先核对');
  if(names.some(n=>campusMatches(n,record.name))){const row=rows.nth(names.findIndex(n=>campusMatches(n,record.name))),checkbox=row.locator('input[type=checkbox]');if(record.endTime==='至今'&&await checkbox.count()===1){await checkbox.setChecked(true,{force:true});if(!await checkbox.isChecked())throw Error('至今选项未生效');}continue;}
  if(names.some(n=>!n)&&empty<0)throw Error('无名称学生经历已有内容，先核对');
  if(empty<0){const add=page.getByText('添加在校职务',{exact:true}).filter({visible:true});if(await add.count()!==1)throw Error('学生经历新增入口不唯一');empty=await rows.count();await require('./add-record-control.cjs').addRecord(add,rows,cancelled);await rows.nth(empty).waitFor({timeout:2500});}
  const input=identity(rows.nth(empty));await input.fill(record.name);await input.press('Tab');if(await input.inputValue()!==record.name)throw Error('学生经历姓名回读失败');const checkbox=rows.nth(empty).locator('input[type=checkbox]');if(record.endTime==='至今'&&await checkbox.count()===1)await checkbox.setChecked(true,{force:true});
 }
}
module.exports={ensurePhoenixCampus};
