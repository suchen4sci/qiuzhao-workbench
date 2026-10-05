'use strict';
function associateApplication(message,proposal,store){
 const content=message.subject+'\n'+message.text;
 const read=labels=>[...new Set([...content.matchAll(new RegExp('(?:^|[\\r\\n])\\s*(?:'+labels+')\\s*[:：]\\s*([^\\r\\n]+)','gi'))].map(m=>m[1].trim()))];
 const refs=read('申请编号|申请号|application (?:id|number)'),titles=read('申请岗位|应聘岗位|岗位名称|job title');
 const applications=store.list('applications').filter(a=>a.organizationId===proposal.organizationId&&a.status==='submitted');
 const result=(status,reason,app)=>({status,reason,applicationId:app?.id||'',planId:app?.planId||'',referenceNumber:refs.length===1?refs[0]:'',jobTitle:titles.length===1?titles[0]:''});
 if(refs.length>1||titles.length>1)return result('conflict','邮件包含多个申请编号或岗位，请核对');
 if(!refs.length&&!titles.length)return result(applications.length>1?'ambiguous':'unlinked',applications.length>1?'此单位有多个申请，邮件未明确编号或岗位':'邮件未提供明确申请编号或岗位，暂不关联申请');
 if(!proposal.organizationId)return result('ambiguous','邮件机构未唯一识别，不能仅凭编号关联');
 let candidates=applications;
 if(refs.length)candidates=candidates.filter(a=>a.referenceNumber===refs[0]);
 if(titles.length)candidates=candidates.filter(a=>store.get('opportunities',a.opportunityId)?.title===titles[0]);
 if(candidates.length!==1)return result(candidates.length?'ambiguous':'conflict',candidates.length?'编号或岗位对应多个申请，请核对':'编号或岗位与已登记提交的申请不一致');
 return result('matched','邮件中的机构与明确编号 / 岗位唯一对应已登记申请',candidates[0]);
}
// Only explicit mail-thread evidence can select an existing event automatically.
function linkMail(message,proposal,store){
 const references=new Set(message.references||[]);
 const referenced=store.list('messages').filter(m=>m.id!==message.id&&m.connectionId===message.connectionId&&m.from?.toLowerCase()===message.from.toLowerCase()&&m.messageId&&references.has(m.messageId));
 const ids=new Set(referenced.map(m=>m.id));
 const linked=store.list('events').filter(e=>(e.messageIds||[]).some(id=>ids.has(id)));
 if(linked.length!==1)return{eventId:'',reason:linked.length?'邮件线程对应多个事件，请选择':'没有唯一邮件线程依据，请选择事件'};
 const event=linked[0];
 if(proposal.applicationId&&event.applicationId!==proposal.applicationId)return{eventId:'',reason:'邮件编号 / 岗位与线程事件关联申请不一致'};
 if(event.organizationId!==proposal.organizationId||event.type!==proposal.type)return{eventId:'',reason:'邮件机构或类型与线程事件不一致'};
 return{eventId:event.id,eventRevision:event.revision,reason:'同邮箱、同发件地址的邮件线程唯一对应此事件'};
}
function automaticUpdate(message,proposal,event,store){
 if(!event||event.source!=='mail_user_configured_rule')return '事件已由用户创建或修正，请人工核对';
 if(proposal.final&&!event.final)return '终面标记与既有事件不一致';
 if(proposal.round!==null&&proposal.round!==undefined&&proposal.round!==event.round)return '面试轮次与既有事件不一致';
 const task=store.get('tasks','task-event-'+event.id);
 if(event.status!=='scheduled'||task?.status!=='pending')return '事件或任务已结束，请人工核对';
 const prior=(event.messageIds||[]).map(id=>store.get('messages',id));
 if(!prior.length||prior.some(m=>!m||m.connectionId!==message.connectionId||m.from?.toLowerCase()!==message.from.toLowerCase()))return '历史邮件来源不一致';
 if(message.receivedAtSource!=='mail_server'||!message.sentAt||prior.some(m=>m.receivedAtSource!=='mail_server'||!m.sentAt||Date.parse(m.receivedAt)>=Date.parse(message.receivedAt)||Date.parse(m.sentAt)>=Date.parse(message.sentAt)))return '邮件时间缺失或顺序不明确，请核对较新的通知';
 if(proposal.action==='reschedule'&&proposal.startsAt&&event.endsAt)return '既有结束时间需要一并核对';
 return '';
}
module.exports={linkMail,automaticUpdate,associateApplication};
