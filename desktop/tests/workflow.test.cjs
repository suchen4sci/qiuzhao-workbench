const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {openStore}=require('../src/services/store.cjs');
const {createProfileService}=require('../src/services/profile-service.cjs');
const {createWorkflow,dayOf}=require('../src/services/workflow.cjs');
function fixture(t){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'workflow-'));fs.mkdirSync(path.join(root,'知识库'));
 fs.writeFileSync(path.join(root,'知识库/profile.json'),JSON.stringify({schemaVersion:1,demo:false,values:{basic:[{name:'测试用户'}]}}));
 const store=openStore(root),wf=createWorkflow(store,createProfileService(root),{clock:()=> '2026-10-03T12:00:00Z'});
 t.after(()=>{store.close();fs.rmSync(root,{recursive:true,force:true});});
 const org=wf.organization({name:'示例机构'});const opp=wf.opportunity({organizationId:org.id,title:'研发',city:['北京'],batch:'2027'});
 return {store,wf,org,opp};
}
test('plan -> draft -> explicitly confirmed submission preserves separation and idempotency',t=>{
 const {store,wf,org,opp}=fixture(t);
 const plan=wf.plan({organizationId:org.id,opportunityId:opp.id,plannedOn:'2026-10-03'});
 wf.plan({organizationId:org.id,opportunityId:opp.id});assert.equal(store.list('plans').length,1);
 assert.equal(store.list('applications').length,0);
 const task=store.list('tasks')[0];assert.throws(()=>wf.completeTask({id:task.id,revision:task.revision}),/实际提交/);
 const app=wf.startApplication(plan.id);assert.equal(app.status,'draft');assert.equal(wf.startApplication(plan.id).id,app.id);
 assert.throws(()=>wf.confirmSubmission({applicationId:app.id,occurredAt:'2026-10-03T10:00:00Z',evidence:'回执'}),/确认/);
 const submitted=wf.confirmSubmission({applicationId:app.id,occurredAt:'2026-10-03T10:00:00Z',evidence:'用户已查看成功页',confirmed:true});
 assert.equal(submitted.status,'submitted');assert.equal(store.get('plans',plan.id).status,'completed');
 wf.confirmSubmission({applicationId:app.id,occurredAt:'2026-10-03T10:00:00Z',evidence:'重复',confirmed:true});
 assert.equal(store.list('activities').length,1);assert.equal(store.list('snapshots').length,2);
});
test('company-only plans never invent an opportunity or application',t=>{
 const {store,wf,org}=fixture(t);const p=wf.plan({organizationId:org.id});
 assert.equal(p.status,'awaiting_role');assert.throws(()=>wf.startApplication(p.id),/选择岗位/);
 assert.equal(store.list('applications').length,0);
});
test('multiple events remain independent and activity heat follows real completion and undo',t=>{
 const {store,wf,org}=fixture(t);
 const one=wf.event({organizationId:org.id,type:'interview',title:'一面',round:1,startsAt:'2026-10-02T23:00:00Z'});
 wf.event({organizationId:org.id,type:'assessment',title:'线上测评',deadline:'2026-10-03T15:00:00Z'});
 const task=store.get('tasks',`task-event-${one.id}`);
 wf.completeTask({id:task.id,revision:task.revision,completedAt:'2026-10-02T23:30:00Z',result:'已参加'});
 assert.equal(wf.calendar('2026-10','Asia/Shanghai').cells['2026-10-03'],1);
 assert.equal(store.list('tasks').filter(x=>x.status==='pending').length,1);
 assert.equal(dayOf('2026-10-02T23:30:00Z','Asia/Shanghai'),'2026-10-03');
 const completed=store.get('tasks',task.id);wf.taskStatus({id:task.id,revision:completed.revision,status:'pending'});
 assert.equal(wf.calendar('2026-10').completed,0);
 assert.equal(store.get('events',one.id).status,'scheduled');
});
test('invalid dates and future completion do not mutate data; rescheduling preserves history',t=>{
 const {store,wf,org}=fixture(t);
 assert.throws(()=>wf.task({title:'错误日期',plannedOn:'2026-02-30'}));
 const task=wf.task({title:'准备项目复盘',plannedOn:'2026-10-03',kind:'preparation'});
 assert.throws(()=>wf.completeTask({id:task.id,revision:task.revision,completedAt:'2026-10-04T10:00:00Z'}),/未来/);
 assert.equal(store.list('activities').length,0);
 const e=wf.event({organizationId:org.id,title:'面试',startsAt:'2026-10-04T01:00:00Z'});
 const changed=wf.event({...e,startsAt:'2026-10-05T01:00:00Z'});
 assert.equal(changed.history[1].startsAt,e.startsAt);
 assert.equal(store.get('tasks',`task-event-${e.id}`).plannedOn,'2026-10-05');
});
test('binding cannot duplicate an active plan or change the opportunity behind a draft',t=>{
 const {wf,store,org,opp}=fixture(t);const p=wf.plan({organizationId:org.id,opportunityId:opp.id});
 const company=wf.plan({organizationId:org.id});
 assert.throws(()=>wf.plan({...company,opportunityId:opp.id}),/已有计划/);
 wf.startApplication(p.id);
 const other=wf.opportunity({organizationId:org.id,title:'另一个职位'});
 assert.throws(()=>wf.plan({...store.get('plans',p.id),opportunityId:other.id}),/不能改绑/);
});
test('submitted facts are the frozen application version; resuming a cancelled draft restores filling',t=>{
 const {wf,store,org,opp}=fixture(t);const p=wf.plan({organizationId:org.id,opportunityId:opp.id});
 const app=wf.startApplication(p.id), task=store.get('tasks',`task-${p.id}`);
 wf.taskStatus({id:task.id,revision:task.revision,status:'cancelled'});
 const cancelled=store.get('tasks',task.id);wf.taskStatus({id:task.id,revision:cancelled.revision,status:'pending'});
 wf.startApplication(p.id);assert.equal(store.get('plans',p.id).status,'filling');
 wf.confirmSubmission({applicationId:app.id,confirmed:true,occurredAt:'2026-10-03T10:00:00Z',evidence:'手动确认'});
 assert.equal(store.get('snapshots',`snapshot-${app.id}-submitted`).profileHash,app.profileHash);
});
test('deadline-only plans use viewing timezone and reschedule cancels old reminders',t=>{
 const {wf,store,org}=fixture(t);const e=wf.event({organizationId:org.id,type:'assessment',title:'测评',deadline:'2026-10-01T00:30:00Z'});
 const taskId=`task-event-${e.id}`;
 assert.equal(wf.calendar('2026-09','America/Los_Angeles','planned').cells['2026-09-30'],1);
 const r=store.put('reminders',{taskId,status:'pending',dueAt:e.deadline});
 wf.event({...e,deadline:'2026-10-02T00:30:00Z'});
 assert.equal(store.get('reminders',r.id).status,'cancelled');
});
