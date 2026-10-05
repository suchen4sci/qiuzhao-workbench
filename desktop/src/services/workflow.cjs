'use strict';
const { createHash } = require('node:crypto');
const { validatePreferences, matchOpportunity } = require('./matching.cjs');
const {applyFeedback,fingerprint,opportunityFacts}=require('./discovery.cjs');
const { explicitWebLink } = require('./public-page.cjs');
const EVENT_TYPES = ['application', 'assessment', 'interview', 'booking', 'materials', 'offer', 'preparation', 'other'];
function text(value, max = 500, required = false) {
  if (value !== undefined && typeof value !== 'string') throw Error('文本字段格式不正确');
  const result = (value || '').trim();
  if (result.length > max || (required && !result)) throw Error('请填写完整且不过长的内容');
  return result;
}
function date(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) throw Error('日期无效');
  return value;
}
function timestamp(value, required = false) {
  if (!value && !required) return '';
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw Error('时间需要包含有效时区');
  date(value.slice(0,10),true);
  return new Date(value).toISOString();
}
function timezone(value) {
  try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); } catch { throw Error('时区无效'); }
  return value;
}
function dayOf(value, zone = 'Asia/Shanghai') {
  timezone(zone);
  return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date(value));
}
function tags(value) { if (!Array.isArray(value) || value.length > 40) throw Error('标签格式无效'); return [...new Set(value.map(x => text(x,120,true)))]; }
function key(...parts) { return createHash('sha256').update(parts.map(x => String(x || '').normalize('NFKC').trim().toLowerCase()).join('\0')).digest('hex').slice(0,40); }
function createWorkflow(store, profileService, { clock = () => new Date().toISOString() } = {}) {
  const get = (collection, id) => { const item = store.get(collection, id); if (!item) throw Error('记录不存在或已移除'); return item; };
  function update(collection, current, patch) { return store.put(collection, { ...current, ...patch }, { expectedRevision: current.revision }); }
  function organization(input) {
    const name = text(input.name,150,true), type = input.type || 'enterprise';
    if (!['enterprise','public','government','university'].includes(type)) throw Error('机构类型无效');
    const id = input.id || `org-${key(type,name)}`;
    const old = store.get('organizations',id);
    const item = { id, name, type, website: input.website ? explicitWebLink(input.website) : '', nature: tags(input.nature || []) };
    if (old && input.revision !== undefined && input.revision !== old.revision) throw Error('机构已更新，请刷新');
    return old ? update('organizations',old,item) : store.put('organizations',item);
  }
  function opportunity(input) {
    const org = get('organizations',input.organizationId);
    const title = text(input.title,200,true), batch = text(input.batch,120), externalId = text(input.externalId,160);
    const route = input.route || 'enterprise';
    if (!['enterprise','civil','public','postgraduate'].includes(route)) throw Error('机会路线无效');
    const city = tags(input.city || []), id = input.id || `opp-${key(org.id,externalId || title,batch,city.join('|'))}`;
    const old = store.get('opportunities',id);
    if (old && input.revision !== undefined && input.revision !== old.revision) throw Error('岗位已更新，请刷新');
    const openStatus = input.openStatus || 'unknown';
    if (!['open','closed','unknown','rolling'].includes(openStatus)) throw Error('开放状态无效');
    const verified = input.statusVerified === true;
    const evidence = text(input.evidence,20000);
    if (verified && !evidence) throw Error('核验开放状态需要保留依据');
    const item = { id, organizationId: org.id, title, batch, externalId, route:[route], city,
      direction:tags(input.direction || []), industry:tags(input.industry || []), workMode:tags(input.workMode || []), nature:org.nature,
      description:text(input.description,100000), url:input.url ? explicitWebLink(input.url) : '',
      openStatus, statusVerified:verified, openedOn:date(input.openedOn), deadline:date(input.deadline),
      evidence, evidenceSource: input.evidenceSource || 'manual', firstSeenAt:old?.firstSeenAt || clock(),
      lastVerifiedAt:verified ? clock() : old?.lastVerifiedAt || '', eligibility: input.eligibility || old?.eligibility || null };
    return old ? update('opportunities',old,item) : store.put('opportunities',item);
  }
  function watch(input) {
    const org = get('organizations',input.organizationId), id=`watch-${org.id}`;
    const old=store.get('watches',id);
    const values={id,organizationId:org.id,enabled:input.enabled!==false,coverage:old?.coverage || 'not_connected'};
    return old ? update('watches',old,values) : store.put('watches',values);
  }
  function preferences(input) {
    const validated = validatePreferences(input), current=store.get('preferences','main');
    return store.put('preferences',{...validated,id:'main'},{expectedRevision:input.revision ?? (current ? -1 : 0)});
  }
  function plan(input) {
    const org=get('organizations',input.organizationId), opp=input.opportunityId ? get('opportunities',input.opportunityId) : null;
    if (opp && opp.organizationId !== org.id) throw Error('岗位与机构不一致');
    const id=input.id || `plan-${key(org.id,opp?.id || 'awaiting')}`, old=store.get('plans',id);
    if (old && input.revision !== undefined && old.revision !== input.revision) throw Error('计划已更新，请刷新');
    if (old && old.organizationId !== org.id) throw Error('不能更换已有计划的机构');
    const existingApplication = old && store.list('applications').find(a=>a.planId===old.id);
    if (existingApplication && old.opportunityId !== (opp?.id || '')) throw Error('已有申请草稿的计划不能改绑岗位，请另建计划');
    if (opp && store.list('plans').some(p=>p.id!==id && p.opportunityId===opp.id)) throw Error('该岗位已有计划，请打开已有计划');
    const priority=input.priority || old?.priority || 'normal';
    if (!['high','normal','low'].includes(priority)) throw Error('优先级无效');
    if(input.reminderEnabled!==undefined&&typeof input.reminderEnabled!=='boolean')throw Error('计划提醒设置无效');
    if (old?.status==='completed') return old;
    const item={id,organizationId:org.id,opportunityId:opp?.id || '',plannedOn:date(input.plannedOn ?? old?.plannedOn),priority,reminderEnabled:input.reminderEnabled??old?.reminderEnabled??true,status:old?.status || (opp ? 'planned':'awaiting_role')};
    if (opp && item.status==='awaiting_role') item.status='planned';
    return store.transaction(()=>{
      const saved=old ? update('plans',old,item) : store.put('plans',item);
      watch({organizationId:org.id});
      if (opp) collect(opp.id,'planned');
      const taskId=`task-${saved.id}`, task=store.get('tasks',taskId);
      const taskData={id:taskId,planId:saved.id,organizationId:org.id,opportunityId:opp?.id || '',kind:'application',title:opp ? `申请 ${opp.title}` : `为 ${org.name} 选择岗位`,plannedOn:saved.plannedOn,reminderEnabled:saved.reminderEnabled,status:'pending',origin:'plan'};
      if (!task) store.put('tasks',taskData);
      else update('tasks',task,{...taskData,status:task.status,history:[...(task.history||[]),...(task.plannedOn!==taskData.plannedOn?[{at:clock(),action:'reschedule',plannedOn:task.plannedOn,title:task.title,toSchedule:{plannedOn:taskData.plannedOn},source:'manual'}]:[])]});
      return saved;
    });
  }
  function collect(opportunityId,state) {
    const opportunity=get('opportunities',opportunityId);
    if (!['saved','planned','applied','ignored','new'].includes(state)) throw Error('机会操作无效');
    const id=`user-${opportunityId}`, old=store.get('userOpportunities',id);
    return old ? update('userOpportunities',old,{state,...(!old.lastPresentedFingerprint?{lastPresentedFingerprint:fingerprint(opportunity),lastPresentedFacts:opportunityFacts(opportunity)}:{})}) : store.put('userOpportunities',{id,opportunityId,state,lastPresentedFingerprint:fingerprint(opportunity),lastPresentedFacts:opportunityFacts(opportunity),firstPresentedAt:clock()});
  }
  function startApplication(planId) {
    return store.transaction(()=>{
      const current=get('plans',planId);
      if (!current.opportunityId) throw Error('请先为计划选择岗位');
      if (current.status==='cancelled') throw Error('请先恢复已取消的计划');
      const id=`application-${current.opportunityId}`, old=store.get('applications',id);
      if (old) {
        if (old.planId !== current.id) throw Error('岗位申请已关联其他计划，请打开原申请');
        if (old.status === 'draft' && current.status !== 'filling') update('plans',current,{status:'filling'});
        return old;
      }
      const facts=profileService.read();
      if (facts.profile.demo) throw Error('当前是演示资料，请先新建个人工作区或确认并替换全部资料');
      const asset=store.list('assets').find(a=>a.default && !a.archived);
      const app=store.put('applications',{id,planId,organizationId:current.organizationId,opportunityId:current.opportunityId,status:'draft',profileHash:facts.hash,assetId:asset?.id || '',assetHash:asset?.hash || ''});
      store.put('snapshots',{id:`snapshot-${id}-draft`,applicationId:id,kind:'draft',profileHash:facts.hash,profile:facts.profile,assetId:app.assetId,assetHash:app.assetHash});
      update('plans',current,{status:'filling'});
      return app;
    });
  }
  function referenceNumber(value){const result=text(value,120);if(result&&(!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(result)))throw Error('申请编号仅支持字母、数字及 . _ / -，请按官网原文填写');return result;}
  function ensureReference(app,value){if(value&&store.list('applications').some(a=>a.id!==app.id&&a.organizationId===app.organizationId&&a.referenceNumber===value))throw Error('该机构已有相同申请编号，请核对关联申请');}
  function applicationReference(input){
    const app=get('applications',input.id);if(input.revision!==app.revision)throw Error('申请已变化，请刷新');if(input.confirmed!==true)throw Error('请核对官网申请编号');
    const value=referenceNumber(input.referenceNumber),evidence=text(input.evidence,2000,true);ensureReference(app,value);
    return update('applications',app,{referenceNumber:value,referenceHistory:[...(app.referenceHistory||[]),{at:clock(),from:app.referenceNumber||'',to:value,evidence,source:'manual'}]});
  }
  function confirmSubmission(input) {
    if (input.confirmed !== true) throw Error('请明确确认已完成申请');
    const at=timestamp(input.occurredAt,true);
    if (Date.parse(at)>Date.parse(clock())) throw Error('提交时间不能在未来');
    const evidence=text(input.evidence,10000,true);
    return store.transaction(()=>{
      const app=get('applications',input.applicationId);
      if (app.status!=='draft' && app.status!=='pending_verification') return app;
      const draft=get('snapshots',`snapshot-${app.id}-draft`);
      if (draft.profile.demo) throw Error('演示资料不能登记真实提交');
      const asset=app.assetId ? get('assets',app.assetId):null;
      if (asset && asset.hash !== app.assetHash) throw Error('绑定附件版本已变化，请重新核验本次实际使用的文件');
      const reference=referenceNumber(input.referenceNumber??app.referenceNumber);ensureReference(app,reference);
      store.put('snapshots',{referenceNumber:reference,id:`snapshot-${app.id}-submitted`,applicationId:app.id,kind:'submitted',profileHash:draft.profileHash,profile:draft.profile,assetId:app.assetId,assetHash:app.assetHash || '',evidence,source:'manual_confirmation',occurredAt:at,pageReadback:app.readback||null,upload:app.upload||null});
      const saved=update('applications',app,{referenceNumber:reference,referenceHistory:[...(app.referenceHistory||[]),...(reference?[{at:clock(),from:app.referenceNumber||'',to:reference,evidence,source:'manual'}]:[])],status:'submitted',submittedAt:at,submissionSource:'manual_confirmation',evidence});
      const p=get('plans',app.planId);update('plans',p,{status:'completed'});
      const task=store.get('tasks',`task-${p.id}`);if(task) completeTask({id:task.id,revision:task.revision,completedAt:at,result:evidence});
      collect(app.opportunityId,'applied');
      return saved;
    });
  }
  function bindAsset(input) {
    const app=get('applications',input.applicationId), asset=get('assets',input.assetId);
    if (app.status!=='draft') throw Error('已提交申请的附件快照不能修改');
    if (asset.archived || asset.extension!=='.pdf') throw Error('请选择未归档的 PDF 简历');
    return store.transaction(()=>{
      const draft=get('snapshots',`snapshot-${app.id}-draft`);
      update('snapshots',draft,{assetId:asset.id,assetHash:asset.hash});
      return update('applications',app,{assetId:asset.id,assetHash:asset.hash,upload:null,readback:null});
    });
  }
  function event(input) {
    const type=input.type || 'interview';if(!EVENT_TYPES.includes(type))throw Error('事件类型无效');
    const org=get('organizations',input.organizationId);
    const old=input.id ? get('events',input.id):null;
    const applicationId=input.applicationId??old?.applicationId??'',application=applicationId?get('applications',applicationId):null;
    const planId=input.planId??application?.planId??old?.planId??'',plan=planId?get('plans',planId):null;
    if(application&&application.organizationId!==org.id||plan&&plan.organizationId!==org.id)throw Error('申请或计划与机构不一致');
    if(application&&plan&&application.planId!==plan.id)throw Error('申请与计划不一致');
    const opportunityId=application?.opportunityId||plan?.opportunityId||'';
    if(opportunityId&&get('opportunities',opportunityId).organizationId!==org.id)throw Error('岗位与机构不一致');
    if(old && old.revision!==input.revision)throw Error('事件已变化，请刷新后修改');
    const offerDates=Object.fromEntries(['offerIssuedAt','offerReceivedAt','offerReplyDeadline','joiningAt'].map(key=>[key,type==='offer'?timestamp(input[key]??old?.[key]):'']));
    const startsAt=timestamp(input.startsAt), deadline=timestamp(input.deadline), endsAt=timestamp(input.endsAt);
    if(type==='offer'&&offerDates.offerReplyDeadline&&deadline&&offerDates.offerReplyDeadline!==deadline)throw Error('Offer 回复截止与操作截止不一致，请核对');
    const dueAt=type==='offer'?(offerDates.offerReplyDeadline||deadline):deadline||startsAt;
    if(endsAt && (!startsAt || Date.parse(endsAt)<=Date.parse(startsAt)))throw Error('结束时间必须晚于开始时间');
    const round=input.round===''||input.round===undefined||input.round===null ? null:Number(input.round);
    if(round!==null && (!Number.isInteger(round)||round<1||round>20))throw Error('面试轮次无效');
    return store.transaction(()=>{
      const data={...(old||{}),organizationId:org.id,applicationId:application?.id||'',planId:plan?.id||'',opportunityId,type,title:text(input.title,200,true),startsAt,endsAt,deadline,...offerDates,timezone:timezone(input.timezone||'Asia/Shanghai'),round,final:input.final===true,location:text(input.location,500),url:input.url?require('./event-context.cjs').meetingUrl(input.url):'',status:old?.status||'scheduled',source:'manual',history:[...(old?.history||[]),{at:clock(),startsAt:old?.startsAt||'',endsAt:old?.endsAt||'',timezone:old?.timezone||'',deadline:old?.deadline||'',applicationId:old?.applicationId||'',planId:old?.planId||'',opportunityId:old?.opportunityId||'',title:old?.title||'',...Object.fromEntries(Object.keys(offerDates).map(key=>[key,old?.[key]||''])),toSchedule:{startsAt,endsAt,deadline,...offerDates,timezone:timezone(input.timezone||'Asia/Shanghai')},source:'manual',action:old?'reschedule':'create'}]};
      const saved=old?update('events',old,data):store.put('events',data);
      const taskId=`task-event-${saved.id}`, task=store.get('tasks',taskId);
      const taskData={id:taskId,eventId:saved.id,organizationId:org.id,applicationId:saved.applicationId,title:saved.title,kind:type,dueAt,startsAt:type==='offer'?'':startsAt,plannedOn:type==='offer'?(dueAt?dayOf(dueAt,saved.timezone):''):startsAt?dayOf(startsAt,saved.timezone):deadline?dayOf(deadline,saved.timezone):'',status:task?.status||'pending',origin:'event'};
      task?update('tasks',task,taskData):store.put('tasks',taskData);
      if (old && (old.startsAt!==startsAt || old.deadline!==deadline || old.offerReplyDeadline!==offerDates.offerReplyDeadline)) for(const reminder of store.list('reminders').filter(r=>r.taskId===taskId && r.status==='pending')) update('reminders',reminder,{status:'cancelled',reason:'rescheduled'});
      return saved;
    });
  }
  function task(input) {
    const org=input.organizationId?get('organizations',input.organizationId):null;
    const old=input.id?get('tasks',input.id):null;
    if(old && old.revision!==input.revision)throw Error('任务已变化，请刷新');
    if(old && old.origin!=='manual')throw Error('请在关联计划或事件中修改安排');
    const item={...(old||{}),title:text(input.title,200,true),organizationId:org?.id||'',plannedOn:date(input.plannedOn),dueAt:timestamp(input.dueAt),kind:EVENT_TYPES.includes(input.kind)?input.kind:'other',status:old?.status||'pending',origin:'manual',history:[...(old?.history||[]),{at:clock(),action:old?'reschedule':'create',plannedOn:old?.plannedOn||'',dueAt:old?.dueAt||'',title:old?.title||'',source:'manual',toSchedule:{plannedOn:date(input.plannedOn),dueAt:timestamp(input.dueAt)}}]};
    return store.transaction(()=>{
      const saved=old?update('tasks',old,item):store.put('tasks',item);
      if(old && (old.plannedOn!==item.plannedOn || old.dueAt!==item.dueAt)) for(const reminder of store.list('reminders').filter(r=>r.taskId===old.id && r.status==='pending'))update('reminders',reminder,{status:'cancelled',reason:'rescheduled'});
      return saved;
    });
  }
  function completeTask(input) {
    return store.transaction(()=>{
      const current=get('tasks',input.id);
      if(current.status==='completed')return current;
      if(current.origin==='plan' && !store.list('applications').some(a=>a.planId===current.planId && a.status==='submitted')) throw Error('申请任务请通过确认实际提交完成；选岗位任务请先绑定岗位');
      if(current.revision!==input.revision)throw Error('任务已变化，请刷新');
      if(current.status==='cancelled')throw Error('已取消任务不能直接完成');
      const completedAt=timestamp(input.completedAt||clock(),true);
      if(Date.parse(completedAt)>Date.parse(clock()))throw Error('实际完成时间不能在未来');
      const activityId=`activity-${current.eventId || current.id}`;
      const old=store.get('activities',activityId), activity={id:activityId,taskId:current.id,eventId:current.eventId||'',kind:current.kind,title:current.title,organizationId:current.organizationId||'',completedAt,result:text(input.result,10000),source:'manual',timezone:timezone(input.timezone||store.get('settings','main')?.timezone||'Asia/Shanghai'),revoked:false};
      activity.history=[...(old?.history||[]),...(old?[{completedAt:old.completedAt,result:old.result,revoked:old.revoked,at:clock()}]:[])];
      old?update('activities',old,activity):store.put('activities',activity);
      const saved=update('tasks',current,{status:'completed',completedAt,result:activity.result});
      if(current.eventId){const e=get('events',current.eventId);update('events',e,{status:'completed'});}
      for(const reminder of store.list('reminders').filter(r=>r.taskId===current.id && r.status==='pending'))update('reminders',reminder,{status:'cancelled'});
      return saved;
    });
  }
  function taskStatus(input) {
    if(!['pending','cancelled'].includes(input.status))throw Error('任务状态无效');
    return store.transaction(()=>{
      const current=get('tasks',input.id);
      if(current.revision!==input.revision)throw Error('任务已变化，请刷新');
      if(current.origin==='plan' && store.list('applications').some(a=>a.planId===current.planId && a.status==='submitted'))throw Error('该申请已经登记提交，请在申请中核对提交记录');
      const activity=store.get('activities',`activity-${current.eventId||current.id}`);
      if(activity && !activity.revoked)update('activities',activity,{revoked:true,history:[...(activity.history||[]),{at:clock(),completedAt:activity.completedAt,result:activity.result,action:'revoke'}]});
      const saved=update('tasks',current,{status:input.status,completedAt:'',result:'',history:[...(current.history||[]),{at:clock(),action:'status',plannedOn:current.plannedOn,dueAt:current.dueAt,from:current.status,to:input.status}]});
      if(current.eventId){const e=get('events',current.eventId);update('events',e,{source:'manual',status:input.status==='cancelled'?'cancelled':'scheduled',history:[...(e.history||[]),{at:clock(),action:'status',startsAt:e.startsAt,deadline:e.deadline,...Object.fromEntries(['offerIssuedAt','offerReceivedAt','offerReplyDeadline','joiningAt'].map(key=>[key,e[key]||''])),from:e.status,to:input.status==='cancelled'?'cancelled':'scheduled'}]});}
      if(current.planId){const p=get('plans',current.planId);if(p.status!=='completed')update('plans',p,{status:input.status==='cancelled'?'cancelled':store.list('applications').some(a=>a.planId===p.id && a.status==='draft')?'filling':p.opportunityId?'planned':'awaiting_role'});}
      for(const r of store.list('reminders').filter(r=>r.taskId===current.id && r.status==='pending'))update('reminders',r,{status:'cancelled'});
      return saved;
    });
  }
  function calendar(month, zone='Asia/Shanghai', mode='completed') {
    date(`${month}-01`,true);timezone(zone);
    if(!['completed','planned'].includes(mode))throw Error('日历模式无效');
    return require('./calendar.cjs').buildCalendar(store,{month,zone,mode,now:clock(),dayOf});
  }
  function matchWithPreferences(o,prefs,facts){return matchOpportunity({...o,organization:[store.get('organizations',o.organizationId)?.name||'']},facts,prefs);}
  function previewPreferences(input){const prefs=validatePreferences(input),facts=profileService.read().profile;const opportunities=store.list('opportunities').map(o=>({id:o.id,title:o.title,organizationId:o.organizationId,match:matchWithPreferences(o,prefs,facts)}));const warnings=[];for(const p of prefs.plans){for(const [key,values]of Object.entries(p.conditions))if(values.length&&values.every(v=>(prefs.excluded[key]||[]).includes(v)))warnings.push(`${p.name} 的 ${key} 必须条件被全局排除项覆盖，请核对`);if(p.conditions.route?.every(r=>r!=='enterprise')&&p.conditions.route.length&&p.conditions.nature?.some(n=>['私企','国企','外企'].includes(n)))warnings.push(`${p.name} 同时限定非企业路线和企业性质，组合可能互斥`);}return {scope:'loaded_samples',warnings,total:opportunities.length,included:opportunities.filter(o=>o.match.included).length,excluded:opportunities.filter(o=>!o.match.included).length,opportunities};}
  function recommendations() {
    const prefs=store.get('preferences','main')||{plans:[]};const facts=profileService.read().profile;
    return store.list('opportunities').map(o=>applyFeedback({...o,match:matchWithPreferences(o,prefs,facts)},store.get('userOpportunities',`user-${o.id}`),clock()));
  }
  function note(input) {
    if(input.eventId)get('events',input.eventId);
    const old=input.id?get('notes',input.id):null;
    return store.put('notes',{...(old||{}),eventId:input.eventId||'',title:text(input.title,200),body:text(input.body,100000)},{expectedRevision:input.revision??0});
  }
  return {organization,opportunity,watch,preferences,previewPreferences,plan,collect,startApplication,confirmSubmission,applicationReference,bindAsset,event,task,completeTask,taskStatus,calendar,recommendations,note};
}
module.exports={createWorkflow,dayOf,date,timestamp,timezone,text,key};
