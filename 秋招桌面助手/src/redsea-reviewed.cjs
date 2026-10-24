const fs=require('node:fs'),path=require('node:path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function closeReview(page){
 const modal=page.locator('.layui-layer:visible');
 if(!await modal.count())return;
 if(!await page.locator('.modal:visible').count())await modal.getByText('关闭',{exact:true}).click();
 for(let n=0;n<25;n++){
  if(await page.locator('.modal:visible').count())await page.locator('.modal:visible').getByText('确定',{exact:true}).click();
  if(!await modal.count())return;
  await wait(200);
 }
 throw Error('只读核验弹窗未关闭');
}
function isRedsea(page){const u=new URL(page.url());return /(^|\.)51hrc\.cn$/.test(u.hostname)&&u.pathname.endsWith('/fillResume.mc');}
function loadPlan(page){
 const file=path.resolve(__dirname,'../../知识库/06-网站适配/redsea-reviewed.json');
 if(!isRedsea(page)||!fs.existsSync(file))return null;
 const plan=JSON.parse(fs.readFileSync(file,'utf8')),u=new URL(page.url());
 return plan.origin===u.origin&&plan.peopleId===u.searchParams.get('peopleId')?plan:null;
}
async function month(page,input,value){
 if(!/^\d{4}-\d{2}$/.test(value))throw Error('日期精度不是已验证的年月');
 await page.locator('.layui-layer-title:visible').click();await input.click();await wait(350);
 const frame=page.frameLocator('iframe').last();await frame.locator('#dpTitle input').nth(1).click();await wait(200);
 let found=false;
 for(let n=0;n<15;n++){
  const year=frame.locator('.YMenu:visible').getByText(value.slice(0,4),{exact:true});
  if(await year.count()){await year.click();found=true;break;}
  const years=await frame.locator('.YMenu:visible td').allTextContents();
  await frame.locator('.YMenu:visible').getByText(Number(value.slice(0,4))<Number(years[0])?'←':'→',{exact:true}).click();await wait(200);
 }
 if(!found)throw Error('年份未到达');
 await wait(200);await frame.locator('#dpTitle input').nth(0).click();await wait(200);
 await frame.locator('.MMenu:visible').getByText(['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一','十二'][Number(value.slice(5))-1],{exact:true}).click();await wait(200);
 await frame.getByText(value,{exact:true}).click();if(await input.inputValue()!==value)throw Error('日历回读失败');
}
async function setField(page,field){
 const modal=page.locator('.layui-layer:visible'),input=modal.locator('[name="'+field.name+'"]');
 if(field.kind==='radio'){
  const label=modal.locator('.dictionary-selector').filter({has:page.locator('[name="'+field.name+'"]')}).getByText(field.value,{exact:true});
  const checked=await label.locator('xpath=..').locator('input[type=radio]').isChecked();
  if(checked)return false;await label.click();
  if(!await label.locator('xpath=..').locator('input[type=radio]').isChecked())throw Error('单选回读失败');return true;
 }
 if(field.kind==='select'){
  const box=modal.locator('.dictionary-selector').filter({has:page.locator('[name="'+field.name+'"]')}),visible=box.locator('.el-input__inner');
  if(await visible.inputValue()===field.value)return false;
  await visible.click();const item=page.locator('.el-select-dropdown:visible .el-select-dropdown__item').filter({hasText:new RegExp('^'+field.value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$')});
  await item.waitFor({state:'visible'});await item.click();
  if(await visible.inputValue()!==field.value)throw Error('下拉回读失败：'+field.name);return true;
 }
 if(field.kind!=='text'&&field.kind!=='month')throw Error('未验证控件：'+field.kind);
 if(await input.inputValue()===field.value)return false;
 if(field.kind==='month')await month(page,input,field.value);else await input.fill(field.value);
 if(await input.inputValue()!==field.value)throw Error('字段回读失败：'+field.name);return true;
}
async function fillReviewed(page,plan,cancelled=()=>false){
 page.setDefaultTimeout(6000);
 const fields=[],started=Date.now();
 if(await page.locator('.layui-layer:visible').count())return result([{label:'当前编辑框',status:'pending',reason:'请先保存或关闭已有编辑，避免覆盖未保存输入'}],started);
 for(const record of plan.records){
  if(cancelled())break;
  const row={label:record.label,status:'pending',reason:''};fields.push(row);
  try{
   let edit=page.locator('a[onclick*="_this"][onclick*="businessKey:\''+record.id+'\'"]:visible');
   if(!record.id||await edit.count()!==1)throw Error('记录身份缺失或重复，需要重新核验，未按顺序覆盖');
   await edit.click();const modal=page.locator('.layui-layer:visible');
   await modal.locator('[name="'+record.fields[0].name+'"]').waitFor({state:'attached',timeout:12000});await wait(2500);
   let changed=false;for(const field of record.fields){if(cancelled())throw Error('已停止');changed=(await setField(page,field))||changed;}
   if(changed)await modal.getByText('保存',{exact:true}).click();else await closeReview(page);
   await modal.waitFor({state:'hidden',timeout:8000});
   if(changed){
    await edit.click();await modal.locator('[name="'+record.fields[0].name+'"]').waitFor({state:'attached',timeout:12000});await wait(2500);
    for(const field of record.fields){let input=modal.locator('[name="'+field.name+'"]');if(field.kind==='radio'){const label=modal.locator('.dictionary-selector').filter({has:page.locator('[name="'+field.name+'"]')}).getByText(field.value,{exact:true});if(!await label.locator('xpath=..').locator('input[type=radio]').isChecked())throw Error('保存后单选未选中');continue;}if(field.kind==='select')input=modal.locator('.dictionary-selector').filter({has:page.locator('[name="'+field.name+'"]')}).locator('.el-input__inner');if(await input.inputValue()!==field.value)throw Error('保存后回读失败：'+field.name);}
    await closeReview(page);
    await modal.waitFor({state:'hidden'});
   }
   row.status=changed?'filled':'existing';row.reason='已重新打开核对，未提交';
  }catch(e){row.reason=e.message;await closeReview(page).catch(()=>{});}
 }
 fields.push(...(plan.pending||[]).map(reason=>({label:'待人工确认',status:'pending',reason})));return result(fields,started);
}
function result(fields,started){return {fields,elapsedMs:Date.now()-started,counts:Object.fromEntries(['filled','existing','pending','failed','ready','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]))};}
module.exports={isRedsea,loadPlan,fillReviewed,month,setField};


