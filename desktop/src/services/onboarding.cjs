'use strict';
const STEPS=Object.freeze(['import','profile','pdf','preferences','watch','mail']);
const LABELS={import:'导入简历',profile:'核对我的条件',pdf:'选择默认 PDF',preferences:'偏好与每日摘要',watch:'关注单位',mail:'可选邮箱'};
function createOnboarding(store,facts,assets,{clock=()=>new Date().toISOString()}={}){
 const saved=()=>store.get('settings','onboarding');
 function status(){
  const old=saved();let suggested=false;
  if(!old){try{const p=facts.read().profile;suggested=!p.demo&&!p.values.basic[0]?.name&&!store.list('assets').length&&!store.get('preferences','main');}catch{suggested=false;}}
  return{...(old||{revision:0,status:'not_started',current:'import',steps:{}}),suggested,order:STEPS,labels:LABELS};
 }
 function completeEvidence(step,input){
  if(step==='import'){
   const available=store.list('assets').filter(a=>!a.archived);if(!available.length)throw Error('请先导入原件，或选择暂时跳过并手工填写');
   // Even a failed parser must leave a verified original. It need not block manual setup.
   const valid=[];for(const a of available){try{assets.file(a.id);valid.push(a.id);}catch{}}
   if(!valid.length)throw Error('未找到可读取的简历原件，请重新导入或暂时跳过');return{assetIds:valid};
  }
  if(step==='profile'){const p=facts.read();if(input.profileHash!==p.hash)throw Error('个人资料已变化，请重新打开并核对');return{profileHash:p.hash,unknownAllowed:true};}
  if(step==='pdf'){const a=store.list('assets').find(a=>a.default&&!a.archived&&a.extension==='.pdf');if(!a)throw Error('请先选择默认 PDF，或暂时跳过');assets.file(a.id);return{assetId:a.id,revision:a.revision};}
  if(step==='preferences'){const p=store.get('preferences','main');if(!p||input.preferencesRevision!==p.revision)throw Error('请先预览并保存当前偏好、摘要设置');return{preferencesRevision:p.revision};}
  if(step==='watch'){const watches=store.list('watches').filter(w=>w.enabled&&store.get('organizations',w.organizationId));if(!watches.length)throw Error('请先关注一家单位，或暂时跳过');return{organizationIds:watches.map(w=>w.organizationId)};}
  if(step==='mail'){const connections=store.list('connections').filter(c=>c.kind==='imap'&&!c.credentialsMissing&&c.status!=='disconnected');if(!connections.length)throw Error('请先保存邮箱连接，或暂时跳过');return{connectionIds:connections.map(c=>c.id),verification:'configuration_only'};}
  throw Error('引导步骤无效');
 }
 function act(input){
  const old=saved(),current=status();if(input.revision!==current.revision)throw Error('引导进度已变化，请刷新后继续');
  const base={...(old||{id:'onboarding',status:'not_started',current:'import',steps:{}})};
  if(input.kind==='begin'){
   if(!['not_started','deferred','completed'].includes(base.status))throw Error('引导已经开始，请继续当前步骤');
   base.status='active';base.startedAt ||= clock();if(old?.status==='completed')base.current=STEPS.find(s=>base.steps[s]?.status==='skipped')||STEPS[0];
  }else if(input.kind==='defer'){
   if(!['not_started','active','deferred'].includes(base.status))throw Error('当前无需暂存引导');base.status='deferred';
  }else if(input.kind==='back'){
   if(base.status!=='active')throw Error('请先继续引导');const index=STEPS.indexOf(base.current);if(index<=0)throw Error('已经是第一步');base.current=STEPS[index-1];
  }else if(['next','skip'].includes(input.kind)){
   if(base.status!=='active'||input.step!==base.current)throw Error('当前步骤已变化，请刷新');if(input.confirmed!==true)throw Error('请明确核对或跳过当前步骤');
   const evidence=input.kind==='next'?completeEvidence(base.current,input):{};
   base.steps={...base.steps,[base.current]:{status:input.kind==='next'?'reviewed':'skipped',at:clock(),...evidence}};
   const index=STEPS.indexOf(base.current);if(index===STEPS.length-1){if(STEPS.some(s=>!base.steps[s]))throw Error('仍有步骤未处理');base.status='completed';base.completedAt=clock();}else base.current=STEPS[index+1];
  }else throw Error('引导操作无效');
  return store.put('settings',base,{expectedRevision:current.revision});
 }
 return{status,act};
}
module.exports={STEPS,LABELS,createOnboarding};
