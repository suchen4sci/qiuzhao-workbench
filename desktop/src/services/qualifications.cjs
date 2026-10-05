'use strict';
const {randomUUID}=require('node:crypto');
const fields=['highestEducation','latestMajor','majorCode','graduationYear','certificates','workYears','politicalStatus'];
function validateEligibility(value){
 if(value===null)return null;
 if(!value||!Array.isArray(value.anyOf)||value.anyOf.length>10||!value.anyOf.length)throw Error('请填写 1 至 10 条资格路径，或明确清空规则');
 return {anyOf:value.anyOf.map(branch=>{
  if(!Array.isArray(branch)||branch.length<1||branch.length>20)throw Error('每条路径须填写 1 至 20 项条件；请移除空路径');
  return branch.map(rule=>{
   if(!rule||!fields.includes(rule.field)||!['oneOf','minimum'].includes(rule.operator))throw Error('资格字段或比较方式无效');
   if(!Array.isArray(rule.values)||!rule.values.length||rule.values.length>40||rule.values.some(v=>typeof v!=='string'||!v.trim()||v.length>200))throw Error('资格条件值无效');
   const values=[...new Set(rule.values.map(v=>v.trim()))];
   if(rule.operator==='minimum'&&(!['highestEducation','workYears'].includes(rule.field)||values.length!==1))throw Error('最低要求仅适用于单一学历或年限');
   if(rule.field==='highestEducation'&&values.some(v=>!['高中','大专','本科','硕士','博士'].includes(v)))throw Error('学历请使用高中、大专、本科、硕士或博士');
   if(rule.field==='workYears'&&values.some(v=>!/^\d+(\.\d+)?$/.test(v)||Number(v)>100))throw Error('工作年限须为 0 至 100 的数值');
   if(rule.field==='graduationYear'&&values.some(v=>!/^\d{4}$/.test(v)))throw Error('届别请填写四位年份');
   if(typeof rule.verified!=='boolean'||typeof rule.exact!=='boolean'||typeof rule.evidence!=='string'||rule.evidence.length>5000||rule.verified&&!rule.evidence.trim())throw Error('已核验条件必须填写原文依据');
   const sourceUrl=rule.sourceUrl?require('./public-page.cjs').publicUrl(rule.sourceUrl).href:'';
   return {field:rule.field,operator:rule.operator,values,verified:rule.verified,exact:rule.exact,evidence:rule.evidence.trim(),sourceUrl};
  });
 })};
}
function createQualifications(store,{clock=()=>new Date().toISOString()}={}){
 function save(input){const old=store.get('opportunities',input.id);if(!old)throw Error('岗位不存在');if(old.revision!==input.revision)throw Error('岗位已变化，请重新核对资格');if(input.confirmed!==true)throw Error('请确认按公告核对资格条件');const eligibility=validateEligibility(input.eligibility);return store.transaction(()=>{const snapshot=store.put('snapshots',{id:'qualification-review-'+randomUUID(),kind:'qualification_review',opportunityId:old.id,previousEligibility:old.eligibility||null,eligibility,reviewedAt:clock()});return store.put('opportunities',{...old,eligibility,qualificationReview:{snapshotId:snapshot.id,reviewedAt:clock()}},{expectedRevision:input.revision});});}
 return {save};
}
module.exports={createQualifications,validateEligibility,fields};
