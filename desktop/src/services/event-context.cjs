'use strict';
function eventContext(store,event){
 const application=event.applicationId?store.get('applications',event.applicationId):null;
 const plan=event.planId?store.get('plans',event.planId):application?.planId?store.get('plans',application.planId):null;
 if(event.applicationId&&!application||event.planId&&!plan)throw Error('面试关联记录已移除，请重新核对');
 if(application&&application.organizationId!==event.organizationId||plan&&plan.organizationId!==event.organizationId||application&&plan&&application.planId!==plan.id)throw Error('面试关联的单位或申请不一致');
 if(event.opportunityId&&(application&&application.opportunityId!==event.opportunityId||plan&&plan.opportunityId!==event.opportunityId))throw Error('关联计划岗位已变化，请重新核对面试岗位');
 const id=event.opportunityId||application?.opportunityId||plan?.opportunityId;
 const opportunity=id?store.get('opportunities',id):null;
 if(id&&!opportunity||opportunity&&opportunity.organizationId!==event.organizationId)throw Error('面试关联岗位不存在或单位不一致');
 return {application,plan,opportunity};
}
function meetingUrl(value){return require('./public-page.cjs').publicLink(value);}
module.exports={eventContext,meetingUrl};
