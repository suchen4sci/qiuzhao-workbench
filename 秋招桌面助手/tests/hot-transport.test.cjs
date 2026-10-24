const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm');
const {installHotTransport}=require('../src/hot-transport.cjs');
function harness(){
  let now=1000;const timers=new Map(),calls=[],sent=[];
  const window={desktop:{call:async(...args)=>calls.push(args)},native:payload=>sent.push(JSON.parse(payload))};
  const context=vm.createContext({window,Date:{now:()=>now},setInterval:fn=>{const id=timers.size+1;timers.set(id,fn);return id},clearInterval:id=>timers.delete(id)});
  vm.runInContext('('+installHotTransport.toString()+')({bridge:"bridge",native:"native"})',context);
  return {window,calls,sent,timers,tick:ms=>{now+=ms;for(const fn of [...timers.values()])fn()},heartbeat:()=>window.__quickFillHeartbeat=now};
}
test('lost worker releases its own host lease and shell finally enables quick fill',async()=>{
  const h=harness();h.window.__hotRunLease={bridge:'bridge',runId:'owned'};
  let busy=true;const operation=h.window.bridge({mode:'fill'}).finally(()=>busy=false);
  const rejected=assert.rejects(operation,/填写连接已断开/);
  h.tick(7000);await rejected;
  assert.equal(busy,false);assert.equal(h.timers.size,0);assert.equal(h.window.__hotRunLease,null);
  assert.deepEqual(h.calls.map(c=>c[0]),['stop','sync-hot-report']);assert.equal(h.calls[1][1].runId,'owned');
});
test('a replacement worker lease is never released by the old transport',async()=>{
  const h=harness();h.window.__hotRunLease={bridge:'new',runId:'new-run'};
  const rejected=assert.rejects(h.window.bridge({mode:'fill'}),/连接已断开/);
  h.window.__quickFillBridge='new';h.tick(1000);await rejected;
  assert.equal(h.calls.length,0);assert.equal(h.window.__hotRunLease.runId,'new-run');
});
test('normal result clears watchdog and ignores a later stale response',async()=>{
  const h=harness();const result=h.window.bridge({mode:'fill'});
  h.window.bridge_settle({id:h.sent[0].id,result:42});assert.equal(await result,42);assert.equal(h.timers.size,0);
  h.tick(7000);h.window.bridge_settle({id:1,error:'late'});assert.equal(h.calls.length,0);
});
test('live but unanswered requests time out without clearing another live operation',async()=>{
  const h=harness();const rejected=assert.rejects(h.window.bridge({mode:'draft'}),/请求超时/);
  for(let i=0;i<180;i++){h.heartbeat();h.tick(1000)}await rejected;
  assert.equal(h.timers.size,0);assert.equal(h.calls.length,0);
});
