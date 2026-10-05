'use strict';
const {timestamp}=require('./workflow.cjs');
function proposeMail(message,organizations){
 const content=message.subject+'\n'+message.text;
 const classify=value=>/offer|录用通知/i.test(value)?'offer':/面试|interview/i.test(value)?'interview':/测评|笔试|assessment/i.test(value)?'assessment':/补.{0,3}材料|材料补充/.test(value)?'materials':/预约/.test(value)?'booking':'other';
 const subjectType=classify(message.subject),type=subjectType==='other'?classify(content):subjectType;
 const action=/取消|cancelled|canceled|cancellation/i.test(content)?'cancel':/改期|延期|推迟|变更|调整.*时间|reschedul/i.test(content)?'reschedule':'create';
 const matches=[...content.matchAll(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})\b/g)].map(match=>match[0]);
 const times=[...new Set(matches)].flatMap(value=>{try{return[timestamp(value)];}catch{return[];}});
 const orgs=organizations.filter(org=>content.includes(org.name));
 const iso='(\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2})?(?:Z|[+-]\\d{2}:\\d{2}))';
 const labeled=label=>[...new Set([...content.matchAll(new RegExp(label+'\\s*[:：]?\\s*'+iso,'gi'))].flatMap(m=>{try{return[timestamp(m[1])];}catch{return[];}}))];
 const startTimes=labeled('(?:面试(?:开始)?(?:时间|日期)|开始时间|interview time|starts? at)');
 const deadlineTimes=labeled('(?:(?:回复|报名|提交|完成|材料|操作)?截止(?:时间|日期)?|deadline)');
 const startsAt=type==='interview'&&startTimes.length===1?startTimes[0]:'';
 let deadline=deadlineTimes.length===1?deadlineTimes[0]:'';
 const offerDates={};
 if(type==='offer'){
  const issued=labeled('(?:offer\\s*(?:发出|签发)(?:时间|日期)?|录用通知(?:发出|签发)(?:时间|日期)?|offer issued at)');
  const reply=labeled('(?:(?:offer\\s*)?回复截止(?:时间|日期)?|offer reply deadline)');
  const joining=labeled('(?:入职(?:时间|日期)|报到(?:时间|日期)|joining at)');
  offerDates.offerIssuedAt=issued.length===1?issued[0]:'';
  offerDates.offerReceivedAt=message.receivedAtSource==='mail_server'?message.receivedAt:'';
  offerDates.offerReplyDeadline=reply.length===1?reply[0]:'';
  offerDates.joiningAt=joining.length===1?joining[0]:'';
  deadline=offerDates.offerReplyDeadline;
 }

 const ambiguous=/原面试|原定|之前|上一封|并非|不是|不需要|无需|转发|original|previous|forwarded|wrote:|是否|可能|如果|若|暂不|未取消|尚未|待定|暂定|撤回|作废|恢复|仍然|照常|误发|更正|[？?]/i.test(content);
 const clearCancel=/(?:面试|测评|笔试|预约|材料|offer|录用).*(?:已取消|取消通知)|取消(?:面试|测评|笔试|预约|录用|offer)(?:通知)?\s*$|(?:interview|assessment|offer)\s+(?:cancelled|canceled|cancellation)/i.test(message.subject);
 const clearReschedule=/改期|延期|推迟|变更|调整.*时间|reschedul/i.test(message.subject);
 const parseRound=value=>{if(/^[0-9]+$/.test(value))return Number(value);const digits='一二三四五六七八九';if(digits.includes(value)&&value.length===1)return digits.indexOf(value)+1;if(value==='十')return 10;if(/^十[一二三四五六七八九]$/.test(value))return 11+digits.indexOf(value[1]);if(value==='二十')return 20;return 0;};
 const roundMentions=[...content.replace(/最后一轮/g,'').matchAll(/(?:第\s*)?([一二三四五六七八九十百0-9]+)\s*(?:轮(?:面试)?|面)/g)].map(m=>parseRound(m[1]));
 const rounds=[...new Set(roundMentions)],round=rounds.length===1&&rounds[0]>=1&&rounds[0]<=20?rounds[0]:null;
 const final=/终面|最终面试|最后一轮/.test(content),unknownRound=/初面|复试|初试/.test(content)||rounds.some(n=>n<1||n>20);

 const residualTime=matches.reduce((rest,value)=>rest.replace(value,''),content);
 const unparsedTime=matches.some(value=>{try{timestamp(value);return false;}catch{return true;}})||/\d{4}[-/.年]\d{1,2}|\d{1,2}月\d{1,2}|\d{1,2}[:：]\d{2}|(?:今天|明天|后天|昨天|昨日|今日|明日|下周|本周)|[一二三四五六七八九十0-9]+点/.test(residualTime);
 const structuredUpdate=!unparsedTime&&!unknownRound&&rounds.length<=1&&!ambiguous&&orgs.length===1&&type!=='other'&&!message.attachments?.length&&((action==='reschedule'&&clearReschedule&&times.length===1&&!!(startsAt||deadline))||(action==='cancel'&&clearCancel&&times.length===0));
 const exact=!unparsedTime&&!unknownRound&&rounds.length<=1&&!ambiguous&&times.length===1&&orgs.length===1&&!!(startsAt||deadline)&&type!=='other'&&action==='create'&&!message.attachments?.length;
 return {type,action,title:message.subject.slice(0,200),round,final,organizationId:orgs.length===1?orgs[0].id:'',startsAt,deadline,...offerDates,timezone:'Asia/Shanghai',confidence:exact?'structured':'needs_review',structuredUpdate,reason:exact?'明确机构、事件类型及带时区时间，仍需核对邮件真实性':'公司、日期、时区、改期对象或附件需要人工核对',evidence:content.slice(0,20000)};
}
module.exports={proposeMail};
