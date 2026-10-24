const fs=require('node:fs'),path=require('node:path');
function loadPlan(page){const u=new URL(page.url()),file=path.resolve(__dirname,'../../知识库/06-网站适配/moseeker-reviewed.json');if(u.hostname!=='www.moseeker.com'||!fs.existsSync(file))return null;const data=JSON.parse(fs.readFileSync(file,'utf8'));return (data.plans||[data]).find(p=>p.path===u.pathname)||null;}
async function fill(page,plan,cancelled=()=>false){
 const fields=[],started=Date.now(),add=(label,status,reason)=>fields.push({label,status,reason});
 if(!await page.getByText(plan.title,{exact:true}).count())return result([{label:'表单身份',status:'pending',reason:'公司表单不匹配'}],started);
 // Reviewed record identities are checked before ordinal placeholders are used.
 const degrees=page.getByPlaceholder('请选择学历',{exact:true});
 if(await degrees.count()!==plan.education.length)return result([{label:'教育记录',status:'pending',reason:'记录数变化，需要重新识别记录后补齐，未按序覆盖'}],started);
 for(let i=0;i<plan.education.length;i++)if(await degrees.nth(i).inputValue()!==plan.education[i])return result([{label:'教育记录',status:'pending',reason:'学历顺序变化，未按序覆盖'}],started);
 for(const f of plan.fields){if(cancelled())break;const input=page.getByPlaceholder(f.placeholder,{exact:true}).nth(f.index||0);try{
  if(await input.inputValue()===f.value){add(f.placeholder,'existing','回读一致');continue;}
  if(f.kind==='select'){await input.click();await page.locator('.el-select-dropdown:visible').getByText(f.value,{exact:true}).click();}
  else if(f.kind==='city'){await input.click();await page.locator('.el-popover:visible input').fill(f.value);await page.locator('.el-popover:visible').getByText(f.value,{exact:true}).click();}
  else if(f.kind==='school'||f.kind==='company'){
   await input.fill(f.value);const menu=page.locator('.el-autocomplete-suggestion:visible');await menu.waitFor({state:'visible'});
   const match=menu.getByText(f.value,{exact:true});
   try{await match.waitFor({state:'visible',timeout:1500});await match.click();}
   catch(e){if(f.kind!=='company')throw e;await menu.getByText('没有合适的？添加此公司',{exact:false}).click();const dialog=page.locator('.el-dialog:visible');if(await dialog.locator('input[type=text]').inputValue()!==f.value)throw Error('新增公司名称不一致');await dialog.getByText('确定',{exact:true}).click();}
  }else{await input.fill(f.value);await input.press('Tab');}
  await page.getByText(plan.title,{exact:true}).click();if(await input.inputValue()!==f.value)throw Error('失焦后值丢失');add(f.placeholder,'filled','已失焦回读');
 }catch(e){add(f.placeholder,'pending',e.message);}}
 const file=page.locator('.el-upload-list__item.is-success').filter({hasText:plan.attachmentName});add('简历附件',await file.count()===1?'existing':'pending',await file.count()===1?'成功状态及文件名已核验':'附件需要重新上传并核验');
 return result(fields,started);
}
function result(fields,started){return {fields,elapsedMs:Date.now()-started,counts:Object.fromEntries(['filled','existing','pending','failed','ready','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]))};}
module.exports={loadPlan,fill};
