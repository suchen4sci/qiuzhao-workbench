'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../src/services/store.cjs');
const {createWorkflow}=require('../src/services/workflow.cjs');
const {createOpportunityActions}=require('../src/services/opportunity-actions.cjs');
const {createReminders}=require('../src/services/reminders.cjs');
const {browse}=require('../src/ui/opportunity-browser.js');
function fixture(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'opportunity-independent-')),store=openStore(dir),workflow=createWorkflow(store,{read:()=>({profile:{values:{basic:[{}]}}})});t.after(()=>{store.close();fs.rmSync(dir,{recursive:true,force:true});});return{store,workflow};}
const bulk=items=>({items,plannedOn:'2026-10-04',priority:'high',reminderEnabled:false,confirmed:true});
const role=(id,organizationId,fields={})=>({id,organizationId,route:['enterprise'],direction:['技术'],city:['北京'],nature:['私企'],match:{included:true,tier:'recommended',matchedPlans:[{id:'a'}]},...fields});
test('independent: every facet and tier composes without truncating or conflating batches',()=>{
 const rows=[role('a','one',{batch:'2026',deadline:'2026-10-20'}),role('b','one',{batch:'2027',deadline:'2026-10-10',city:['上海'],direction:['产品'],match:{included:true,tier:'explore',matchedPlans:[{id:'b'}]}}),role('c','two',{route:['civil'],nature:['国企']}),role('d','three',{match:{included:false,tier:'excluded',matchedPlans:[]}}),role('e','four',{city:[],match:{included:true,tier:'verify',matchedPlans:[{id:'a'}]}})];
 const before=JSON.stringify(rows);assert.equal(browse(rows).opportunityCount,4);assert.equal(browse(rows).organizationCount,3);
 for(const [filters,ids]of [[{route:['civil']},['c']],[{direction:['产品']},['b']],[{city:['上海']},['b']],[{nature:['国企']},['c']],[{plan:['b']},['b']],[{plan:['missing']},[]],[{city:['北京','上海'],route:['enterprise']},['a','b']]])assert.deepEqual(browse(rows,{filters}).list.map(x=>x.id),ids);
 assert.deepEqual(browse(rows,{tier:'excluded'}).list.map(x=>x.id),['d']);assert.deepEqual(browse(rows,{tier:'explore',filters:{plan:['b'],city:['上海']}}).list.map(x=>x.id),['b']);
 assert.equal(browse([...rows,...rows]).opportunityCount,4);assert.equal(JSON.stringify(rows),before);
 const many=Array.from({length:450},(_,i)=>role(String(i),'company-'+(i%30)));assert.equal(browse(many).opportunityCount,450);assert.equal(browse(many).organizationCount,30);
 const payload='<img src=x onerror="globalThis.pwned=1">';assert.equal(browse([role('x','x',{direction:[payload]})],{filters:{direction:[payload]}}).facets.direction[0],payload);assert.equal(globalThis.pwned,undefined);
});
test('independent: import normalizes names, distinguishes organization types, and stale previews preserve current data',t=>{
 const {store,workflow}=fixture(t),actions=createOpportunityActions(store,workflow);
 const p=actions.preview({text:' ＡＣＭＥ \t\t企业\nacme\t\t企业\nacme\t\t院校'});assert.equal(p.duplicates,1);assert.equal(p.rows.length,2);assert.equal(store.list('organizations').length,0);
 const latest=workflow.organization({name:'Acme',type:'enterprise',website:'https://example.com',nature:['国企']});
 const result=actions.adopt({ticket:p.ticket,ids:p.rows.map(x=>x.id),confirmed:true});assert.equal(result.organizations.filter(x=>x.created).length,1);assert.deepEqual(store.get('organizations',latest.id),latest);assert.equal(store.list('organizations').length,2);assert.equal(store.list('watches').length,2);assert.equal(store.list('opportunities').length,0);
 assert.throws(()=>actions.adopt({ticket:p.ticket,ids:['0'],confirmed:true}),/失效/);
});
test('independent: tickets cannot cross workspaces or survive expiry; validation has no side effects',t=>{
 const a=fixture(t),b=fixture(t);let now=0;const aa=createOpportunityActions(a.store,a.workflow,{clock:()=>now}),bb=createOpportunityActions(b.store,b.workflow,{clock:()=>now});const p=aa.preview({text:'单位'});
 assert.throws(()=>bb.adopt({ticket:p.ticket,ids:['0'],confirmed:true}),/失效/);assert.throws(()=>aa.adopt({ticket:p.ticket,ids:['0','0'],confirmed:true}),/重复/);assert.throws(()=>aa.adopt({ticket:p.ticket,ids:['0'],confirmed:false}),/确认/);
 now=300000;assert.throws(()=>aa.adopt({ticket:p.ticket,ids:['0'],confirmed:true}),/失效/);
 for(const text of ['单位\thttp://127.0.0.1','单位\tjavascript:alert(1)','单位\t\tunknown',Array(201).fill('单位').join('\n')])assert.throws(()=>aa.preview({text}));assert.equal(a.store.list('organizations').length,0);assert.equal(b.store.list('organizations').length,0);
});
test('independent: import failure rolls back every row and failed ticket remains retryable',t=>{
 const {store,workflow}=fixture(t);let fail=true;const wrapped={...workflow,watch(input){if(fail&&store.list('organizations').length===2)throw Error('injected second-row failure');return workflow.watch(input);}};
 const actions=createOpportunityActions(store,wrapped),p=actions.preview({text:'甲\n乙'}),request={ticket:p.ticket,ids:p.rows.map(x=>x.id),confirmed:true};assert.throws(()=>actions.adopt(request),/injected/);assert.equal(store.list('organizations').length,0);assert.equal(store.list('watches').length,0);fail=false;assert.equal(actions.adopt(request).organizations.length,2);
});
test('independent: batch failure rolls back watches, plans, tasks and collections',t=>{
 const {store,workflow}=fixture(t),org=workflow.organization({name:'公司'}),a=workflow.opportunity({organizationId:org.id,title:'A'}),b=workflow.opportunity({organizationId:org.id,title:'B'});let calls=0;
 const actions=createOpportunityActions(store,{...workflow,plan(input){if(++calls===2)throw Error('injected second-plan failure');return workflow.plan(input);}});
 assert.throws(()=>actions.bulkPlan(bulk([{kind:'opportunity',id:a.id},{kind:'opportunity',id:b.id}])),/injected/);for(const c of ['watches','plans','tasks','userOpportunities','applications'])assert.equal(store.list(c).length,0,c);
});
test('independent: retries preserve existing cancelled and completed plans and reject invalid shared inputs',t=>{
 const {store,workflow}=fixture(t),org=workflow.organization({name:'公司'}),a=workflow.opportunity({organizationId:org.id,title:'A'}),b=workflow.opportunity({organizationId:org.id,title:'B'}),actions=createOpportunityActions(store,workflow);
 const pa=workflow.plan({organizationId:org.id,opportunityId:a.id,plannedOn:'2026-12-01',priority:'low'}),pb=workflow.plan({organizationId:org.id,opportunityId:b.id,plannedOn:'2026-12-02'});
 const cancelled=store.put('plans',{...pa,status:'cancelled'},{expectedRevision:pa.revision}),completed=store.put('plans',{...pb,status:'completed'},{expectedRevision:pb.revision});const input=bulk([{kind:'opportunity',id:a.id},{kind:'opportunity',id:b.id}]);
 for(let n=0;n<2;n++){const r=actions.bulkPlan(input);assert.equal(r.created.length,0);assert.equal(r.existing.length,2);}assert.deepEqual(store.get('plans',pa.id),cancelled);assert.deepEqual(store.get('plans',pb.id),completed);
 for(const patch of [{plannedOn:'2026-02-30'},{priority:'highest'},{reminderEnabled:'false'},{items:[input.items[0],input.items[0]]},{items:[{kind:'opportunity',id:'missing'}]}])assert.throws(()=>actions.bulkPlan({...input,...patch}));assert.equal(store.list('plans').length,2);
});
test('independent: disabled plan reminders stay absent, then toggle cancels pending reminder',async t=>{
 const {store,workflow}=fixture(t),org=workflow.organization({name:'公司'}),opp=workflow.opportunity({organizationId:org.id,title:'岗位',deadline:'2026-10-05'}),actions=createOpportunityActions(store,workflow),r=actions.bulkPlan(bulk([{kind:'opportunity',id:opp.id}]));
 const scheduler=createReminders(store,{clock:()=>new Date('2026-10-03T00:00:00Z')});t.after(()=>scheduler.close());await scheduler.tick();assert.equal(store.list('reminders').filter(x=>x.taskId).length,0);
 let plan=store.get('plans',r.created[0]);workflow.plan({...plan,reminderEnabled:true});await scheduler.tick();assert.equal(store.list('reminders').filter(x=>x.taskId&&x.status==='pending').length,2);
 plan=store.get('plans',plan.id);workflow.plan({...plan,reminderEnabled:false});await scheduler.tick();assert.equal(store.list('reminders').filter(x=>x.taskId&&x.status==='pending').length,0);assert.equal(store.list('reminders').filter(x=>x.taskId&&x.status==='cancelled').length,2);
});
