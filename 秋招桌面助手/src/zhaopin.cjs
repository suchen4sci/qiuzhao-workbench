const {nav,set,save}=require('./zhaopin-flow.cjs');
const {executeControl}=require('./control-dispatcher.cjs');
const isZhaopin=p=>new URL(p.url()).hostname==='xiaoyuan.zhaopin.com'&&new URL(p.url()).pathname==='/scrd/resume2';
function plans(profile){
 const v=profile.values,s=profile.aircasSupplement,z=profile.zhaopin||{};
 return [
  ...v.education.map((e,i)=>({section:'教育经历',identity:e.level,values:{'学校名称':e.school,'入学时间':e.startTime,'毕业时间':e.endTime,'受教育类型':'全日制统分统招','学位':i?'学士':'硕士','学历':e.level,'研究方向':e.researchDirection,'院系':e.department,'专业':e.major,'专业课程':e.majorCourses,'年级排名':e.classRank==='前40%'?'其他':e.classRank,'是否有海外学习经历':'无'}})),
  {section:'求职意向',values:{'最低薪资':'1.5万','最高薪资':'2.5万','数字投递方向（数字设计岗位必填）':z.digital_direction_single}},
  ...v.internship.map(e=>({section:'实习/工作经历',identity:e.company,values:{'工作单位':e.company,'入职时间':e.startTime,'离职时间':e.endTime,'工作类型':'实习','职位月薪(税前)':s.internship_monthly_salary,'职务':e.position,'工作描述':e.description,'是否有证明人':s.internship_leader?'是':undefined,'证明人姓名':s.internship_leader,'证明人关系':s.internship_leader_relation,'证明人职务':s.internship_leader_position,'证明人单位':s.internship_leader_company,'证明人联系方式':s.internship_leader_phone}})),
  {section:'语言能力',identity:'英语',language:true,values:{'语种':'英语','听说能力':'良好','读写能力':'良好'}},
  ...(z.skills||[]).map(e=>({section:'专业技能',identity:e.name,skill:e.name,values:{'技能掌握程度':e.level}})),
  ...v.awards.map(a=>{const grade=a.description.split('\n')[0],name=a.name.endsWith(grade)?a.name:a.name+' '+grade;return {section:'奖励荣誉',identity:name,values:{'奖励名称':name,'获得时间':a.date.slice(0,7),'颁奖机构':a.issuer==='示例大学研究生院、示例大学人文学院'?'示例大学（研究生院、人文学院）':a.issuer}}}),
  {section:'其他信息',values:{'自我评价':v.evaluation[0].description}}
 ];
}
async function certificates(p,profile,runs=[]){
 const wanted=[['雅思（IELTS）','雅思(IELTS)','雅思'],['全国大学英语考试（CET）','全国大学英语六级考试(CET6)','大学英语六级'],['全国大学英语考试（CET）','全国大学英语四级考试(CET4)','大学英语四级']];
 for(const [group,name,key] of wanted){
  const inputs=p.locator('.apply-form-language input');let index=-1;const values=await inputs.evaluateAll(es=>es.map(e=>e.value));index=values.indexOf(name);
  if(index<0){index=values.indexOf('');if(index<0){index=values.length;await p.locator('.apply-form-sub-wrapper .add-box').click();await inputs.nth(index).waitFor();}
   await inputs.nth(index).click();await p.getByText(group,{exact:true}).filter({visible:true}).click();await p.getByText(name,{exact:true}).filter({visible:true}).click();
  }
  const row=inputs.nth(index).locator('xpath=ancestor::form[1]');const score=row.getByPlaceholder('请填写您所获证书的分数或等级');
  const value=String(profile.values.languages.find(l=>l.name===key).score);const result=await executeControl(p,score,{value,allowOverwrite:true});runs.push({label:key+'分数',...result});
 }
}
async function apply(p,plan,profile){
 const runs=[];
 if(plan.skill){const input=p.locator('.scrd-web--form-edit .el-form-item input').first();if(await input.inputValue()!=='其他技能'){await input.click();await p.getByRole('dialog',{name:'专业技能'}).getByText('其他技能',{exact:true}).click();}const result=await executeControl(p,p.getByPlaceholder('请填写您的其他技能'),{value:plan.skill,allowOverwrite:true});runs.push({label:'其他技能',...result});}
 for(const [label,value]of Object.entries(plan.values))if(value!==undefined&&value!==null&&value!==''){const result=await set(p,label,value);runs.push({label,...result});}
 if(plan.language)await certificates(p,profile,runs);
 return runs.map(({value,...trace})=>trace);
}
async function readCard(card){return card.evaluate(e=>Object.fromEntries([...e.querySelectorAll('.el-form-item')].map(f=>[f.querySelector(':scope > label')?.textContent.trim(),f.querySelector(':scope > .el-form-item__content')?.textContent.trim()]).filter(([k,v])=>k&&v!==undefined)));}
async function matches(card,plan,profile){
 const actual=await readCard(card);for(const [k,v]of Object.entries(plan.values))if(v!==undefined&&v!==null&&v!==''&&actual[k]!==String(v))return false;
 const text=await card.innerText();if(plan.skill&&!text.includes(plan.skill))return false;
 if(plan.language)for(const l of profile.values.languages)if(!text.includes(String(l.score)))return false;
 return true;
}
async function fillZhaopin(p,profile,cancelled=()=>false){
 const started=Date.now(),fields=[],all=plans(profile),changed=new Set(),traces=new Map(),authorized=String(profile.zhaopin?.save_authorized_company_id)===new URL(p.url()).searchParams.get('cid');
 if(!authorized)return {fields:[{label:'逐栏保存',status:'pending',reason:'本公司尚未授权逐栏保存；可先使用当前栏目填写'}],counts:{filled:0,pending:1,existing:0},elapsedMs:0};
 // Never navigate away from an open editor until its identified record is verified and saved.
 if(await p.locator('.scrd-web--form-edit input:visible,.scrd-web--form-edit textarea:visible').count()){
  const title=(await p.locator('.form-content--title').innerText()).replace(/\s*必填\s*$/,'').trim();const candidates=all.filter(a=>a.section===title);
  const inputValues=await p.locator('.scrd-web--form-edit input').evaluateAll(es=>es.map(e=>e.value));const candidatesByIdentity=candidates.filter(a=>a.identity&&inputValues.includes(a.identity));
  const plan=candidatesByIdentity.length===1?candidatesByIdentity[0]:candidates.length===1?candidates[0]:null;
  if(!plan)throw Error('当前编辑记录身份不明确，保留原内容，不跳转');traces.set(plan,await apply(p,plan,profile));await save(p);changed.add(plan.section+'|'+(plan.identity||''));
 }
 for(const plan of all){
  if(cancelled())break;
  try{
   await nav(p,plan.section);let cards=p.locator('.apply-module__form > .apply-form');if(plan.identity)cards=cards.filter({has:p.getByText(plan.identity,{exact:true})});
   const count=await cards.count();if(count>1)throw Error('已有重复记录，未继续新增');
   if(count===1&&await matches(cards,plan,profile)){fields.push({label:plan.identity||plan.section,group:plan.section,status:changed.has(plan.section+'|'+(plan.identity||''))?'filled':'existing',controlRuns:traces.get(plan),reason:'已回读保存内容，与知识库一致'});continue;}
   if(count===1)await cards.getByText('编辑',{exact:true}).click();else{const empty=p.getByText('立即添加',{exact:true});if(await empty.count())await empty.click();else await p.locator('.apply-module').getByText('添加',{exact:true}).click();}
   traces.set(plan,await apply(p,plan,profile));await save(p);
   cards=p.locator('.apply-module__form > .apply-form');if(plan.identity)cards=cards.filter({has:p.getByText(plan.identity,{exact:true})});
   if(await cards.count()!==1||!await matches(cards,plan,profile))throw Error('保存后回读不一致');
   fields.push({label:plan.identity||plan.section,group:plan.section,status:'filled',controlRuns:traces.get(plan),reason:'填写并保存后回读通过'});
  }catch(e){fields.push({label:plan.identity||plan.section,group:plan.section,status:'pending',controlType:e.controlType,attempts:e.attempts,controlRuns:traces.get(plan),reason:e.message});if(await p.locator('.scrd-web--form-edit input:visible,.scrd-web--form-edit textarea:visible').count())break;}
 }
 return {fields,counts:Object.fromEntries(['filled','existing','pending','failed','ready'].map(s=>[s,fields.filter(f=>f.status===s).length])),elapsedMs:Date.now()-started};
}
module.exports={isZhaopin,fillZhaopin,plans,apply,matches};
