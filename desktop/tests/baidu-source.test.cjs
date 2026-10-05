'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {extractBaidu,initialData}=require('../src/services/source-adapters/baidu.cjs');
const {openStore}=require('../src/services/store.cjs'),{createWorkflow}=require('../src/services/workflow.cjs'),{createSources}=require('../src/services/sources.cjs');
const id='11111111-1111-4111-8111-111111111111',listUrl='https://talent.baidu.com/jobs/list?recruitType=GRADUATE',detailUrl=`https://talent.baidu.com/jobs/detail/GRADUATE/${id}`;
const post={postId:id,name:'示例研发工程师',workPlace:'上海市,北京市,上海市',workContent:'研发系统',serviceCondition:'按公告核对专业',publishDate:'2026-07-21',updateDate:'2026-09-24',projectType:'校招',postType:'技术'};
const list=(posts=[post])=>({listData:{recruitType:'GRADUATE',listDetailData:posts,pageNum:1,pageSize:10,total:159}});
const html=data=>`<html><script>window.__INITIAL_DATA__ = ${JSON.stringify(data)};</script></html>`;
test('official list is one page of proposals, with separate publication dates and normalized cities',()=>{
 const r=extractBaidu(html(list()),listUrl);assert.equal(r.adapter,'baidu-ssr-v1');assert.equal(r.coverage.reportedTotal,159);assert.equal(r.coverage.paginationComplete,false);assert.equal(r.jobs.length,1);const j=r.jobs[0];assert.deepEqual(j.city,['上海市','北京市']);assert.equal(j.company,'百度');assert.equal(j.url,detailUrl);assert.equal(j.openedOn,'');assert.equal(j.deadline,'');assert.equal(j.evidenceFacts.openStatus,'unknown');assert.equal(j.evidenceFacts.sourcePublishedOn,'2026-07-21');assert.equal(j.evidenceFacts.sourceUpdatedOn,'2026-09-24');
});
test('official detail binds its identity and keeps valid/invalid flags separate from open state',()=>{
 for(const valid of [true,false]){const data={detailData:{postInfo:post,recruitType:'GRADUATE',isValid:valid},...list([{...post,name:'无关列表岗位'}])};const r=extractBaidu(html(data),detailUrl);assert.equal(r.jobs[0].title,post.name);assert.equal(r.coverage.validityReported,valid);assert.equal(r.jobs[0].evidenceFacts.pageValidityReported,valid);assert.equal(r.jobs[0].evidenceFacts.openStatus,'unknown');}
 const data={detailData:{postInfo:post,recruitType:'INTERN',isValid:true}};assert.throws(()=>extractBaidu(html(data),detailUrl),/不一致/);data.detailData.recruitType='GRADUATE';data.detailData.postInfo={...post,postId:'22222222-2222-4222-8222-222222222222'};assert.throws(()=>extractBaidu(html(data),detailUrl),/不一致/);
});
test('parser does not execute JavaScript and accepts undefined only outside strings',()=>{
 const source=html(list()).replace('"total":159','"absent":undefined,"literal":"undefined } \\"quoted\\"","total":159');const parsed=initialData(source);assert.equal(parsed.listData.absent,null);assert.equal(parsed.listData.literal,'undefined } "quoted"');
 globalThis.baiduAdapterExecuted=false;assert.throws(()=>initialData('<script>window.__INITIAL_DATA__ = {"x":(globalThis.baiduAdapterExecuted=true)};</script>'),/安全解析/);assert.equal(globalThis.baiduAdapterExecuted,false);delete globalThis.baiduAdapterExecuted;
 for(const body of ['<script>window.__INITIAL_DATA__ = {};</script><script>window.__INITIAL_DATA__ = {};</script>','<script>window.__INITIAL_DATA__ = {}; window.__INITIAL_DATA__ = {};</script>','<script>window.__INITIAL_DATA__ = {</script>','x'.repeat(1024*1024+1)])assert.throws(()=>initialData(body));
});
test('foreign hosts use generic extraction; invalid structure, duplicate IDs, mismatched routes fail visibly',()=>{
 for(const url of ['https://talent.baidu.com.evil.example/jobs/list','https://example.com/jobs/list','https://talent.baidu.com/jobs/social-list'])assert.equal(extractBaidu(html(list()),url),null);
 for(const data of [{},list([post,post]),{listData:{...list().listData,pageSize:101}},{listData:{...list().listData,total:0}},{listData:{...list().listData,recruitType:'SOCIAL'}},list([{...post,postId:'unreliable'}])])assert.throws(()=>extractBaidu(html(data),listUrl));
 assert.throws(()=>extractBaidu(html(list()),listUrl.replace('GRADUATE','INTERN')),/不一致/);
 const j=extractBaidu(html(list([{...post,publishDate:'2026-02-30',updateDate:'昨天'}])),listUrl).jobs[0];assert.equal(j.evidenceFacts.sourcePublishedOn,'');assert.equal(j.evidenceFacts.sourceUpdatedOn,'');
 assert.equal(extractBaidu(html(list([])),listUrl).jobs.length,0);
});
test('unrelated page changes do not create duplicates; changes retain review and manual plan protection',async t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'baidu-source-')),store=openStore(root),wf=createWorkflow(store,{read:()=>({profile:{values:{}}})});let body=html(list());const sources=createSources(store,wf,{autoStart:false,reader:async url=>({url,body})});t.after(()=>{sources.close();store.close();fs.rmSync(root,{recursive:true,force:true});});
 const first=await sources.preview({url:listUrl});assert.equal(first.pageCoverage.reportedTotal,159);assert.equal(store.list('opportunities').length,0);const c=store.get('confirmations',first.candidates[0].id);let o=sources.confirm({id:c.id,revision:c.revision,company:'百度',batch:'人工核对的2027校招',confirmed:true});assert.equal(o.openStatus,'unknown');assert.equal(o.openedOn,'');o=wf.opportunity({...o,route:'enterprise',description:'人工补充',statusVerified:true,openStatus:'open',evidence:'人工核验'});const plan=wf.plan({organizationId:o.organizationId,opportunityId:o.id,plannedOn:'2026-10-08'});
 body=body.replace('</html>','<script>window.unrelated=123;</script></html>');const repeated=await sources.preview({url:listUrl});assert.equal(repeated.candidates[0].id,c.id);assert.equal(store.list('confirmations').length,1);assert.equal(store.list('evidence').length,2);
 body=html(list([{...post,workContent:'新的职责'}]));const updated=await sources.preview({url:listUrl}),next=store.get('confirmations',updated.candidates[0].id),input={id:next.id,revision:next.revision,company:'百度',batch:o.batch,confirmed:true},review=sources.review(input);assert.equal(review.kind,'update');assert(review.changes.some(x=>x.key==='description'));const kept=sources.confirm({...input,targetOpportunityId:o.id,opportunityRevision:review.opportunityRevision,updateFields:[],resetVerification:false});assert.equal(kept.description,'人工补充');assert.equal(kept.statusVerified,true);assert.equal(store.get('plans',plan.id).plannedOn,'2026-10-08');
 body='<html>结构变化</html>';await assert.rejects(()=>sources.preview({url:listUrl}),/结构/);assert.equal(store.list('sources')[0].status,'failed');assert.equal(store.get('opportunities',o.id).openStatus,'open');
});
