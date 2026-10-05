const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createResumeAI}=require('../src/services/resume-ai.cjs');
const {createProfileService}=require('../src/services/profile-service.cjs');
function fixture(t,invoke){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'resume-review-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'知识库'));fs.writeFileSync(path.join(dir,'知识库/profile.json'),JSON.stringify({schemaVersion:1,demo:false,values:{basic:[{name:'旧姓名'}],projects:[{name:'旧项目'}]}}));
 const records=new Map(),store={list:c=>[...records.entries()].filter(([key])=>key.startsWith(c+'/')).map(([,v])=>v),get:(c,id)=>records.get(`${c}/${id}`),put:(c,v)=>{const r={...v,revision:(records.get(`${c}/${v.id}`)?.revision||0)+1};records.set(`${c}/${v.id}`,r);return r;}};
 store.put('assets',{id:'a',text:'甲项目 乙项目 乙详情 新姓名',pages:[{page:1,text:'甲项目 乙项目 乙详情 新姓名',sourceLabel:'段落 1（非页码）'}]});
 const facts=createProfileService(dir),assets={file(){},images:async()=>[{page:1,image:'x'}],recordOCR(){throw Error('must not record invalid OCR');}};
 return {facts,records,store,assets,service:createResumeAI(store,facts,assets,{read:()=>({enabled:true})},{invoke})};
}
const proposal=(group,index,key,value)=>({group,index,key,value,page:1,quote:'甲项目 乙项目 乙详情 新姓名'});
test('review: selectively adopt later records with all their fields and preserve untouched records',async t=>{
 const {service,facts}=fixture(t,async()=>({changes:[proposal('projects',1,'name','甲项目'),proposal('projects',2,'name','乙项目'),proposal('projects',2,'description','乙详情')]}));
 const job=await service.run({assetId:'a',kind:'structure',confirmed:true});
 service.adopt({jobId:job.id,ids:['change-2','change-1']});
 assert.deepEqual(facts.read().profile.values.projects,[{name:'旧项目'},{description:'乙详情',name:'乙项目'}]);
 assert.equal(facts.history().length,1);
});
test('review: intervening profile edits reject entire adoption without mutation',async t=>{
 const {service,facts}=fixture(t,async()=>({changes:[proposal('basic',0,'name','新姓名'),proposal('projects',1,'name','甲项目')]}));
 const job=await service.run({assetId:'a',kind:'structure',confirmed:true}),before=facts.read();
 before.profile.values.basic[0].name='用户已编辑';const edited=facts.save(before.profile,before.hash);
 assert.throws(()=>service.adopt({jobId:job.id,ids:['change-0','change-1']}),/已变化/);
 assert.equal(facts.read().hash,edited.hash);
});
test('review: unconfirmed jobs never call provider; failed provider preserves facts',async t=>{
 let calls=0;const {service,facts,records}=fixture(t,async()=>{calls++;throw Error('provider failed');}),before=facts.read();
 await assert.rejects(service.run({assetId:'a',kind:'structure',confirmed:false}),/确认/);assert.equal(calls,0);
 await assert.rejects(service.run({assetId:'a',kind:'structure',confirmed:true}),/provider failed/);
 assert.equal(facts.read().hash,before.hash);assert.equal([...records.values()].find(x=>x.kind==='resume-structure').status,'failed');
});
test('review: OCR rejects repeated page identifiers before recording',async t=>{
 const {service,facts}=fixture(t,async()=>({pages:[{page:1,text:'a'},{page:1,text:'b'}]})),before=facts.read();
 await assert.rejects(service.run({assetId:'a',kind:'ocr',confirmed:true}),/页码/);assert.equal(facts.read().hash,before.hash);
});
test('review: cancel rejects a late provider result and never writes profile',async t=>{
 let finish;const {service,facts,records}=fixture(t,()=>new Promise(resolve=>{finish=resolve;})),before=facts.read();
 const requestId='11111111-1111-4111-8111-111111111111';
 const pending=service.run({assetId:'a',kind:'structure',confirmed:true,requestId});
 assert.equal(service.cancel(requestId),true);
 finish({changes:[proposal('basic',0,'name','新姓名')]});
 await assert.rejects(pending,/取消/);
 assert.equal(records.get(`aiJobs/${requestId}`).status,'cancelled');assert.equal(facts.read().hash,before.hash);
});
test('review: identical request IDs do not call provider twice',async t=>{
 let calls=0;const {service}=fixture(t,async()=>{calls++;return {changes:[]};});
 const input={assetId:'a',kind:'structure',confirmed:true,requestId:'22222222-2222-4222-8222-222222222222'};
 const first=await service.run(input),again=await service.run(input);
 assert.equal(again.id,first.id);assert.equal(again.status,'ready');assert.equal(calls,1);
});
test('review: restart preserves ready proposals and marks interrupted jobs without provider calls',async t=>{
 const {service,store,facts,assets}=fixture(t,async()=>({changes:[proposal('basic',0,'name','新姓名')]}));
 const ready=await service.run({assetId:'a',kind:'structure',confirmed:true});
 store.put('aiJobs',{id:'unfinished',kind:'resume-structure',assetId:'a',status:'running'});
 let calls=0;const reopened=createResumeAI(store,facts,assets,{read:()=>({enabled:true})},{invoke:async()=>{calls++;throw Error('no call expected');}});
 assert.equal(store.get('aiJobs','unfinished').status,'interrupted');assert.equal(store.get('aiJobs',ready.id).status,'ready');assert.equal(calls,0);
 reopened.adopt({jobId:ready.id,ids:['change-0']});assert.equal(facts.read().profile.values.basic[0].name,'新姓名');
});
