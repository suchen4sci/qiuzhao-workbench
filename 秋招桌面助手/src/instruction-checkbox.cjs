// Narrow UI acknowledgement for education order; never handles legal declarations.
const TITLE='教育信息填写说明';
function isEducationInstruction(title,text){return title===TITLE&&/完整的教育经历/.test(text)&&/学历由高至低/.test(text)&&/确认并开始填写/.test(text)&&!/隐私|条款|法律|承诺|声明|真实性/.test(text);}
async function acknowledgeInstructions(page,cancelled=()=>false){
 const fields=page.locator('[class*="apply-field-"]');let changed=0;
 for(const field of await fields.all()){
  if(cancelled())break;
  if(!await field.isVisible())continue;
  const title=field.locator(':scope > [class*="title-"]');if(await title.count()!==1)continue;
  if(!isEducationInstruction(await title.innerText(),await field.innerText()))continue;
  const input=field.locator('input[type=checkbox]'),label=field.locator('label');
  if(await input.count()!==1||await label.count()!==1||await input.isDisabled())continue;
  // A restored visual tick can lack a form change event. Replay the normal UI.
  if(await input.isChecked())await label.click({timeout:1500});
  if(!await input.isChecked())await label.click({timeout:1500});
  if(!await input.isChecked())throw Error('教育填写说明未通过勾选回读');
  changed++;
 }
 return changed;
}
module.exports={isEducationInstruction,acknowledgeInstructions};
