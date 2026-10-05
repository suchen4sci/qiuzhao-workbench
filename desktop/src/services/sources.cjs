'use strict';
const {createHash,randomUUID}=require('node:crypto');
const {publicUrl,publicLink,readPublicPage}=require('./public-page.cjs');
const {extractBaidu}=require('./source-adapters/baidu.cjs');
const hash=s=>createHash('sha256').update(s).digest('hex');
const str=(v,max=10000)=>typeof v==='string'?v.trim().slice(0,max):'';
const plain=v=>str(v,100000).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
function date(v){if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$)/.test(v)||!Number.isFinite(Date.parse(v)))return '';const d=v.slice(0,10);return Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d?d:'';}
function extractJobs(body,url){
  if(typeof body!=='string'||Buffer.byteLength(body)>1024*1024)throw Error('来源正文过大');
  const roots=[];try{roots.push(JSON.parse(body));}catch{}
  for(const match of body.matchAll(/<script\b[^>]*\btype\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)){try{roots.push(JSON.parse(match[1]));}catch{}}
  const stack=[...roots],jobs=[],seen=new Set();let visited=0;
  while(stack.length){if(++visited>10000)throw Error('来源结构过于复杂');const v=stack.pop();if(!v||typeof v!=='object')continue;if(Array.isArray(v)){stack.push(...v);continue;}
    const types=Array.isArray(v['@type'])?v['@type']:[v['@type']];
    if(types.some(t=>['JobPosting','https://schema.org/JobPosting','http://schema.org/JobPosting'].includes(t))){
      const title=plain(v.title).slice(0,200);if(!title)continue;
      let target=url;try{if(typeof v.url==='string'&&v.url.trim())target=publicLink(new URL(v.url,url).href);}catch{}
      const company=str(v.hiringOrganization?.name,150),externalId=str(typeof v.identifier==='object'?v.identifier?.value:v.identifier,160);
      const locations=(Array.isArray(v.jobLocation)?v.jobLocation:[v.jobLocation]).map(l=>str(l?.address?.addressLocality,120)).filter(Boolean);
      const item={title,company,externalId,url:target,city:[...new Set(locations)].sort().slice(0,40),description:plain(v.description),openedOn:date(v.datePosted),deadline:date(v.validThrough),employmentType:str(v.employmentType,120)};
      const identity=hash(JSON.stringify(item));if(!seen.has(identity)){seen.add(identity);jobs.push(item);}if(jobs.length>100)throw Error('页面超过 100 个岗位，请缩小读取范围');
    }else for(const key of ['@graph','itemListElement','item','mainEntity'])if(v[key])stack.push(v[key]);
  }
  return jobs;
}
function extractSource(body,url){return extractBaidu(body,url)||{adapter:'json-ld',jobs:extractJobs(body,url),coverage:{mode:'single_page',paginationComplete:false}};}
function createSources(store,workflow,{reader=readPublicPage,clock=()=>new Date().toISOString(),autoStart=true}={}){
  let closed=false,ticking=false,timer;const active=new Map(),DAY=86400000;
  const put=(collection,item)=>store.put(collection,item,{expectedRevision:store.get(collection,item.id)?.revision||0});
  for(const s of store.list('sources').filter(s=>s.status==='checking'))put('sources',{...s,status:'interrupted',error:'上次读取未完成，可重新读取'});
  for(const r of store.list('discoveryRuns').filter(r=>r.status==='running'))put('discoveryRuns',{...r,status:'interrupted',completedAt:clock()});
  async function preview(input){
    if(closed)throw Error('工作区已关闭');const url=publicUrl(input.url).href,id=`source-${hash(url).slice(0,40)}`;
    if(active.has(id))throw Error('此来源正在读取');const controller=new AbortController();active.set(id,controller);
    const old=store.get('sources',id),runId=`discovery-${randomUUID()}`;
    put('sources',{...old,id,url,status:'checking',mode:'user_link',lastAttemptAt:clock(),nextCheckAt:new Date(Date.parse(clock())+DAY).toISOString(),coverage:'single_page'});
    put('discoveryRuns',{id:runId,sourceId:id,status:'running',startedAt:clock(),coverage:'single_page',pages:0});
    try{
      const page=await reader(url,{signal:controller.signal});if(closed||controller.signal.aborted)throw Error('读取已取消');
      const adapted=extractSource(page.body,page.url),jobs=adapted.jobs,contentHash=hash(page.body),evidenceId=`source-evidence-${hash(url+'\0'+contentHash).slice(0,40)}`;
      return store.transaction(()=>{
        if(!store.get('evidence',evidenceId))store.put('evidence',{id:evidenceId,kind:'public_page',sourceId:id,url:page.url,capturedAt:clock(),contentHash,body:page.body});
        let legacyJobs=[];if(old?.evidenceId&&!Array.isArray(old.proposalIds)){const priorEvidence=store.get('evidence',old.evidenceId);if(priorEvidence)try{legacyJobs=extractSource(priorEvidence.body,priorEvidence.url).jobs.map(job=>JSON.stringify(job));}catch{}}
        const previous=Array.isArray(old?.proposalIds)?old.proposalIds.map(id=>store.get('confirmations',id)).filter(Boolean):store.list('confirmations').filter(c=>c.kind==='source_opportunity'&&c.sourceId===id&&legacyJobs.includes(JSON.stringify(c.proposal)));
        const proposals=jobs.map(job=>{const existing=previous.find(c=>JSON.stringify(c.proposal)===JSON.stringify(job)&&['pending','accepted'].includes(c.status));if(existing)return existing;const cid=`source-proposal-${hash(id+'\0'+runId+'\0'+JSON.stringify(job)).slice(0,40)}`;return store.put('confirmations',{id:cid,kind:'source_opportunity',sourceId:id,evidenceId,status:'pending',proposal:job});});
        const kept=new Set(proposals.map(c=>c.id));for(const c of store.list('confirmations').filter(c=>c.kind==='source_opportunity'&&c.sourceId===id&&c.status==='pending'&&!kept.has(c.id)))put('confirmations',{...c,status:'superseded',reason:'来源已有更新，请核对最新草稿'});
        put('sources',{...store.get('sources',id),status:jobs.length?'needs_review':'manual_required',lastSuccessAt:clock(),error:'',candidateCount:jobs.length,adapter:adapted?.adapter||'json-ld',pageCoverage:adapted?.coverage||{mode:'single_page',paginationComplete:false},evidenceId,proposalIds:proposals.map(c=>c.id)});
        put('discoveryRuns',{id:runId,sourceId:id,startedAt:store.get('sources',id).lastAttemptAt,completedAt:clock(),status:'success',pages:1,candidates:jobs.length,adapter:adapted?.adapter||'json-ld',pageCoverage:adapted?.coverage||null,coverage:adapted?.coverage.mode||'single_page',paginationComplete:false});
        return {sourceId:id,adapter:adapted?.adapter||'json-ld',pageCoverage:adapted?.coverage||null,candidates:proposals.map(({id,status,proposal})=>({id,status,proposal})),message:jobs.length?'请核对单位、批次和原文后导入；开放状态仍待核实':'未读取到结构化岗位，可在浏览器核验后手动添加；这不表示停止招聘'};
      });
    }catch(error){if(!closed){put('sources',{...store.get('sources',id),status:controller.signal.aborted?'interrupted':'failed',error:str(error.message,500)});put('discoveryRuns',{id:runId,sourceId:id,status:controller.signal.aborted?'interrupted':'failed',completedAt:clock(),error:str(error.message,500),pages:0,coverage:'single_page'});}throw error;}finally{active.delete(id);}
  }
  const sourceFields=['title','city','description','url','openedOn','deadline'];
  function review(input){
    const c=store.get('confirmations',input.id);if(!c||c.kind!=='source_opportunity')throw Error('来源草稿不存在');
    if(c.status==='superseded')throw Error('来源已有更新，请核对最新草稿');
    if(input.revision!==c.revision)throw Error('草稿已变化，请重新核对');
    const company=str(input.company,150),batch=str(input.batch,120);if(!company||!batch)throw Error('请填写单位和招聘批次，未知时请先核对官网');
    const organization=store.list('organizations').find(o=>o.name===company&&o.type==='enterprise'),p=c.proposal;
    const available=store.list('opportunities').filter(o=>o.organizationId===organization?.id&&o.batch===batch);
    const linked=new Set(store.list('confirmations').filter(old=>old.kind==='source_opportunity'&&old.sourceId===c.sourceId&&old.status==='accepted'&&(p.externalId?old.proposal.externalId===p.externalId:!old.proposal.externalId&&old.proposal.url===p.url&&old.proposal.title===p.title)).map(old=>old.opportunityId));
    let candidates=available.filter(o=>linked.has(o.id)||(p.externalId?o.externalId===p.externalId:!o.externalId&&o.url===p.url&&o.title===p.title));
    let weakIdentity=!p.externalId;
    if(!candidates.length&&!p.externalId){weakIdentity=true;const sameUrl=new Set(store.list('confirmations').filter(old=>old.kind==='source_opportunity'&&old.sourceId===c.sourceId&&old.status==='accepted'&&!old.proposal.externalId&&old.proposal.url===p.url).map(old=>old.opportunityId));candidates=available.filter(o=>sameUrl.has(o.id)||(!o.externalId&&o.url===p.url));}
    let existing=input.targetOpportunityId?available.find(o=>o.id===input.targetOpportunityId):!weakIdentity&&candidates.length===1?candidates[0]:null;
    if(input.targetOpportunityId&&!existing)throw Error('指定岗位不属于已核对的单位和批次');
    if(candidates.length&&!existing&&(!weakIdentity||input.createNew!==true))return {kind:'choose',allowCreate:weakIdentity,candidates:candidates.map(o=>({id:o.id,title:o.title,city:o.city,revision:o.revision})),message:'多个已有岗位可能对应此草稿，请选择并核对差异'};
    if(!existing)return {kind:'create',proposal:p};
    const changes=sourceFields.filter(key=>JSON.stringify(existing[key]??'')!==JSON.stringify(p[key]??'')).map(key=>({key,before:existing[key]??'',after:p[key]??''}));
    return {kind:'update',opportunityId:existing.id,opportunityRevision:existing.revision,title:existing.title,changes,openStatus:existing.openStatus,statusVerified:existing.statusVerified};
  }
  function confirm(input){
    const c=store.get('confirmations',input.id);if(!c||c.kind!=='source_opportunity')throw Error('来源草稿不存在');if(c.status==='accepted')return store.get('opportunities',c.opportunityId);
    if(input.confirmed!==true)throw Error('请核对原文、单位和批次');
    const reviewed=review(input);if(reviewed.kind==='choose')throw Error('请先选择对应岗位并核对差异');
    const p=c.proposal,e=store.get('evidence',c.evidenceId);if(!e)throw Error('来源证据不存在');
    return store.transaction(()=>{
      let result;
      if(reviewed.kind==='update'){
        if(input.opportunityRevision!==reviewed.opportunityRevision||input.targetOpportunityId!==reviewed.opportunityId)throw Error('请先预览已有岗位差异；岗位可能已经更新');
        if(!Array.isArray(input.updateFields)||input.updateFields.some(key=>!reviewed.changes.some(change=>change.key===key))||new Set(input.updateFields).size!==input.updateFields.length)throw Error('请选择预览中的更新字段，或明确保留原记录');
        if(typeof input.resetVerification!=='boolean')throw Error('请明确是否重新核验开放状态');
        const old=store.get('opportunities',reviewed.opportunityId),patch=Object.fromEntries(input.updateFields.map(key=>[key,p[key]??'']));
        if(input.updateFields.length||input.resetVerification){
          if(input.resetVerification){patch.openStatus='unknown';patch.statusVerified=false;}
          const snapshot=store.put('snapshots',{id:'source-update-'+randomUUID(),kind:'source_update',opportunityId:old.id,confirmationId:c.id,evidenceId:e.id,previous:old,patch,reviewedAt:clock()});
          result=store.put('opportunities',{...old,...patch,lastSourceReview:{snapshotId:snapshot.id,evidenceId:e.id,reviewedAt:clock()}},{expectedRevision:input.opportunityRevision});
        }else result=old;
      }else{
        const company=str(input.company,150),batch=str(input.batch,120),organization=store.list('organizations').find(o=>o.name===company&&o.type==='enterprise')||workflow.organization({name:company});
        const id=`opp-source-${hash(JSON.stringify([organization.id,p.externalId||[p.url,p.title],batch,[...p.city].sort()])).slice(0,40)}`;
        if(store.get('opportunities',id))throw Error('已存在对应岗位，请刷新后核对差异');
        result=workflow.opportunity({...p,id,organizationId:organization.id,batch,openStatus:'unknown',statusVerified:false,evidence:`${e.url}\n读取于 ${e.capturedAt}\n正文 SHA256 ${e.contentHash}`,evidenceSource:'user_confirmed_source'});
      }
      put('confirmations',{...c,status:'accepted',opportunityId:result.id,acceptedAt:clock(),resolution:reviewed.kind==='create'?'created':input.updateFields.length||input.resetVerification?'updated':'kept_existing',updatedFields:input.updateFields||[]});
      return result;
    });
  }
  function configure(input){
    if(closed)throw Error('工作区已关闭');const source=store.get('sources',input.id);if(!source)throw Error('请先读取公开链接');if(source.revision!==input.revision)throw Error('来源已变化，请刷新');if(typeof input.enabled!=='boolean')throw Error('请选择定期检查状态');
    if(input.enabled&&input.confirmed!==true)throw Error('请确认此公开页的每日读取范围');if(input.enabled&&!source.enabled&&store.list('sources').filter(s=>s.enabled).length>=20)throw Error('本机最多启用 20 个公开页的每日检查');
    const organizationId=input.organizationId||'';if(organizationId&&!store.get('organizations',organizationId))throw Error('关联单位不存在');if(!input.enabled)active.get(source.id)?.abort();
    return put('sources',{...source,enabled:input.enabled,organizationId,nextCheckAt:source.nextCheckAt||clock()});
  }
  async function tick(){
    if(closed||ticking)return;ticking=true;try{
      put('settings',{id:'source-scheduler',lastCheckAt:clock(),mode:'app_running',coverage:'selected_public_pages'});
      const due=store.list('sources').filter(s=>s.enabled&&(!s.nextCheckAt||s.nextCheckAt<=clock())).sort((a,b)=>(a.nextCheckAt||'').localeCompare(b.nextCheckAt||'')).slice(0,20);
      for(const source of due){if(closed)break;const current=store.get('sources',source.id);if(!current?.enabled||active.has(source.id)||current.nextCheckAt>clock())continue;try{await preview({url:current.url});}catch{}}
    }finally{ticking=false;}
  }
  if(autoStart){timer=setInterval(()=>tick().catch(()=>{}),60000);timer.unref();queueMicrotask(()=>tick().catch(()=>{}));}
  function evidence(id){const e=store.get('evidence',id);if(!e||e.kind!=='public_page')throw Error('来源证据不存在');return e;}
  return {preview,review,confirm,configure,tick,evidence,close(){if(closed)return;closed=true;clearInterval(timer);for(const [id,c] of active){c.abort();const s=store.get('sources',id);if(s?.status==='checking')put('sources',{...s,status:'interrupted',error:'工作区关闭，读取中断，可重新读取'});for(const r of store.list('discoveryRuns').filter(r=>r.sourceId===id&&r.status==='running'))put('discoveryRuns',{...r,status:'interrupted',completedAt:clock()});}}};
}
module.exports={createSources,extractJobs,extractSource};
