(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.InterviewPreparation=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const newest=items=>[...items].sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||(b.id||'').localeCompare(a.id||''))[0];
 function contextId(event,state){return event.opportunityId||state.applications?.find(a=>a.id===event.applicationId)?.opportunityId||state.plans?.find(p=>p.id===event.planId)?.opportunityId||'';}
 function summary(event,state){const briefing=newest(state.briefings.filter(b=>b.eventId===event.id&&b.status==='ready')),jobs=state.aiJobs.filter(j=>j.eventId===event.id&&['interview-briefing','hosted-briefing'].includes(j.kind)),job=newest(jobs),opportunity=state.opportunities.find(o=>o.id===contextId(event,state));
 const application=state.applications?.find(a=>a.id===event.applicationId),plan=state.plans?.find(p=>p.id===(event.planId||application?.planId));
 const associationStale=!!(event.applicationId&&!application||event.planId&&!plan||application&&application.organizationId!==event.organizationId||plan&&plan.organizationId!==event.organizationId||application&&plan&&application.planId!==plan.id||event.opportunityId&&(application&&application.opportunityId!==event.opportunityId||plan&&plan.opportunityId!==event.opportunityId));
 const stale=associationStale||!!briefing&&(briefing.eventRevision!==event.revision||!!briefing.opportunityId&&(briefing.opportunityId!==opportunity?.id||briefing.opportunityRevision!==opportunity?.revision)||!!briefing.profileHash&&(state.profileUnavailable||!!state.profileHash&&briefing.profileHash!==state.profileHash));
 const running=jobs.some(j=>['running','queued','pending_remote'].includes(j.status));
 const failed=job&&['failed','cancelled','interrupted'].includes(job.status)&&(!briefing||String(job.createdAt||'')>=String(briefing.createdAt||''));
 const status=running?'running':failed?'failed':stale?'stale':briefing?'ready':job?.status==='quoted'?'quoted':'empty';
 const label={running:briefing?'正在生成新简报，已有材料仍可阅读':'简报生成中',failed:briefing?'本次生成未完成，已有材料仍可阅读':'生成未完成，可重试或手工准备',stale:'安排、岗位或资料已变化，请核对已有简报',ready:'简报可阅读',quoted:'已获取报价，等待确认生成',empty:'尚无简报，可手工准备或按需生成'}[status];
 return {status,label:associationStale?'关联岗位或申请已变化，请修改面试重新核对；已有材料仍可阅读':label,briefing,job,stale,opportunity};
 }
 function next(events,now=Date.now()){return events.filter(e=>e.type==='interview'&&!['completed','cancelled'].includes(e.status)&&Number.isFinite(Date.parse(e.startsAt))&&Date.parse(e.endsAt||new Date(Date.parse(e.startsAt)+3600000).toISOString())>now).sort((a,b)=>Date.parse(a.startsAt)-Date.parse(b.startsAt))[0]||null;}
 function imminent(event,now=Date.now()){return !['completed','cancelled'].includes(event.status)&&Number.isFinite(Date.parse(event.startsAt))&&Date.parse(event.startsAt)-now<=30*60000&&Date.parse(event.endsAt||new Date(Date.parse(event.startsAt)+3600000).toISOString())>now;}
 return {summary,next,imminent,contextId};
});
