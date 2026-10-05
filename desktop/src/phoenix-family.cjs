// Capability-based repeated family records. Only seed identities in genuinely empty rows.
async function ensurePhoenixFamily(page,profile,cancelled=()=>false){
 const title=page.locator('.form-item__title').filter({hasText:/^与本人关系$/});
 const rows=page.locator('.ux-standard-form').filter({has:title});
 if(!await rows.count())return;
 const nameInput=row=>row.locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^姓名$/})}).locator('input');
 for(const record of profile.values.family||[]){
  if(cancelled())return;
  let found=-1,empty=-1;
  for(let i=0;i<await rows.count();i++){
   const input=nameInput(rows.nth(i));if(await input.count()!==1)throw Error('家庭姓名控件不唯一');
   const value=await input.inputValue();if(value===record.name){if(found>=0)throw Error('家庭成员重复');found=i;}
   if(!value&&!(await rows.nth(i).locator('input,textarea').evaluateAll(es=>es.some(e=>e.value.trim())))){if(empty>=0)throw Error('多条空家庭记录，需先核对');empty=i;}
  }
  if(found>=0)continue;
  if(empty<0){
   const add=page.getByText(/^(添加家庭情况|添加家庭信息|添加家庭成员)$/,{exact:true}).filter({visible:true});
   if(await add.count()!==1)throw Error('家庭新增入口不唯一');
   const before=await rows.count();await require('./add-record-control.cjs').addRecord(add,rows,cancelled);await rows.nth(before).waitFor({state:'visible',timeout:2500});
   if(await rows.count()!==before+1)throw Error('家庭新增数量未验证');empty=before;
  }
  const input=nameInput(rows.nth(empty));await input.fill(record.name);await input.press('Tab');
  if(await input.inputValue()!==record.name)throw Error('家庭姓名回读失败');
 }
}
module.exports={ensurePhoenixFamily};
