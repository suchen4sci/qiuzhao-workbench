'use strict';
const {randomUUID,createHash}=require('node:crypto');
const {modelJSON}=require('./ai-client.cjs');
const {timestamp}=require('./workflow.cjs');
const {associateApplication}=require('./mail-linkage.cjs');
const fields={type:'事件类型',action:'新建/改期/取消',organizationName:'机构原名',applicationReference:'申请编号',jobTitle:'岗位原名',title:'事件原名',startsAt:'开始时间',deadline:'操作截止',endsAt:'结束时间',offerIssuedAt:'Offer发出时间',offerReplyDeadline:'Offer回复截止',joiningAt:'入职时间',location:'地点/形式',url:'处理链接',round:'面试轮次'};
const dateFields=new Set(['startsAt','deadline','endsAt','offerIssuedAt','offerReplyDeadline','joiningAt']);
const digest=value=>createHash('sha256').update(value).digest('hex');
function dateValue(value,offset){
 try{return timestamp(value);}catch{}
 const match=value.match(/^(\d{4})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日\s*|[T ]+)(\d{1,2})(?:[:：时点])(\d{2})分?$/);
 if(!match||!['+08:00','+00:00','-04:00','-05:00'].includes(offset))return '';
 try{return timestamp(`${match[1]}-${match[2].padStart(2,'0')}-${match[3].padStart(2,'0')}T${match[4].padStart(2,'0')}:${match[5]}:00${offset}`);}catch{return '';}
}
function validateMailResult(result,text,offset){
 if(!Array.isArray(result?.changes)||!result.changes.length||result.changes.length>Object.keys(fields).length)throw Error('模型未返回可核对的邮件字段');
 const seen=new Set();
 return result.changes.map((c,i)=>{
  if(!c||!Object.hasOwn(fields,c.key)||seen.has(c.key)||typeof c.value!=='string'||!c.value.trim()||c.value.length>2000||typeof c.quote!=='string'||!c.quote.trim()||c.quote.length>4000||!text.includes(c.quote))throw Error('模型字段缺少所选原文依据，未采用');
  seen.add(c.key);
  if(c.key==='type'){if(!['interview','assessment','materials','offer','booking','other'].includes(c.value))throw Error('事件类型无效');}
  else if(c.key==='action'){if(!['create','reschedule','cancel'].includes(c.value))throw Error('邮件动作无效');}
  else if(!c.quote.includes(c.value))throw Error('模型改写了原文值，未采用');
  let normalized=c.value,warning='';
  if(dateFields.has(c.key)){normalized=dateValue(c.value,offset);if(!normalized)warning='日期或时区无法独立确认；仅展示原文，请在事件表单手动填写';}
  if(c.key==='round'){normalized=/^\d{1,2}$/.test(c.value)&&Number(c.value)>=1&&Number(c.value)<=20?Number(c.value):'';if(!normalized)warning='轮次需手动核对';}
  if(c.key==='url'){try{normalized=require('./event-context.cjs').meetingUrl(c.value);}catch{normalized='';warning='链接无效，请手动核对';}}
  return{id:'mail-change-'+i,key:c.key,label:fields[c.key],value:c.value,normalized,quote:c.quote,warning,adoptable:normalized!==''};
 });
}
const instruction='从所选邮件原文提取事件核对草稿，只返回 {"changes":[{"key":"字段标识","value":"原文值","quote":"对应原文连续子串"}]}。字段仅限输入fields。type只能为interview/assessment/materials/offer/booking/other，action只能为create/reschedule/cancel；这两项也必须附原文证据，其他value必须是quote中的连续原文子串，不改写或补全日期、年份、时区、机构、编号、轮次、链接。冲突或不确定可以不提取。保留日期原文，后续本机独立转换；Offer发出、回复和入职日期必须分开。不推断收到日期，不根据邮件声称任务完成。';
function mailScope(store,input){
 if(input.confirmed!==true)throw Error('请确认发送片段及费用');
 const c=store.get('confirmations',input.confirmationId);if(!c||c.kind!=='mail_event'||c.status!=='pending'||c.revision!==input.revision)throw Error('邮件草稿已变化或已处理，请重新核对');
 const m=store.get('messages',c.messageId),text=input.text,offset=input.offset||'';
 if(typeof text!=='string'||!text.trim()||text.length>20000||!m||!(m.subject+'\n'+m.text).includes(text))throw Error('请选择邮件原文中连续的 1 至 20000 字片段');
 if(!['','+08:00','+00:00','-04:00','-05:00'].includes(offset))throw Error('时区选择无效');
 return{confirmationId:c.id,confirmationRevision:c.revision,messageId:m.id,text,offset};
}
function assertMailScope(store,scope){const current=mailScope(store,{confirmationId:scope.confirmationId,revision:scope.confirmationRevision,text:scope.text,offset:scope.offset,confirmed:true});if(current.messageId!==scope.messageId)throw Error('邮件来源已变化');return current;}
function createMailAI(store,settings,{invoke=modelJSON,hostedConfig=()=>({})}={}){
 const controllers=new Map();let closed=false;
 const put=(old,patch)=>store.put('aiJobs',{...old,...patch},{expectedRevision:old.revision});
 function confirmation(id){const c=store.get('confirmations',id);if(!c||c.kind!=='mail_event'||c.status!=='pending')throw Error('邮件已处理或待确认记录不存在');return c;}
 function authorized(job){const current=hostedConfig();return job.billing!=='hosted'||current.connected&&job.server===current.baseUrl&&job.accountId===current.accountId;}
 function get(id){const j=store.get('aiJobs',id);if(!j||j.kind!=='mail-parse'||!authorized(j))throw Error('邮件解析任务不存在');return j;}
 function list(id){return store.list('aiJobs').filter(j=>j.kind==='mail-parse'&&j.confirmationId===id&&authorized(j));}
 function config(){let s;try{s=settings?.read();}catch{return{enabled:false,model:'',baseUrl:'',fingerprint:'',error:'自带 Key 配置无法读取'};}return{fingerprint:digest(JSON.stringify(s||{})),enabled:!!s?.enabled,model:s?.model||'',baseUrl:s?.baseUrl||''};}
 async function run(input){
  if(closed)throw Error('邮件解析服务已关闭');if(input.confirmed!==true)throw Error('请确认发送片段及供应商费用');
  const c=confirmation(input.confirmationId);if(c.revision!==input.revision)throw Error('邮件草稿已变化，请重新打开');
  const m=store.get('messages',c.messageId),text=input.text;
  if(typeof text!=='string'||!text.trim()||text.length>20000||!(m.subject+'\n'+m.text).includes(text))throw Error('请选择邮件原文中连续的 1 至 20000 字片段');
  const offset=input.offset||'';if(!['','+08:00','+00:00','-04:00','-05:00'].includes(offset))throw Error('时区选择无效');
  const settingsValue=settings?.read();if(!settingsValue?.enabled)throw Error('请先配置并启用模型服务');
  const fingerprint=digest(JSON.stringify(settingsValue));if(input.fingerprint!==fingerprint)throw Error('模型供应商配置已变化，请重新确认发送范围与费用');
  const scopeHash=digest(JSON.stringify([c.id,c.revision,text,offset,fingerprint])),id=input.requestId||randomUUID();if(!/^[a-f0-9-]{36}$/.test(id))throw Error('任务标识无效');
  const previous=store.get('aiJobs',id);if(previous){if(previous.kind!=='mail-parse'||previous.scopeHash!==scopeHash)throw Error('任务标识对应其他请求');return previous;}
  let job=store.put('aiJobs',{id,kind:'mail-parse',confirmationId:c.id,confirmationRevision:c.revision,messageId:m.id,scopeHash,text,offset,billing:'byok',status:'running',createdAt:new Date().toISOString()});
  const abort=new AbortController();controllers.set(id,abort);
  try{
   const result=await invoke(settingsValue,{instruction,input:{text,fields},signal:abort.signal,maxTokens:4000});
   const changes=validateMailResult(result,text,offset);
   if(abort.signal.aborted||closed)throw Error('任务已取消');if(confirmation(c.id).revision!==c.revision)throw Error('邮件草稿已变化，请重新核对');
   job=get(id);return put(job,{status:'ready',changes});
  }catch(error){if(!closed)put(get(id),{status:abort.signal.aborted?'cancelled':'failed',error:abort.signal.aborted?'任务已取消':error.message});throw error;}
  finally{controllers.delete(id);}
 }
 function adopt(input){
  const j=get(input.jobId);if(j.status!=='ready')throw Error('解析草稿不可采用');const c=confirmation(j.confirmationId);if(c.revision!==j.confirmationRevision)throw Error('邮件草稿已变化，请重新解析');
  if(input.confirmed!==true||!Array.isArray(input.ids)||!input.ids.length||new Set(input.ids).size!==input.ids.length)throw Error('请核对并选择要采用的字段');
  const selected=input.ids.map(id=>{const item=j.changes.find(x=>x.id===id);if(!item?.adoptable)throw Error('字段不能直接采用');return item;});
  return store.transaction(()=>{
   const proposal={...c.proposal,confidence:'needs_review',structuredUpdate:false,source:'mail_ai_user_reviewed',reason:'AI 草稿已逐项核对；请继续确认事件与关联对象'};
   let associationChanged=false;
   for(const item of selected){
    if(item.key==='organizationName'){const orgs=store.list('organizations').filter(o=>o.name===item.normalized);if(orgs.length!==1)throw Error('机构原名未唯一匹配，请先手动核对机构');proposal.organizationId=orgs[0].id;associationChanged=true;}
    else if(['applicationReference','jobTitle'].includes(item.key)){proposal[item.key]=item.normalized;associationChanged=true;}
    else proposal[item.key]=item.normalized;
   }
   if(selected.some(x=>['type','action'].includes(x.key))){proposal.eventId='';proposal.linkReason='事件类型或处理方式已变化，请重新核对既有事件';}
   if(associationChanged){
    const text=[proposal.applicationReference?'申请编号：'+proposal.applicationReference:'',proposal.jobTitle?'申请岗位：'+proposal.jobTitle:''].filter(Boolean).join('\n');
    const association=associateApplication({subject:'',text},proposal,store);proposal.applicationMatch=association;proposal.applicationId=association.applicationId;proposal.planId=association.planId;proposal.eventId='';proposal.linkReason='关联依据已变化，请重新核对既有事件';
   }
   const saved=store.put('confirmations',{...c,proposal,proposalHistory:[...(c.proposalHistory||[]),{at:new Date().toISOString(),proposal:c.proposal,jobId:j.id,ids:input.ids}],aiEvidence:selected.map(x=>({key:x.key,quote:x.quote,value:x.value,normalized:x.normalized}))},{expectedRevision:c.revision});
   put(j,{status:'adopted',adoptedIds:input.ids});return saved;
  });
 }
 function cancel(id){get(id);const c=controllers.get(id);if(c){c.abort();return true;}return false;}
 for(const j of store.list('aiJobs').filter(j=>j.kind==='mail-parse'&&j.status==='running'))put(j,{status:'interrupted',error:'应用中断，供应商可能已计费；不会自动重试'});
 function close(){closed=true;for(const c of controllers.values())c.abort();}
 return{config,list,run,adopt,cancel,close};
}
module.exports={createMailAI,validateMailResult,dateValue,fields,instruction,mailScope,assertMailScope};
