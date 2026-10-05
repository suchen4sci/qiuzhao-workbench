// Scroll only; never hide fixed navigation or force a click through another control.
async function addRecord(add,rows,cancelled=()=>false){
 const before=await rows.count();let last;
 for(let attempt=0;attempt<2;attempt++){
  if(cancelled())throw Error('CANCELLED');
  if(await rows.count()===before+1)return before;
  if(await rows.count()!==before)throw Error('新增记录数量不明确');
  await add.evaluate(el=>el.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
  try{await add.click({timeout:4000});}catch(error){last=error;}
  try{await rows.nth(before).waitFor({state:'visible',timeout:2000});}catch(error){last=error;}
  if(await rows.count()===before+1)return before;
  if(await rows.count()!==before)throw Error('新增记录数量不明确');
 }
 throw last||Error('新增记录未生效');
}
module.exports={addRecord};
