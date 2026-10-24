const test=require('node:test'),assert=require('node:assert/strict'),{triggerAI}=require('../src/desktop-ai-trigger.cjs');
test('desktop trigger checks readiness, starts once, and never toggles a running job off',async()=>{
 for(const running of [false,true]){let starts=0;const ui={waitForFunction:async()=>{},evaluate:async fn=>String(fn).includes('textContent')?running:(starts++,true)};
  assert.equal((await triggerAI(ui)).status,running?'already-running':'request-sent');assert.equal(starts,running?0:1);
 }
});
test('desktop connection check does not send work or fill a form',async()=>{let called=false;const ui={waitForFunction:async()=>{},evaluate:async()=>{called=true;}};assert.equal((await triggerAI(ui,{checkOnly:true})).status,'connected');assert.equal(called,false);});
