'use strict';
const {createHash}=require('node:crypto');
const {fingerprint,opportunityFacts:facts}=require('./discovery.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const unitId=id=>'seen-unit-'+hash(id);
const categories={new_open:'新开放',new_unknown_date:'新发现在招',supplement:'存量补充',verify:'开放待核实',change:'关注变化'};
function localDay(date,zone){return new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
function classify(o,startDay,endDay){if(!o.statusVerified||!['open','rolling'].includes(o.openStatus)||o.openedOn>endDay)return 'verify';if(!o.openedOn)return 'new_unknown_date';return o.openedOn>=startDay?'new_open':'supplement';}
function createOpportunityDigest(store,recommendations,{clock=()=>new Date().toISOString()}={}){
 function userPatch(id,patch){const old=store.get('userOpportunities','user-'+id);return store.put('userOpportunities',{...old,id:'user-'+id,opportunityId:id,state:old?.state||'new',...patch},old?{expectedRevision:old.revision}:{});}
 function unitSeen(id,at){const key=unitId(id);if(!store.get('settings',key))store.put('settings',{id:key,kind:'seen_organization',organizationId:id,firstPresentedAt:at});}
 function presented(items){if(!Array.isArray(items)||items.length>200)throw Error('展示记录无效');return store.transaction(()=>{let recorded=0;const accepted=[];for(const item of items){const o=store.get('opportunities',item.id);if(!o||o.revision!==item.revision)continue;const u=store.get('userOpportunities','user-'+o.id);if(!u?.firstRenderedAt){userPatch(o.id,{firstRenderedAt:clock(),...(!u?.lastPresentedFingerprint?{lastPresentedFingerprint:fingerprint(o),lastPresentedFacts:facts(o)}:{})});recorded++;}unitSeen(o.organizationId,clock());accepted.push(o.id);}return {recorded,accepted};});}
 function prepare(now,zone){
  const previous=store.list('reminders').filter(r=>r.kind==='digest'&&r.status==='delivered'&&r.opportunityDigest?.available).sort((a,b)=>b.deliveredAt.localeCompare(a.deliveredAt))[0];
  const start=previous?.deliveredAt||new Date(now.getTime()-86400000).toISOString(),startDay=localDay(new Date(start),zone),endDay=localDay(now,zone);
  let opportunities;try{opportunities=recommendations();}catch{return {available:false,error:'个人资料或匹配信息无法读取，机会摘要未计算',items:[],windowStart:start};}
  const users=new Map(store.list('userOpportunities').map(u=>[u.opportunityId,u])),seenUnits=new Set(store.list('settings').filter(s=>s.kind==='seen_organization').map(s=>s.organizationId));
  const watched=new Set(store.list('watches').filter(w=>w.enabled).map(w=>w.organizationId));for(const id of watched)seenUnits.add(id);
  for(const o of opportunities)if(['saved','planned','applied'].includes(users.get(o.id)?.state))seenUnits.add(o.organizationId);
  const items=[],seen=new Set();for(const o of opportunities){if(seen.has(o.id))continue;seen.add(o.id);const u=users.get(o.id),fp=fingerprint(o),baseline=u?.lastPresentedFingerprint||u?.feedback?.fingerprint;
   if(watched.has(o.organizationId)&&baseline&&baseline!==fp){items.push({opportunityId:o.id,organizationId:o.organizationId,title:o.title,category:'change',fingerprint:fp,previousFingerprint:baseline,previousFacts:u?.lastPresentedFacts||null,currentFacts:facts(o),verified:o.statusVerified===true});continue;}
   if(o.match?.included===false||u?.firstDigestAt||u?.firstRenderedAt||['saved','planned','applied'].includes(u?.state)||u?.feedback?.kind==='seen')continue;
   items.push({opportunityId:o.id,organizationId:o.organizationId,title:o.title,category:classify(o,startDay,endDay),fingerprint:fp,currentFacts:facts(o),newOrganization:!seenUnits.has(o.organizationId)});
  }
  const counts=Object.fromEntries(Object.keys(categories).map(k=>[k,items.filter(i=>i.category===k).length])),newUnits=new Set(items.filter(i=>i.category!=='change'&&i.newOrganization).map(i=>i.organizationId)),familiarUnits=new Set(items.filter(i=>i.category!=='change'&&!i.newOrganization).map(i=>i.organizationId));
  return {available:true,items,counts,newOrganizations:newUnits.size,familiarOrganizations:familiarUnits.size,opportunityCount:items.filter(i=>i.category!=='change').length,windowStart:start};
 }
 function save(reminderId,prepared){const {items,...summary}=prepared;for(let i=0;i<items.length;i+=100)store.put('settings',{id:'digest-items-'+hash(reminderId)+':'+i/100,kind:'opportunity_digest_items',reminderId,index:i/100,items:items.slice(i,i+100)});return {...summary,chunkCount:Math.ceil(items.length/100)};}
 function entries(reminderId){return store.list('settings').filter(s=>s.kind==='opportunity_digest_items'&&s.reminderId===reminderId).sort((a,b)=>a.index-b.index).flatMap(s=>s.items);}
 function delivered(reminder,at){for(const item of entries(reminder.id)){if(!store.get('opportunities',item.opportunityId))continue;const u=store.get('userOpportunities','user-'+item.opportunityId);userPatch(item.opportunityId,item.category==='change'?{lastChangeDigestFingerprint:item.fingerprint,lastPresentedFingerprint:item.fingerprint,lastPresentedFacts:item.currentFacts}:{firstDigestAt:u?.firstDigestAt||at,...(!u?.lastPresentedFingerprint?{lastPresentedFingerprint:item.fingerprint,lastPresentedFacts:item.currentFacts}:{})});unitSeen(item.organizationId,at);}}
 function detail(id){const r=store.get('reminders',id);if(!r||r.kind!=='digest'||r.status!=='delivered')throw Error('摘要尚未送达');return {summary:r.opportunityDigest,items:entries(id)};}
 return {prepare,save,delivered,presented,detail};
}
module.exports={createOpportunityDigest,classify,categories};
