'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {createBrowserWorkflow}=require('../src/services/browser-workflow.cjs');
function fixture(t){
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'browser-workflow-'));t.after(()=>fs.rmSync(directory,{recursive:true,force:true}));
 const filename=path.join(directory,'resume.pdf');fs.writeFileSync(filename,'%PDF-test');
 const rows={applications:{a:{id:'a',status:'draft',revision:1,assetId:'x',assetHash:'hash',readback:{fields:['old']}},b:{id:'b',status:'draft',revision:1,assetId:'y',assetHash:'hash2'}},assets:{x:{id:'x',name:'x.pdf',hash:'hash',size:9}}};
 const store={get:(c,id)=>structuredClone(rows[c][id]),put(c,value,{expectedRevision}={}){assert.equal(rows[c][value.id]?.revision,expectedRevision);const result={...structuredClone(value),revision:(expectedRevision||0)+1};rows[c][value.id]=result;return structuredClone(result)}};
 const f={rows,store,active:'a',url:'https://example.com/apply?token=private',sets:0,fields:[],onEvaluate:null,onSet:null,onRead:null,onPage:null};
 const input={name:'resume',id:'resume',accept:'.pdf',multiple:false,disabled:false,labels:[{textContent:'简历'}],files:[],getAttribute:()=>null,closest:()=>null};f.input=input;
 const locator={count:async()=>1,nth(){return this},async evaluate(fn){const result=fn(input);const hook=f.onEvaluate;f.onEvaluate=null;if(hook)await hook();return result},async setInputFiles(file){f.sets++;input.files=[{name:file.name,size:file.buffer.length}];if(f.onSet)await f.onSet()},async evaluateAll(fn){const result=fn(f.fields);if(f.onRead)await f.onRead();return result}};
 const page={url:()=>f.url,frames:()=>[{url:()=>f.url,locator:()=>locator}]};
 f.workflow=createBrowserWorkflow(store,{file:()=>filename},{getPage:async()=>{if(f.onPage)await f.onPage();return page},getApplicationId:()=>f.active});
 f.change=patch=>store.put('applications',{...store.get('applications','a'),...patch},{expectedRevision:rows.applications.a.revision});
 f.scan=()=>f.workflow.scanUploads();f.upload=scan=>f.workflow.upload({token:scan.token,fieldId:'file-0-0'});return f;
}
function field(overrides={}){return {type:'text',name:'normal',id:'',autocomplete:'',placeholder:'',labels:[{textContent:'资料'}],value:'allowed',getAttribute:()=>null,getClientRects:()=>[{}],...overrides}}
test('successful upload advances its own revision and requires explicit receipt confirmation',async t=>{
 const f=fixture(t),scan=await f.scan(),result=await f.upload(scan);
 assert.equal(result.state,'selected');assert.equal(f.rows.applications.a.revision,3);assert.equal(f.rows.applications.a.readback,null);
 assert.throws(()=>f.workflow.acknowledgeUpload({confirmed:false}));
 assert.equal(f.workflow.acknowledgeUpload({confirmed:true}).upload.state,'user_confirmed_received');
});
test('rebinding after scan invalidates the displayed asset ticket before browser side effects',async t=>{const f=fixture(t),scan=await f.scan();f.change({assetId:'y',assetHash:'hash2'});await assert.rejects(f.upload(scan),/重新扫描/);assert.equal(f.sets,0)});
test('navigation during scan rejects result',async t=>{const f=fixture(t);f.onEvaluate=()=>f.workflow.reset();await assert.rejects(f.scan(),/扫描期间/);assert.equal(f.sets,0)});
test('switching application during final file scan prevents sending original resume',async t=>{const f=fixture(t),scan=await f.scan();f.onEvaluate=()=>{f.active='b';f.workflow.reset()};await assert.rejects(f.upload(scan),/上下文/);assert.equal(f.sets,0);assert.equal(f.rows.applications.a.upload,undefined)});
test('same URL navigation reset invalidates ticket',async t=>{const f=fixture(t),scan=await f.scan();f.workflow.reset();await assert.rejects(f.upload(scan),/重新扫描/);assert.equal(f.sets,0)});
test('site clearing input after accepting file preserves pending verification',async t=>{const f=fixture(t),scan=await f.scan();f.onSet=()=>{f.input.files=[]};await assert.rejects(f.upload(scan),/无法回读/);assert.equal(f.rows.applications.a.upload.state,'pending_verification');assert.equal(f.rows.applications.a.readback,null);assert.equal(f.workflow.acknowledgeUpload({confirmed:true}).upload.state,'user_confirmed_received')});
test('setInputFiles rejection preserves pending verification and consumes ticket',async t=>{const f=fixture(t),scan=await f.scan();f.onSet=()=>{throw Error('site rejected')};await assert.rejects(f.upload(scan),/site rejected/);assert.equal(f.rows.applications.a.upload.state,'pending_verification');await assert.rejects(f.upload(scan),/重新扫描/)});
test('navigation after input selection does not claim selected result',async t=>{const f=fixture(t),scan=await f.scan();f.onSet=()=>f.workflow.reset();await assert.rejects(f.upload(scan),/上下文/);assert.equal(f.rows.applications.a.upload.state,'pending_verification')});
test('external revision change during upload is not overwritten',async t=>{const f=fixture(t),scan=await f.scan();f.onSet=()=>f.change({note:'concurrent update'});await assert.rejects(f.upload(scan),/上下文/);assert.equal(f.rows.applications.a.note,'concurrent update');assert.equal(f.rows.applications.a.upload.state,'pending_verification')});
test('confirmation rejects upload from a different bound hash',async t=>{const f=fixture(t);await f.upload(await f.scan());f.change({assetHash:'different'});assert.throws(()=>f.workflow.acknowledgeUpload({confirmed:true}),/核对/)});
test('readback excludes authentication signals hidden by generic labels',async t=>{const f=fixture(t);f.fields=[field(),field({name:'otp',value:'731928'}),field({autocomplete:'one-time-code',value:'938172'}),field({autocomplete:'current-password',value:'secret text'}),field({id:'captcha'}),field({placeholder:'验证码'}),field({labels:[{textContent:'资料'},{textContent:'密码'}]})];const result=await f.workflow.captureReadback();assert.deepEqual(result.fields,[{label:'资料',type:'text',value:'allowed'}]);assert.equal(result.url,'https://example.com/apply')});
test('readback rejects application change without storing captured values',async t=>{const f=fixture(t);f.fields=[field()];f.onRead=()=>{f.active='b';f.workflow.reset()};await assert.rejects(f.workflow.captureReadback(),/回读期间/);assert.deepEqual(f.rows.applications.a.readback,{fields:['old']})});
test('PDF type and site size checks reject before selecting files',async t=>{const f=fixture(t);f.input.accept='image/*';await assert.rejects(f.upload(await f.scan()),/不接受 PDF/);f.input.accept='.pdf';const scan=await f.scan();await assert.rejects(f.workflow.upload({token:scan.token,fieldId:'file-0-0',siteMaxMB:0.000001}),/大小上限/);assert.equal(f.sets,0)});
