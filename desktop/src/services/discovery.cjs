'use strict';
const {createHash}=require('node:crypto');
function opportunityFacts(o){return {title:o.title,deadline:o.deadline||'',openedOn:o.openedOn||'',openStatus:o.openStatus,statusVerified:!!o.statusVerified,city:o.city||[]};}
const labels={not_interested:'不感兴趣',condition_mismatch:'条件不符',seen:'已看过'};
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return typeof value==='string'?value.normalize('NFKC').replace(/\s+/g,' ').trim():value;}
function fingerprint(o){return createHash('sha256').update(JSON.stringify(canonical(Object.fromEntries(['organizationId','title','batch','route','city','direction','industry','nature','workMode','openedOn','deadline','openStatus','statusVerified','eligibility'].map(k=>[k,['route','city','direction','industry','nature','workMode'].includes(k)?[...new Set((o[k]||[]).map(v=>canonical(v)))].sort():o[k]??null]))))).digest('hex');}
function applyFeedback(o,user,now){
 const f=user?.feedback,changed=!!f&&f.kind!=='none'&&f.fingerprint!==fingerprint(o),active=f&&f.kind!=='none'&&!changed&&(!f.until||Date.parse(f.until)>Date.parse(now));
 const hidden=active&&f.kind!=='seen'||(!f&&user?.state==='ignored');
 return {...o,userState:user?.state||'new',feedback:f||null,feedbackChanged:changed&&user?.acknowledgedFingerprint!==fingerprint(o),feedbackHidden:!!hidden,qualificationMatch:o.match,match:hidden?{...o.match,included:false,tier:'excluded',filterOrigin:'user',reason:`个人反馈：${labels[f?.kind]||'已忽略'}${f?.reason?' · '+f.reason:''}。可恢复后重新匹配。`}:o.match};
}
function createDiscovery(store,{clock=()=>new Date().toISOString()}={}){
 function put(id,patch){const old=store.get('userOpportunities',`user-${id}`);return store.put('userOpportunities',{...old,id:`user-${id}`,opportunityId:id,state:old?.state||'new',...patch},old?{expectedRevision:old.revision}:{});}
 function feedback(input){
  const o=store.get('opportunities',input.id);if(!o)throw Error('机会不存在');
  if(input.revision!==o.revision)throw Error('岗位已更新，请刷新后重新反馈');
  if(!['none',...Object.keys(labels)].includes(input.kind))throw Error('反馈类型无效');
  if(typeof input.reason!=='string'||input.reason.trim().length>1000)throw Error('反馈原因格式无效');
  if(input.kind==='condition_mismatch'&&!input.reason.trim())throw Error('请说明不符合的条件');
  if(![0,7,30].includes(input.days))throw Error('反馈有效期无效');
  const now=clock(),old=store.get('userOpportunities',`user-${input.id}`),fp=fingerprint(o);
  return put(input.id,{...(old?.state==='ignored'?{state:'new'}:{}),feedback:{kind:input.kind,days:input.days,reason:input.reason.trim(),createdAt:now,until:input.days?new Date(Date.parse(now)+input.days*86400000).toISOString():'',fingerprint:fp},acknowledgedFingerprint:fp,lastPresentedFingerprint:fp,lastPresentedFacts:opportunityFacts(o)});
 }
 function acknowledge(id,revision){const o=store.get('opportunities',id);if(!o)throw Error('机会不存在');if(revision!==o.revision)throw Error('岗位已更新，请刷新后重新核对');return put(id,{acknowledgedFingerprint:fingerprint(o),lastPresentedFingerprint:fingerprint(o),lastPresentedFacts:opportunityFacts(o)});}
 return{feedback,acknowledge};
}
module.exports={opportunityFacts,fingerprint,applyFeedback,createDiscovery};
