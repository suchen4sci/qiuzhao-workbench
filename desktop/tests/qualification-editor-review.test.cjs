'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {openStore}=require('../src/services/store.cjs'),{createWorkflow}=require('../src/services/workflow.cjs'),{createQualifications,validateEligibility}=require('../src/services/qualifications.cjs');
const rule=(patch={})=>({field:'highestEducation',operator:'minimum',values:['硕士'],verified:true,exact:false,evidence:'公告原文要求硕士以上',sourceUrl:'https://example.com/jobs',...patch});
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qualification-review-')),store=openStore(dir),profile={values:{basic:[{highestEducation:'本科',graduationYear:'2027',latestMajor:'软件工程'}]}};const wf=createWorkflow(store,{read:()=>({profile})}),q=createQualifications(store),org=wf.organization({name:'测试单位'}),job=wf.opportunity({organizationId:org.id,title:'技术岗',openStatus:'open',statusVerified:true,evidence:'官网仍可申请'});t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});const save=eligibility=>q.save({id:job.id,revision:store.get('opportunities',job.id).revision,confirmed:true,eligibility});return{store,wf,q,org,job,save,profile};}
test('independent qualification editor: AND paths / OR alternatives, restore matching, clear to unknown',t=>{
 const {store,wf,job,save,org,profile}=fixture(t);wf.plan({organizationId:org.id,opportunityId:job.id,plannedOn:'2026-11-01'});const original=JSON.stringify({profile,plans:store.list('plans'),tasks:store.list('tasks')});
 const match=()=>wf.recommendations().find(x=>x.id===job.id).match;save({anyOf:[[rule()]]});assert.equal(match().included,false);
 save({anyOf:[[rule()],[rule({values:['本科']}),rule({field:'graduationYear',operator:'oneOf',values:['2026']})]]});assert.equal(match().included,false);
 save({anyOf:[[rule()],[rule({values:['本科']}),rule({field:'graduationYear',operator:'oneOf',values:['2027']})]]});assert.equal(match().qualification.state,'pass');assert.equal(match().included,true);
 save(null);assert.equal(match().qualification.state,'unknown');assert.equal(match().included,true);assert.equal(match().tier,'verify');assert.equal(store.list('snapshots').length,4);assert.equal(JSON.stringify({profile,plans:store.list('plans'),tasks:store.list('tasks')}),original);
});
test('independent qualification editor: unknown evidence/facts and uncertain major correspondence never hard filter',t=>{
 const {wf,save}=fixture(t);const match=()=>wf.recommendations()[0].match;
 for(const r of [rule({verified:false,evidence:''}),rule({field:'certificates',operator:'oneOf',values:['职业证书']}),rule({field:'latestMajor',operator:'oneOf',values:['计算机科学'],exact:false})]){save({anyOf:[[r]]});assert.equal(match().included,true);assert.equal(match().qualification.state,'unknown');}
 save({anyOf:[[rule({field:'latestMajor',operator:'oneOf',values:['计算机科学'],exact:true})]]});assert.equal(match().included,false);
});
test('independent qualification editor: invalid fields/operators/values/evidence reject without mutations',t=>{
 const {save,store}=fixture(t);for(const patch of [{field:'route'},{field:'graduationYear',operator:'minimum',values:['2027']},{values:['本科','硕士']},{values:['本科以上']},{field:'workYears',values:['101']},{field:'workYears',values:['-1']},{field:'graduationYear',operator:'oneOf',values:['27']},{verified:true,evidence:' '},{verified:'true'},{exact:'true'},{values:[null]},{sourceUrl:'http://127.0.0.1/'},{sourceUrl:'javascript:alert(1)'}])assert.throws(()=>save({anyOf:[[rule(patch)]]}));
 for(const eligibility of [{anyOf:[]},{anyOf:[[]]},{anyOf:Array(11).fill([rule()])},{anyOf:[Array(21).fill(rule())]}])assert.throws(()=>save(eligibility));assert.equal(store.list('snapshots').length,0);assert.equal(store.list('opportunities')[0].eligibility,null);
 assert.equal(validateEligibility({anyOf:[[rule({field:'workYears',values:['0.5']})]]}).anyOf[0][0].values[0],'0.5');
});
test('independent qualification editor: stale revisions and denied confirmation preserve snapshot history; injected write failure rolls back',t=>{
 const {store,q,job,save}=fixture(t),updated=save({anyOf:[[rule()]]});const baseline=JSON.stringify({opportunities:store.list('opportunities'),snapshots:store.list('snapshots')});
 assert.throws(()=>q.save({id:job.id,revision:job.revision,confirmed:true,eligibility:null}),/变化/);assert.throws(()=>q.save({id:job.id,revision:updated.revision,confirmed:false,eligibility:null}),/确认/);
 const broken=createQualifications({...store,put(collection,...args){if(collection==='opportunities')throw Error('injected opportunity write failure');return store.put(collection,...args);}});assert.throws(()=>broken.save({id:job.id,revision:updated.revision,confirmed:true,eligibility:null}),/injected/);assert.equal(JSON.stringify({opportunities:store.list('opportunities'),snapshots:store.list('snapshots')}),baseline);
});
test('independent qualification editor: production helper reads every rule and retains quoted values/unchecked flags',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/ui/workbench.js'),'utf8'),codec=src.slice(src.indexOf('  function preferenceEncode('),src.indexOf('  function preferenceFields(')),reader=src.slice(src.indexOf('  function qualificationRead('),src.indexOf('  async function qualificationEditor('));
 const branches=[[rule({values:['本科'],verified:false,exact:false})],[rule({field:'latestMajor',operator:'oneOf',values:['甲,乙','乙"丙'],verified:true,exact:true,evidence:'<img src=x> 原文'})]],entries=new Map();const sections=branches.map((branch,p)=>({querySelectorAll:()=>branch.map((r,i)=>({dataset:{qualificationRule:p+':'+i}}))}));
 const form={querySelectorAll:()=>sections};class Data{get(k){return entries.get(k)??null;}}
 const ctx={$:()=>({querySelector:()=>form}),FormData:Data};vm.createContext(ctx);vm.runInContext(codec+reader+'globalThis.review={qualificationRead,preferenceEncode};',ctx);
 branches.forEach((branch,p)=>branch.forEach((r,i)=>{const k=p+':'+i;for(const field of ['field','operator','evidence','sourceUrl'])entries.set(k+':'+field,r[field]);entries.set(k+':values',ctx.review.preferenceEncode(r.values));for(const flag of ['verified','exact'])if(r[flag])entries.set(k+':'+flag,'on');}));
 assert.deepEqual(JSON.parse(JSON.stringify(ctx.review.qualificationRead())),branches);
});
