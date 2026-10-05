const test=require('node:test'),assert=require('node:assert/strict');
const {abortablePage,runFill}=require('../src/fill-execution.cjs');
class Locator {
 constructor(log){this.log=log;} filter(options){assert(options.has instanceof Locator);return this;} nth(){return this;} page(){return this.parent;}
 async fill(value,options){this.log.push({value,options});}
 async evaluate(fn){this.log.push('evaluate');return fn();}
 async elementHandles(){return [new ElementHandle(this.log)];}
}
class ElementHandle extends Locator {async press(value,options){this.log.push({value,options});}}
class Mouse {constructor(log){this.log=log;}async click(x,y,options){this.log.push({x,y,options});}}
class Frame {constructor(log){this.log=log;}locator(){return new Locator(this.log);}url(){return 'https://example.invalid';}}
class Page extends Frame {constructor(log){super(log);this.mouse=new Mouse(log);}frames(){return [new Frame(this.log)];}mainFrame(){return this.frames()[0];}}
test('run wrappers carry one signal through nested frames, locator filters, handles and mouse arguments',async()=>{
 const log=[],controller=new AbortController(),raw=new Page(log),p=abortablePage(raw,controller.signal);
 await p.frames()[0].locator('x').filter({has:p.locator('y')}).nth(0).fill('fact',{timeout:45});
 await (await p.locator('x').elementHandles())[0].press('Escape');await p.mouse.click(12,34);
 assert.equal(log[0].options.signal,controller.signal);assert.equal(log[0].options.timeout,45);assert.equal(log[1].options.signal,controller.signal);assert.equal(log[2].x,12);assert.equal(log[2].y,34);
 controller.abort(new Error('manual'));assert.throws(()=>p.locator('x').fill('bad'),/manual/);assert.throws(()=>p.locator('x').evaluate(()=>1),/manual/);assert.throws(()=>p.mouse.click(1,1),/manual/);assert.equal(log.length,3);
});
test('run cancellation aborts waiting action and blocks catch fallback before raw API dispatch',async()=>{
 const log=[],controller=new AbortController();class WaitingLocator extends Locator {}
 // Keep the real API class name: production Playwright classes use these names.
 const l=new Locator(log);l.fill=async(_v,{signal})=>new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(signal.reason),{once:true});setImmediate(()=>controller.abort(new Error('takeover')));});
 const raw=new Page(log);raw.locator=()=>l;
 const result=await runFill(raw,{}, {},{signal:controller.signal,fillPage:async p=>{try{await p.locator('x').fill('a');}catch{await p.locator('x').evaluate(()=>1);}},inspectPage:async()=>({fields:[{status:'existing'}],counts:{existing:1}})});
 assert.equal(result.execution.state,'paused');assert.equal(result.counts.existing,1);assert.deepEqual(log,[]);
});
test('uncancellable in-flight evaluate settles before paused result and old wrappers stay canceled',async()=>{
 const controller=new AbortController(),log=[],raw=new Page(log);let release,entered;
 const started=new Promise(r=>entered=r);raw.evaluate=async()=>{entered();await new Promise(r=>release=r);log.push('settled');};
 let ended=false,old;
 const run=runFill(raw,{}, {},{signal:controller.signal,fillPage:async p=>{old=p;await p.evaluate(()=>{});},inspectPage:async()=>{log.push('rescan');return {fields:[],counts:{}};}}).then(r=>{ended=true;return r;});
 await started;controller.abort(new Error('stop'));await new Promise(r=>setImmediate(r));assert.equal(ended,false);release();await run;assert.deepEqual(log,['settled','rescan']);
 const next=abortablePage(raw,new AbortController().signal);await next.locator('x').fill('new');assert.throws(()=>old.locator('x').fill('late'),/stop/);
});
test('non-cancellation errors surface and already canceled run sends no write',async()=>{
 const controller=new AbortController(),raw=new Page([]);await assert.rejects(runFill(raw,{},{},{signal:controller.signal,fillPage:async()=>{throw Error('real failure');},inspectPage:async()=>({})}),/real failure/);
 controller.abort();let writes=0;const result=await runFill(raw,{},{},{signal:controller.signal,fillPage:async()=>writes++,inspectPage:async()=>{throw Error('closed');}});assert.equal(writes,0);assert.equal(result.execution.state,'paused');assert.equal(result.counts.filled,0);
});
test('bundled Playwright underscore-prefixed API classes are guarded as well',async()=>{
 class _Locator extends Locator {} class _Frame extends Frame {locator(){return new _Locator(this.log);}} class _Page extends Page {frames(){return[new _Frame(this.log)];}}
 const log=[],controller=new AbortController(),p=abortablePage(new _Page(log),controller.signal);
 await p.frames()[0].locator('x').fill('v');assert.equal(log[0].options.signal,controller.signal);
 controller.abort(new Error('cancel'));assert.throws(()=>p.frames()[0].locator('x').fill('late'),/cancel/);assert.equal(log.length,1);
});
