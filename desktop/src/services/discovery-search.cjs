'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {validatePreferences,searchQueries,ROUTES}=require('./matching.cjs');
const routeTerms={enterprise:'招聘 岗位',civil:'公务员 招录 公告',public:'事业单位 招聘 公告',postgraduate:'研究生 招生 简章'};
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
// Broad retrieval is intentionally separate from the saved AND/OR matching rules.
// Each dimension is searched with its route; all other constraints remain for review.
function buildSearchPlan(raw){
 const prefs=validatePreferences(raw||{plans:[]}),expanded=searchQueries(prefs),groups=[];
 for(const card of prefs.plans){
  const routes=(card.conditions.route?.length?card.conditions.route:ROUTES).filter(r=>(!prefs.global.route?.length||prefs.global.route.includes(r))&&!prefs.excluded.route?.includes(r));
  const terms=expanded.filter(x=>x.planId===card.id&&x.dimension!=='route');
  for(const [dimension,tags] of Object.entries(prefs.global))if(dimension!=='route')for(const tag of tags)terms.push({dimension,terms:[tag]});
  const queries=[],routeGroups=[];
  for(const route of routes){
   const routeQueries=[];
   const base=routeTerms[route];
   if(!terms.length)routeQueries.push({planId:card.id,planName:card.name,route,dimension:'route',query:base});
   for(const item of terms)for(const term of (route==='postgraduate'&&item.dimension==='direction'?item.terms.slice(0,1):item.terms)){
    // Quoted literal terms cannot inject provider operators or extra query lines.
    const literal=term.normalize('NFKC').replace(/["\\\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim();
    if(literal)routeQueries.push({planId:card.id,planName:card.name,route,dimension:item.dimension,query:`${base} "${literal}"`});
   }
   routeGroups.push(routeQueries);
  }
  for(let i=0;routeGroups.some(g=>i<g.length);i++)for(const g of routeGroups)if(g[i])queries.push(g[i]);
  groups.push(queries);
 }
 // Round robin across cards prevents a large card starving the next card.
 const queries=[],seen=new Set();for(let i=0;groups.some(g=>i<g.length);i++)for(const g of groups){const q=g[i];if(!q)continue;const key=q.planId+'\0'+q.query;if(!seen.has(key)){seen.add(key);queries.push(q);}}
 return{signature:hash(prefs),queries,total:queries.length,coverage:'route_dimension_first_page',message:'按方案和方向别名轮流搜索，不限制发布日期，以包含仍开放的存量线索。每次仅第一页；其他必须条件、排除项、资格及开放状态需在原文核对，搜索命中不代表符合条件。'};
}
function createDiscoverySearch(store,search,{clock=Date.now,autoStart=true}={}){
 let closed=false,active=null,timer;
 const put=(collection,item)=>store.put(collection,item,{expectedRevision:store.get(collection,item.id)?.revision||0});
 const plan=()=>buildSearchPlan(store.get('preferences','main')||{plans:[]});
 const settings=()=>store.get('settings','discovery-search')||{enabled:false,budget:4,cursor:0,nextRunAt:0};
 for(const r of store.list('discoveryRuns').filter(r=>r.kind==='preference_search'&&r.status==='running'))put('discoveryRuns',{...r,status:'interrupted',completedAt:clock(),error:'上次每日搜索中断，未自动重发；供应商可能已计费'});
 function preview(){const p=plan(),s=settings(),cursor=s.signature===p.signature?(s.cursor||0)%Math.max(1,p.total):0;return{...p,queries:undefined,settings:s,requiresApproval:s.signature!==p.signature,busy:!!active,next:p.queries.slice(cursor,cursor+10),cursor};}
 function configure(input){
  if(closed)throw Error('工作区已关闭');if(typeof input.enabled!=='boolean')throw Error('请选择每日搜索状态');
  if(!Number.isInteger(input.budget)||input.budget<1||input.budget>10)throw Error('每日搜索预算须为 1–10 次');
  const p=plan(),old=settings();if(input.enabled){if(input.confirmed!==true||input.signature!==p.signature)throw Error('请核对当前偏好与查询范围，重新确认每日搜索费用');if(!p.total)throw Error('请先保存至少一个可检索的偏好方案');const c=search.config();if(!c.enabled||!c.hasKey)throw Error('请先开启搜索连接');}
  active?.abort();return put('settings',{...old,id:'discovery-search',enabled:input.enabled,budget:input.budget,signature:p.signature,cursor:old.signature===p.signature?old.cursor||0:0,nextRunAt:old.nextRunAt||0,approvedAt:input.enabled?clock():old.approvedAt||0});
 }
 async function tick(){
  if(closed||active)return;const s=settings(),p=plan();if(!s.enabled)return;
  if(s.signature!==p.signature){put('settings',{...s,enabled:false,error:'偏好已变化，请重新核对每日查询范围与预算'});return;}
  if(s.nextRunAt>clock())return;
  const c=search.config();if(!c.enabled||!c.hasKey)return;
  const controller=new AbortController();active=controller;const id='preference-search-'+randomUUID();
  try{
   // Reserve the cycle before network I/O. Restarts and manual checks do not replay costs.
   put('settings',{...s,nextRunAt:clock()+86400000,lastRunAt:clock(),error:''});
   put('discoveryRuns',{id,kind:'preference_search',status:'running',startedAt:clock(),signature:p.signature,coverage:p.coverage,totalQueries:p.total,attempts:0,results:0});
   const start=(s.cursor||0)%Math.max(1,p.total),count=Math.min(s.budget,p.total-start);let results=0;
   for(let index=0;index<count;index++){
    if(closed||controller.signal.aborted)break;
    if(plan().signature!==p.signature){controller.abort();put('settings',{...settings(),enabled:false,error:'偏好已变化，请重新核对每日查询范围与预算'});break;}
    const q=p.queries[start+index],requestId=randomUUID();
    put('discoveryRuns',{...store.get('discoveryRuns',id),attempts:index+1});
    // Advance before dispatch so an uncertain paid request is never silently replayed.
    put('settings',{...settings(),cursor:(start+index+1)%p.total});
    const result=await search.run({query:q.query,requestId,confirmed:true},{signal:controller.signal});
    if(closed||controller.signal.aborted)break;
    if(plan().signature!==p.signature){controller.abort();put('settings',{...settings(),enabled:false,error:'偏好已变化，请重新核对每日查询范围与预算'});break;}
    put('snapshots',{id:'discovery-result-'+requestId,kind:'preference_search_result',runId:id,...q,capturedAt:result.capturedAt,results:result.results,searchId:result.id,coverage:result.coverage});
    results+=result.results.length;put('discoveryRuns',{...store.get('discoveryRuns',id),results});
   }
   if(!closed)put('discoveryRuns',{...store.get('discoveryRuns',id),status:controller.signal.aborted?'cancelled':'ready',completedAt:clock()});
  }catch(error){if(!closed)put('discoveryRuns',{...store.get('discoveryRuns',id),status:controller.signal.aborted?'cancelled':'failed',completedAt:clock(),error:'本轮未全部完成；已保存收到的线索。供应商可能已计费，请核对连接和共享的 24 小时 20 次上限。'});}
  finally{if(active===controller)active=null;}
 }
 function results(){const found=new Map();for(const s of store.list('snapshots').filter(s=>s.kind==='preference_search_result'))for(const r of s.results){let item=found.get(r.url);if(!item){item={...r,firstDiscoveredAt:s.capturedAt,lastDiscoveredAt:s.capturedAt,evidence:[]};found.set(r.url,item);}if(s.capturedAt<item.firstDiscoveredAt)item.firstDiscoveredAt=s.capturedAt;if(s.capturedAt>item.lastDiscoveredAt){item.lastDiscoveredAt=s.capturedAt;item.title=r.title;item.description=r.description;}item.evidence.push({planId:s.planId,planName:s.planName,query:s.query,route:s.route,capturedAt:s.capturedAt,runId:s.runId});}return [...found.values()].sort((a,b)=>b.lastDiscoveredAt.localeCompare(a.lastDiscoveredAt));}
 function cancel(){active?.abort();return{cancelled:!!active};}
 function close(){if(closed)return;closed=true;clearInterval(timer);cancel();for(const r of store.list('discoveryRuns').filter(r=>r.kind==='preference_search'&&r.status==='running'))put('discoveryRuns',{...r,status:'interrupted',completedAt:clock()});}
 if(autoStart){timer=setInterval(()=>tick().catch(()=>{}),60000);timer.unref();queueMicrotask(()=>tick().catch(()=>{}));}
 return{preview,configure,tick,results,cancel,close};
}
module.exports={buildSearchPlan,createDiscoverySearch};
