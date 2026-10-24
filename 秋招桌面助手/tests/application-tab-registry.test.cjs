const {test}=require('node:test'),assert=require('node:assert/strict');
const {ApplicationTabRegistry,restoreUrl}=require('../src/application-tab-registry.cjs');
test('identifiers remain stable when tabs are switched, closed and restored',()=>{
  const r=new ApplicationTabRegistry(),first=r.add('https://one.example/apply'),second=r.add('https://two.example/apply');
  r.activate(first.id);r.close(first.id);assert.equal(r.activeId,second.id);
  const restored=new ApplicationTabRegistry(r.snapshot());assert.equal(restored.add('https://three.example/').id,'A03');
  assert.equal(restored.get('A02').url,'https://two.example/apply');
});
test('batch jobs isolate issues per tab and continue after one website fails',async()=>{
  const r=new ApplicationTabRegistry(),a=r.add('https://one.example/'),b=r.add('https://two.example/');r.enqueue([a.id,a.id,b.id]);
  const visited=[];await r.drain(async tab=>{visited.push(tab.id);if(tab.id===a.id)throw Error('需要登录');return {fields:[{label:'姓名',status:'existing'}],completionVerified:true};});
  assert.deepEqual(visited,['A01','A02']);assert.equal(r.get('A01').status,'待确认');assert.equal(r.get('A02').status,'填写完成');
  assert.equal(r.get('A01').issues[0].id,'A01-Q01');assert.equal(r.get('A02').issues.length,0);
});
test('pausing retains the current job and does not treat it as completed',async()=>{
  const r=new ApplicationTabRegistry(),a=r.add('https://one.example/');r.enqueue([a.id]);
  await r.drain(async(_tab,cancelled)=>{r.pause();assert(cancelled());return {fields:[]};});
  assert.equal(r.get(a.id).status,'待填写');assert.deepEqual(r.queue,[a.id]);
});
test('stored tab URLs strip one-time credentials and executable schemes are rejected',()=>{
  assert.equal(restoreUrl('https://one.example/apply?job=1&code=secret&access_token=secret'),'https://one.example/apply?job=1');
  assert.throws(()=>new ApplicationTabRegistry().add('javascript:alert(1)'));
});
test('zero-field or unverified pages are never labelled completed',async()=>{
  const r=new ApplicationTabRegistry(),a=r.add('https://one.example/');r.enqueue([a.id]);await r.drain(async()=>({fields:[]}));
  assert.equal(r.get(a.id).status,'待确认');assert.equal(r.get(a.id).issues[0].field,'整站复核');
});
