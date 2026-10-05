'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {fingerprint,mappingAllowed}=require('./ai-mapping.cjs');
const {groups}=require('./rules.cjs');
const {confirmedRecordValue,valueForControl}=require('./engine.cjs');
function profileStamp(profile){return createHash('sha256').update(JSON.stringify(profile)).digest('hex');}
function candidatesFrom(scan){return scan.items.filter(c=>c.hasValue&&!c.disabled&&c.labels?.length&&(c.section||!c.headings?.length)&&!c.datePart&&!c.componentCount&&!c.nativeRegion&&!/password|file|checkbox|radio|hidden/.test(c.type)&&!c.nativeRadioGroup&&!c.antRadio&&!c.customRadio&&!/密码|验证码|动态码|口令|登录|承诺|声明|同意|签署|otp|password|captcha|token|secret/i.test(c.labels.join(' '))&&(!c.match||!c.match.spec.manual));}
const stamp=c=>JSON.stringify([fingerprint(c),c.frameIndex,c.observedValue,c.readonly,c.disabled,c.options,c.maxLength]);
function selected(ticket,ids,scan){if(!ticket||ticket.url!==scan.url||!Array.isArray(ids)||!ids.length||ids.length>60||new Set(ids).size!==ids.length)throw Error('请重新选择 1 至 60 个已填字段');const current=candidatesFrom(scan);return ids.map(id=>{const prior=ticket.candidates.find(c=>c.id===id),now=current.find(c=>c.id===id);if(!prior||!now||stamp(prior)!==stamp(now))throw Error('字段现值或页面已变化，请重新核对');return now;});}
function proposals(candidates,mappings,profile,url){return mappings.flatMap(mapping=>{
 const c=candidates.find(c=>c.id===mapping.id);if(!c||!mappingAllowed(c,mapping.group,mapping.key))throw Error('字段建议无效');
 const spec=groups[mapping.group].fields[mapping.key];
 const options=(profile.values[mapping.group]||[]).flatMap((record,index)=>{const fact=confirmedRecordValue(record,mapping.key,new URL(url).origin);if(fact.reason)return[];const transformed=valueForControl(fact.value,spec,c);if(transformed.reason||transformed.value===c.observedValue)return[];return[{index,value:transformed.value,fact:String(fact.value??''),source:`${groups[mapping.group].label} · 第 ${index+1} 条 · ${spec.label}${fact.portalOverride?' · 本站确认口径':''}`,recordLabel:[record.name,record.school,record.company,record.level,record.startTime].filter(Boolean).join(' / ')}];});
 return[{...mapping,currentValue:c.observedValue,options}];
 });}
function allowedMappings(candidates,profile,url){return candidates.map(c=>({id:c.id,targets:Object.entries(groups).flatMap(([group,g])=>Object.keys(g.fields).filter(key=>mappingAllowed(c,group,key)).filter(key=>proposals([c],[{id:c.id,group,key}],profile,url)[0].options.length).map(key=>({group,key})))}));}
function choices(ticket,selection,scan,profile){if(profileStamp(profile)!==ticket.profileStamp)throw Error('个人资料或申请快照已变化，请重新核对');if(!Array.isArray(selection)||!selection.length||new Set(selection.map(s=>s.id)).size!==selection.length)throw Error('请勾选字段并选择真实资料依据');const current=selected(ticket,selection.map(s=>s.id),scan);return selection.map(s=>{const p=ticket.proposals.find(p=>p.id===s.id),option=p?.options.find(o=>o.index===s.index),c=current.find(c=>c.id===s.id);if(!option||!Number.isInteger(s.index))throw Error('请选择已展示的资料依据');return{candidate:c,proposal:p,option};});}
async function apply(page,profile,ticket,selection,{scanPage,executeControl,cancelled=()=>false}={}){
 const scan=await scanPage(page,profile),chosen=choices(ticket,selection,scan,profile),results=[],inputGuard='__qiuzhaoCorrection_'+randomUUID().replaceAll('-',''),frames=page.frames? page.frames():[];
 async function userChanged(){for(const frame of frames){try{if(await frame.evaluate(key=>globalThis[key]?.changed===true,inputGuard))return true;}catch{return true;}}return false;}
 try{
  for(const frame of frames)await frame.evaluate(key=>{const state={changed:false};state.listener=e=>{if(!e.isTrusted)return;if(['input','change'].includes(e.type)&&e.target===state.expected?.node&&String(e.target.value??e.target.textContent??'')===state.expected.value)return;state.changed=true;};for(const type of ['keydown','paste','input','change'])document.addEventListener(type,state.listener,true);globalThis[key]=state;},inputGuard);
  for(const {candidate:c,proposal:p,option:o}of chosen){
   if(cancelled()||page.url()!==ticket.url||await userChanged()){results.push({id:c.id,status:'skipped',reason:'已暂停：人工输入、停止或页面变化，请重新扫描'});break;}
   try{const latest=await scanPage(page,profile),current=selected(ticket,[c.id],latest)[0];if(cancelled()||await userChanged())throw Error('已暂停，请重新扫描');const locator=current.frame.locator(current.selector);
    const result=await executeControl(current.frame,locator,{...current,value:o.value,match:{groupId:p.group,key:p.key,spec:groups[p.group].fields[p.key]},allowOverwrite:true,expectedCurrent:c.observedValue,inputGuard,cancelled});
    if(await userChanged()){results.push({id:c.id,label:c.label,status:'needs_review',reason:'检测到执行期间输入，已暂停；请核对网页当前值并重新扫描'});break;}
    results.push({id:c.id,label:c.label,status:result.status,before:c.observedValue,after:result.value,source:o.source});
   }catch(error){results.push({id:c.id,label:c.label,status:'needs_review',reason:error.message});break;}
  }
 }finally{for(const frame of frames)try{await frame.evaluate(key=>{const state=globalThis[key];if(state)for(const type of ['keydown','paste','input','change'])document.removeEventListener(type,state.listener,true);delete globalThis[key];},inputGuard);}catch{}}
 const handled=new Set(results.map(r=>r.id));for(const {candidate:c}of chosen)if(!handled.has(c.id))results.push({id:c.id,label:c.label,status:'skipped',reason:'前项未完成，已停止后续修改'});
 return{results,saved:false,message:'仅修改当前网页；尚未核验网站保存，不改变个人资料或后续普通填写规则'};
}

module.exports={allowedMappings,profileStamp,candidatesFrom,stamp,selected,proposals,choices,apply};
