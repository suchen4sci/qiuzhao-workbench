'use strict';
// Calendar describes recorded evidence. A successful mailbox poll is not proof of a fully covered day.
function buildCalendar(store,{month,zone,mode,now,dayOf}){
 const tasks=store.list('tasks'),events=store.list('events'),activities=store.list('activities').filter(a=>!a.revoked),details={},cells={},coverage={};
 const dateOf=value=>value&&Number.isFinite(Date.parse(value))?dayOf(value,zone):'';
 const scheduled=(item,event=false,offer=false)=>offer?dateOf(item.offerReplyDeadline||item.deadline||item.dueAt):event?(dateOf(item.startsAt)||dateOf(item.deadline||item.dueAt)):(item.plannedOn||dateOf(item.dueAt));
 const row=d=>details[d]||(details[d]={planned:[],completed:[],changes:[]});
 const inMonth=d=>d&&d.slice(0,7)===month;
 for(const task of tasks){const d=scheduled(task,task.origin==='event',task.kind==='offer');if(inMonth(d)){row(d).planned.push(task);if(mode==='planned'&&task.status!=='cancelled')cells[d]=(cells[d]||0)+1;}}
 for(const activity of activities){const d=dateOf(activity.completedAt);if(inMonth(d)){row(d).completed.push(activity);if(mode==='completed')cells[d]=(cells[d]||0)+1;}}
 for(const item of [...events,...tasks.filter(t=>t.origin!=='event')]){
  const isEvent=events.includes(item),history=item.history||[];
  for(let index=0;index<history.length;index++){
   const h=history[index];if(!['reschedule','status'].includes(h.action))continue;
   const from=scheduled(h,isEvent,item.type==='offer'),later=history.slice(index+1).find(x=>x.action==='reschedule'),destination=h.toSchedule||later||item,to=scheduled(destination,isEvent,item.type==='offer');
   const scheduleValue=x=>JSON.stringify(isEvent?[x.startsAt||'',x.endsAt||'',x.deadline||x.dueAt||'',x.offerReplyDeadline||'']:[x.plannedOn||'',x.dueAt||'']);
   if(!inMonth(from)||h.action==='reschedule'&&scheduleValue(h)===scheduleValue(destination))continue;
   row(from).changes.push({id:`${item.id}:${index}`,taskId:isEvent?tasks.find(t=>t.eventId===item.id)?.id:item.id,eventId:isEvent?item.id:'',title:h.title||item.title,organizationId:item.organizationId,action:h.action,from,to,at:h.at,source:h.source||item.source||item.origin||'manual',evidenceId:h.evidenceId||'',status:h.to||'',original:h,destination});
  }
 }
 const runs=store.list('syncRuns').filter(r=>r.kind==='mail'),lastDay=new Date(`${month}-01T12:00:00Z`);lastDay.setUTCMonth(lastDay.getUTCMonth()+1);lastDay.setUTCDate(0);const today=dayOf(now,zone);
 for(let n=1;n<=lastDay.getUTCDate();n++){const d=`${month}-${String(n).padStart(2,'0')}`,dayRuns=runs.filter(r=>dateOf(r.finishedAt||r.startedAt)===d),failed=dayRuns.some(r=>['failed','interrupted'].includes(r.status)),recorded=!!details[d];coverage[d]={status:failed?'sync_failed':recorded?'partial':d>today?'future':'unknown',label:failed?'同步未完成，仅展示已有记录':recorded?'已有部分记录，未核验全天覆盖':d>today?'尚无已记录安排':'未覆盖，不能认定为零行动',sources:[...new Set([...(details[d]?.completed||[]).map(a=>a.source||'manual'),...(details[d]?.planned||[]).map(t=>t.origin||'manual')])],syncChecks:dayRuns.map(r=>({id:r.id,status:r.status,at:r.finishedAt||r.startedAt,hasMore:!!r.hasMore}))};}
 const dates=activities.map(a=>dateOf(a.completedAt)).filter(Boolean).sort(),first=dates[0];
 return{month,mode,cells,details,dayCoverage:coverage,completed:dates.filter(d=>inMonth(d)).length,activeDays:new Set(dates.filter(d=>inMonth(d))).size,elapsedDays:first?Math.floor((Date.parse(today)-Date.parse(first))/86400000)+1:0,coverage:'recorded_only'};
}
module.exports={buildCalendar};
