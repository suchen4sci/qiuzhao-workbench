'use strict';
const {dateAtHour}=require('./local-time.cjs');
const {createHash}=require('node:crypto');
const idFor=value=>'reminder-'+createHash('sha256').update(value).digest('hex').slice(0,32);
const defaults={enabled:true,native:false,digest:true,digestHour:9,digestEveryDays:1,interviewMinutes:60,deadlineMinutes:1440,plannedHour:9};
function localParts(date,zone){return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(date).map(x=>[x.type,x.value]));}
function createReminders(store,{clock=()=>new Date(),notify=async()=>({state:'unavailable'}),opportunityDigest}={}){
 let running=false,closed=false;
 const settings=()=>{const saved=store.get('settings','main');return {timezone:saved?.timezone||'Asia/Shanghai',...defaults,...saved?.reminders,...(store.get('preferences','main')?.notification?{digest:store.get('preferences','main').notification.enabled,digestHour:store.get('preferences','main').notification.hour}:{})};};
 const update=(record,patch)=>store.put('reminders',{...record,...patch},{expectedRevision:record.revision});
 function configure(input){
  const old=store.get('settings','main'),zone=input.timezone||old?.timezone||'Asia/Shanghai';
  try{new Intl.DateTimeFormat('en',{timeZone:zone});}catch{throw Error('时区无效');}
  for(const key of ['enabled','native','digest'])if(typeof input[key]!=='boolean')throw Error('提醒开关无效');
  for(const [key,max]of [['plannedHour',23],['digestHour',23],['interviewMinutes',10080],['deadlineMinutes',43200]])if(!Number.isInteger(input[key])||input[key]<0||input[key]>max)throw Error('提醒时间超出范围');
  const every=input.digestEveryDays??old?.reminders?.digestEveryDays??1;if(![1,7].includes(every))throw Error('摘要频率无效');
  const reminders={...Object.fromEntries(Object.keys(defaults).map(key=>[key,input[key]])),digestEveryDays:every};
  return store.transaction(()=>{const prefs=store.get('preferences','main');if(prefs)store.put('preferences',{...prefs,notification:{...prefs.notification,enabled:reminders.digest,hour:reminders.digestHour}},{expectedRevision:prefs.revision});return store.put('settings',{...old,id:'main',timezone:zone,reminders},old?{expectedRevision:old.revision}:{});});
 }
 function reconcile(now,config){
  const wanted=new Set(),issues=[];
  const dateFor=(day,task)=>{try{return dateAtHour(day,config.plannedHour,config.timezone);}catch{issues.push({taskId:task.id,title:task.title,day,reason:'该时区的日期无法安排，请修改任务日期'});return null;}};
  if(config.enabled)for(const task of store.list('tasks').filter(t=>t.status==='pending'&&t.reminderEnabled!==false)){
   const schedules=[];
   if(task.kind==='interview'&&task.startsAt)schedules.push({kind:'interview',target:task.startsAt,offset:config.interviewMinutes});
   if(task.dueAt&&task.dueAt!==task.startsAt)schedules.push({kind:'deadline',target:task.dueAt,offset:config.deadlineMinutes});
   if(!schedules.length&&task.dueAt)schedules.push({kind:'deadline',target:task.dueAt,offset:config.deadlineMinutes});
   if(task.plannedOn&&!schedules.length){const local=dateFor(task.plannedOn,task);if(local)schedules.push({kind:'planned',target:local.at,offset:0,timeBasis:'date_only_reminder_time',adjusted:local.adjusted});}
   const opportunity=task.opportunityId?store.get('opportunities',task.opportunityId):null;
   if(opportunity?.deadline){const local=dateFor(opportunity.deadline,task);if(local)schedules.push({kind:'deadline_date',target:local.at,offset:config.deadlineMinutes,timeBasis:'date_only_reminder_time',adjusted:local.adjusted});}
   for(const schedule of schedules){
    const {target,offset,kind}=schedule;if(!Number.isFinite(Date.parse(target)))continue;
    const dueAt=new Date(Date.parse(target)-offset*60000).toISOString();
    const legacy=store.list('reminders').filter(r=>r.taskId===task.id&&r.kind===kind&&r.targetAt===target&&r.dueAt===dueAt).sort((a,b)=>(b.status==='delivered')-(a.status==='delivered'))[0];
    const id=legacy?.id||idFor(JSON.stringify([task.id,target,offset,kind]));wanted.add(id);
    const prior=store.get('reminders',id);if(prior?.status==='cancelled'||(prior?.status==='pending'&&prior.title!==task.title))update(prior,{status:'pending',title:task.title,reason:''});
    if(!prior)store.put('reminders',{id,taskId:task.id,kind,title:task.title,targetAt:target,dueAt:new Date(Date.parse(target)-offset*60000).toISOString(),status:'pending',timeBasis:schedule.timeBasis||'exact',clockAdjusted:schedule.adjusted||false});
   }
  }
  for(const r of store.list('reminders').filter(r=>r.kind!=='digest'&&r.status==='pending'))if(!wanted.has(r.id))update(r,{status:'cancelled',reason:config.enabled?'schedule_changed':'disabled'});
  if(config.enabled&&config.digest){
   const parts=localParts(now,config.timezone),day=`${parts.year}-${parts.month}-${parts.day}`;
   for(const r of store.list('reminders').filter(r=>r.kind==='digest'&&r.status==='pending'&&r.day!==day))update(r,{status:'cancelled',reason:'replaced_by_current_digest'});
   const last=store.list('reminders').filter(r=>r.kind==='digest'&&r.status==='delivered').sort((a,b)=>b.deliveredAt.localeCompare(a.deliveredAt))[0];
   const lastParts=last?localParts(new Date(last.deliveredAt),config.timezone):null,lastDay=lastParts?`${lastParts.year}-${lastParts.month}-${lastParts.day}`:'';
   if(Number(parts.hour)>=config.digestHour&&(!lastDay||Date.parse(day)-Date.parse(lastDay)>=config.digestEveryDays*86400000)){
    const id=idFor('digest:'+config.timezone+':'+day);
    if(!store.get('reminders',id)){
     const tasks=store.list('tasks').filter(t=>t.status==='pending');
     const due=tasks.filter(t=>t.plannedOn===day||(t.dueAt&&Date.parse(t.dueAt)<=now.getTime()+86400000));
     const prepared=opportunityDigest?.prepare(now,config.timezone),digest=prepared?opportunityDigest.save(id,prepared):null;
     const opportunityText=digest?(digest.available?`机会 ${digest.opportunityCount} 个：新开放 ${digest.counts.new_open}、新发现在招 ${digest.counts.new_unknown_date}、存量补充 ${digest.counts.supplement}、开放待核实 ${digest.counts.verify}；新单位 ${digest.newOrganizations} 家、熟悉单位有新岗位 ${digest.familiarOrganizations} 家；关注变化 ${digest.counts.change} 项。`:digest.error+'。'):'';
     store.put('reminders',{id,opportunityDigest:digest,kind:'digest',title:'今日行动摘要',body:`${opportunityText}待办 ${tasks.length} 项，其中今日安排、逾期或未来 24 小时截止 ${due.length} 项。`,taskIds:due.map(t=>t.id),status:'pending',dueAt:now.toISOString(),day});
    }
   }
  }
  for(const r of store.list('reminders').filter(r=>r.kind==='digest'&&r.status==='pending'))if(!config.enabled||!config.digest)update(r,{status:'cancelled',reason:'disabled'});
  return issues;
 }
 async function tick(){
  if(closed)return {state:'closed'};
  if(running)return {state:'busy'};running=true;
  try{
   const now=clock(),config=settings(),issues=store.transaction(()=>reconcile(now,config));
   for(const r of store.list('reminders').filter(r=>r.status==='pending'&&Date.parse(r.dueAt)<=now.getTime())){
    // Persist the in-app delivery before the optional OS side effect. A crash never automatically repeats it.
    const sent=store.transaction(()=>{const sent=update(r,{status:'delivered',deliveredAt:now.toISOString(),late:Date.parse(r.dueAt)<now.getTime()-60000,native:config.native?'attempting':'disabled'});if(r.kind==='digest'&&r.opportunityDigest)opportunityDigest?.delivered(sent,now.toISOString());return sent;});
    if(config.native){
     let result;try{result=await notify({id:r.id,title:r.kind==='digest'?r.title:'招聘工作台提醒',body:r.body||`${r.title} · ${r.kind==='interview'?'面试安排':r.kind==='planned'?'计划安排':r.kind==='deadline_date'?'官网截止日期（具体时刻待核实）':'截止安排'}`,taskId:r.taskId});}catch{result={state:'failed'};}
     if(closed)return {state:'closed'};
     const latest=store.get('reminders',sent.id);if(latest)update(latest,{native:['requested','shown','failed','unavailable'].includes(result?.state)?result.state:'unavailable'});
    }
   }
   const old=store.get('settings','scheduler');store.put('settings',{...old,id:'scheduler',lastCheckAt:now.toISOString(),state:issues.length?'attention':'healthy',issues,mode:'local_app_running'},old?{expectedRevision:old.revision}:{});
   return {state:issues.length?'attention':'healthy',issues};
  }finally{running=false;}
 }
 function read(id){const r=store.get('reminders',id);if(!r||r.status!=='delivered')throw Error('提醒不存在或尚未触发');return update(r,{readAt:clock().toISOString()});}
 return {settings,configure,tick,read,close:()=>{closed=true;}};
}
module.exports={createReminders,localParts};
