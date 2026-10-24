// Private, explicitly verified SCRD templates. Never apply one employer's fields
// to another merely because both use Zhaopin, and never click final submission.
const fs=require('node:fs'),path=require('node:path');
const flow=require('./zhaopin-flow.cjs');
function loadPlan(page,profile){
 const u=new URL(page.url());
 if(u.hostname!=='xiaoyuan.zhaopin.com'||u.pathname!=='/scrd/resume2'||!profile.workspaceRoot)return null;
 const file=path.join(profile.workspaceRoot,'知识库/06-网站适配/智联逐栏已核验.json');
 if(!fs.existsSync(file))return null;
 const plans=JSON.parse(fs.readFileSync(file,'utf8').replace(/^\uFEFF/,''));
 return plans.templates?.find(x=>x.projectId===u.searchParams.get('projectId')&&x.saveAuthorized===true)||null;
}
async function readCard(card){return card.evaluate(e=>Object.fromEntries([...e.querySelectorAll('.el-form-item')].map(f=>[f.querySelector(':scope > label')?.textContent.trim(),f.querySelector(':scope > .el-form-item__content')?.textContent.trim()]).filter(([k,v])=>k&&v!==undefined)));}
function equal(actual,expected){return Object.entries(expected).every(([k,v])=>actual[k]===String(v));}
function orderedEntries(values,current={}){
 const entries=Object.entries(values);
 for(const [start,end] of [['项目开始时间','项目结束时间'],['入学时间','毕业时间'],['入职时间','离职时间'],['开始时间','结束时间']]){
  if(values[start]&&values[end]&&current[end]&&values[start]>current[end]){
   const i=entries.findIndex(([k])=>k===end),j=entries.findIndex(([k])=>k===start);
   if(i>j)entries.splice(j,0,entries.splice(i,1)[0]);
  }
 }
 return entries;
}
async function fillVerified(page,profile,plan,cancelled=()=>false){
 const started=Date.now(),fields=[];
 const finish=()=>({fields,counts:Object.fromEntries(['filled','existing','pending','failed','ready'].map(s=>[s,fields.filter(f=>f.status===s).length])),elapsedMs:Date.now()-started});
 if(await page.locator('.scrd-web--form-edit input:visible,.scrd-web--form-edit textarea:visible').count()){
  fields.push({label:'未保存编辑',status:'pending',reason:'先保存当前编辑，再执行逐栏填写；保留现有输入'});return finish();
 }
 const titles=await page.locator('.resume-menu-item__title').allTextContents();
 if(plan.sections.some(s=>!titles.some(t=>t.trim()===s.section))){fields.push({label:'栏目结构',status:'pending',reason:'网页栏目已变化，未套用旧模板'});return finish();}
 if(plan.attachment&&!cancelled()){
  try{
   await flow.nav(page,'附件');
   const a=plan.attachment;
   if(await page.getByText(a.name,{exact:true}).count()===1)fields.push({label:'简历附件',status:'existing',reason:'附件栏记录存在；最终验收仍需刷新核对服务器持久性'});
   else{
    if(!a.uploadAuthorized||!fs.existsSync(a.path)||fs.statSync(a.path).size>4*1024*1024)throw Error('授权附件不存在或超过4MB');
    await page.getByText('编辑',{exact:true}).click();
    // Editing and display cards can both retain a file input. The visible
    // editor owns the saved record; a life-photo input may share its name.
    const editor=page.locator('.scrd-web--form-edit').filter({visible:true});
    const attachment=editor.locator('.el-form-item').filter({has:page.locator(':scope > label').filter({hasText:/^\s*简历附件\s*$/})});
    const upload=attachment.locator('input[type=file][name=multipartFile]');
    if(await upload.count()!==1)throw Error('当前附件编辑上传控件不唯一');
    await upload.setInputFiles(a.path);
    await page.getByText(a.name,{exact:true}).waitFor({timeout:15000});
    const saveButton=page.getByRole('button',{name:/^保\s*存$/});await saveButton.click();await saveButton.waitFor({state:'hidden',timeout:10000});
    fields.push({label:'简历附件',status:'filled',reason:'编辑态上传并保存；最终验收仍需刷新核对服务器持久性'});
   }
  }catch(e){fields.push({label:'简历附件',status:'pending',reason:e.message});return finish();}
 }
 for(const section of plan.sections){
  if(cancelled())break;
  await flow.nav(page,section.section);
  for(const record of section.records){
   if(cancelled())break;
   const label=section.section+' / '+(Object.values(record.identity||{}).join(' ')||'主记录');
   try{
    let cards=page.locator('.apply-module__form > .apply-form'),found=[];
    for(let i=0;i<await cards.count();i++){const actual=await readCard(cards.nth(i));if(equal(actual,record.identity||{}))found.push({index:i,actual});}
    if(found.length>1)throw Error('记录身份不唯一，未覆盖或新增');
    if(found.length===1&&equal(found[0].actual,record.values)){fields.push({label,status:'existing',reason:'已保存字段逐项回读一致'});continue;}
    const before=found[0]?.actual||{};
    if(found.length)await cards.nth(found[0].index).getByText('编辑',{exact:true}).click();
    else{const empty=page.getByText('立即添加',{exact:true});if(await empty.count())await empty.click();else await page.locator('.apply-module').getByText('添加',{exact:true}).click();}
    for(const [key,value] of orderedEntries(record.values,before)){
     if(cancelled())throw Error('用户停止，保留当前编辑');
     const field=flow.field(page,key);
     if(await field.count()!==1)throw Error(key+'字段尚未出现或不唯一');
     const inputs=field.locator('input:visible,textarea:visible');
     if(await inputs.count()===1&&await inputs.inputValue()===String(value))continue;
     try{await flow.set(page,key,value);}catch(e){
      // This template's major autocomplete accepts verified free text on blur.
      if(!plan.freeTextLabels?.includes(key)||await inputs.count()!==1||await inputs.inputValue()!==String(value))throw e;
      await field.locator(':scope > label').click();
     }
    }
    await flow.save(page);
    cards=page.locator('.apply-module__form > .apply-form');let verified=0;
    for(let i=0;i<await cards.count();i++){const actual=await readCard(cards.nth(i));if(equal(actual,record.identity||{})&&equal(actual,record.values))verified++;}
    if(verified!==1)throw Error('保存后回读未通过');
    fields.push({label,status:'filled',reason:'填写、保存并逐字段回读通过'});
   }catch(e){fields.push({label,status:'pending',reason:e.message});if(await page.locator('.scrd-web--form-edit input:visible,.scrd-web--form-edit textarea:visible').count())return finish();}
  }
 }
 return finish();
}
module.exports={loadPlan,fillVerified,equal,orderedEntries};
