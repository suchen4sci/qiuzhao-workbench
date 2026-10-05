'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {openStore}=require('../src/services/store.cjs');const {createWorkflow}=require('../src/services/workflow.cjs');const {validatePreferences,matchOpportunity}=require('../src/services/matching.cjs');
function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'preference-review-')),store=openStore(dir),wf=createWorkflow(store,{read:()=>({profile:{values:{basic:[{highestEducation:'本科'}]}}})});t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return{store,wf};}
const all={route:['enterprise','civil'],nature:['私企','国企'],direction:['技术','产品'],city:['北京','上海'],industry:['互联网','制造业'],workMode:['远程','现场'],organization:['甲','乙'],keyword:['研发','设计']};
function roundtrip(prefs){
 const source=fs.readFileSync(path.join(__dirname,'../src/ui/workbench.js'),'utf8');const helpers=source.slice(source.indexOf('  const preferenceDimensions='),source.indexOf('  async function preferencePreview('));
 const form={entries:[],querySelectorAll:()=>prefs.plans.map((_,i)=>({dataset:{planIndex:String(i)}}))};class FakeFormData{constructor(f){this.entries=f.entries;}get(key){return this.entries.find(([k])=>k===key)?.[1]??null;}getAll(key){return this.entries.filter(([k])=>k===key).map(([,v])=>v);}}
 const ctx={state:{preferences:prefs},routes:{enterprise:'企业求职',civil:'考公',public:'事业单位',postgraduate:'考研'},h:v=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;'),$:()=>form,FormData:FakeFormData};vm.createContext(ctx);vm.runInContext(helpers+'\nglobalThis.review={preferenceFields,preferenceFormValue};',ctx);
 const unescape=v=>v.replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>').replaceAll('&amp;','&');
 const read=(prefix,values)=>{for(const match of ctx.review.preferenceFields(prefix,values).matchAll(/<input\b([^>]*)>/g)){const attrs=match[1],name=/name="([^"]*)"/.exec(attrs)?.[1],value=/value="([^"]*)"/.exec(attrs)?.[1]||'';if(attrs.includes('type="checkbox"')&&!/\schecked(?:\s|$)/.test(attrs))continue;form.entries.push([name,unescape(value)]);}};
 prefs.plans.forEach((p,i)=>{form.entries.push([i+':name',p.name]);read(String(i),p.conditions);read(i+':preferred',p.preferred);});read('global',prefs.global);read('excluded',prefs.excluded);if(prefs.notification.enabled)form.entries.push(['digest','on']);form.entries.push(['hour',String(prefs.notification.hour)]);
 return JSON.parse(JSON.stringify(ctx.review.preferenceFormValue()));
}
test('independent preference editor: all 8 dimensions and multiple routes roundtrip in each scope',()=>{
 const p={id:'main',revision:7,plans:[{id:'p',name:'测试',conditions:all,preferred:all}],global:all,excluded:all,notification:{enabled:false,hour:22}},actual=roundtrip(p);assert.deepEqual(actual,p);
});
test('independent preference preview: read-only, complete failed plan reasons, organization fact enrichment and soft preferences',t=>{
 const {store,wf}=setup(t),org=wf.organization({name:'甲',nature:['私企']}),job=wf.opportunity({organizationId:org.id,title:'研发岗位',route:'enterprise',workMode:['远程'],industry:['互联网'],city:['北京'],openStatus:'open',statusVerified:true,evidence:'官网',eligibility:{anyOf:[[{field:'highestEducation',operator:'minimum',values:['本科'],verified:true,evidence:'本科以上'}]]}});
 const saved=wf.preferences({plans:[]}),before=JSON.stringify({prefs:store.list('preferences'),jobs:store.list('opportunities'),users:store.list('userOpportunities')});
 const draft={...saved,plans:[{id:'a',conditions:{organization:['甲'],workMode:['远程'],industry:['互联网'],route:['enterprise','civil']},preferred:{city:['上海']}},{id:'b',conditions:{route:['postgraduate']}}]};const result=wf.previewPreferences(draft);
 assert.equal(result.scope,'loaded_samples');assert.equal(result.included,1);assert.equal(result.opportunities[0].match.tier,'explore');assert.equal(result.opportunities[0].match.planAssessments.length,2);assert.deepEqual(result.opportunities[0].match.planAssessments[1].mismatch,['route']);assert.equal(JSON.stringify({prefs:store.list('preferences'),jobs:store.list('opportunities'),users:store.list('userOpportunities')}),before);
 const blocked=wf.previewPreferences({...draft,excluded:{organization:['甲']}});assert.equal(blocked.excluded,1);assert.equal(blocked.opportunities[0].match.reason,'命中明确排除项');assert.equal(store.get('opportunities',job.id).workMode[0],'远程');
});
test('independent preference preview: later revision rejects stale save, cancellation leaves persisted preferences intact',t=>{
 const {store,wf}=setup(t),original=wf.preferences({plans:[]});const draft={...original,plans:[{id:'a',conditions:{route:['civil']}}]};wf.previewPreferences(draft);assert.deepEqual(store.get('preferences','main'),original);
 const current=wf.preferences({...original,plans:[{id:'b',conditions:{route:['postgraduate']}}]});assert.throws(()=>wf.preferences(draft),/更新/);assert.deepEqual(store.get('preferences','main'),current);
});
test('independent templates: extracted actual template groups preserve AND/OR semantics',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../src/ui/workbench.js'),'utf8'),expression=/const groups=(template===.*?);if\(state\.preferences\.plans/.exec(src)?.[1];assert.ok(expression);const job={route:['enterprise'],nature:['私企'],direction:['销售']};
 const evaluate=template=>vm.runInNewContext(expression,{template});const prefs=template=>({plans:JSON.parse(JSON.stringify(evaluate(template))).map((conditions,i)=>({id:'p'+i,conditions}))});
 assert.equal(matchOpportunity(job,{},prefs('civil-tech')).included,false);assert.equal(matchOpportunity(job,{},prefs('civil-or-sales')).included,true);assert.equal(matchOpportunity({...job,route:['civil']},{},prefs('civil-or-sales')).included,false);assert.equal(matchOpportunity(job,{},prefs('any')).included,true);assert.equal(matchOpportunity(job,{},prefs('postgraduate')).included,false);assert.equal(evaluate('any').length,4);
});
test('independent preference editor: unchanged labels containing separators remain one tag',()=>{
 const p=validatePreferences({plans:[{id:'p',name:'原样保存',conditions:{organization:['ACME, Inc.','甲\"乙公司'],keyword:['甲、乙','甲，乙']}}]});const result=validatePreferences(roundtrip(p));assert.deepEqual(result.plans[0].conditions.organization,p.plans[0].conditions.organization);assert.deepEqual(result.plans[0].conditions.keyword,p.plans[0].conditions.keyword);
});
test('independent preference codec rejects unfinished quotes without accepting a partial filter',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../src/ui/workbench.js'),'utf8'),helpers=source.slice(source.indexOf('  const preferenceDimensions='),source.indexOf('  async function preferencePreview(')),context={};vm.createContext(context);vm.runInContext(helpers+'\nglobalThis.codec={preferenceEncode,preferenceParse};',context);
 assert.throws(()=>context.codec.preferenceParse('"未闭合'),/没有闭合/);assert.throws(()=>context.codec.preferenceParse('"标签"垃圾'),/逗号/);const labels=['A,B','甲，乙','甲、乙','甲"乙','普通'];assert.deepEqual(JSON.parse(JSON.stringify(context.codec.preferenceParse(context.codec.preferenceEncode(labels)))),labels);
});
