'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {abortablePage,runFill}=require('../src/fill-execution.cjs');
class Locator {constructor(log){this.log=log;}async fill(v){this.log.push(v);}}
class ElementHandle extends Locator {}
class JSHandle {constructor(log){this.log=log;}async getProperties(){return new Map([['field',new ElementHandle(this.log)]]);}}
class Frame {constructor(log){this.log=log;}locator(){return new Locator(this.log);}}
class BrowserContext {constructor(page){this.root=page;}pages(){return [this.root];}}
class Page extends Frame {context(){return new BrowserContext(this);}async evaluateHandle(){return new JSHandle(this.log);}frames(){return this.childFrames||[];}}
test('handle properties cannot yield an unguarded element after cancellation',async()=>{
 const log=[],c=new AbortController(),p=abortablePage(new Page(log),c.signal);const handle=await p.evaluateHandle(()=>{}),map=await handle.getProperties();c.abort(Error('manual takeover'));
 await assert.rejects(async()=>map.get('field').fill('must not write'),/manual takeover/);assert.deepEqual(log,[]);
});
test('browser context traversal is denied or returns guarded pages',async()=>{
 const log=[],c=new AbortController(),p=abortablePage(new Page(log),c.signal);let derived;
 try{derived=p.context().pages()[0];}catch(error){assert.match(error.message,/context|unsupported|禁止|不支持/i);return;}
 c.abort(Error('manual takeover'));await assert.rejects(async()=>derived.locator('x').fill('must not write'),/manual takeover/);assert.deepEqual(log,[]);
});
test('frames discovered after a run begins inherit its cancellation token',async()=>{
 const log=[],c=new AbortController(),raw=new Page(log),p=abortablePage(raw,c.signal);raw.childFrames=[new Frame(log)];const lateFrame=p.frames()[0];await lateFrame.locator('x').fill('before');c.abort(Error('manual takeover'));await assert.rejects(async()=>lateFrame.locator('x').fill('after'),/manual takeover/);assert.deepEqual(log,['before']);
});
test('cancellation does not erase an existing value or falsely report completed fills',async()=>{
 const c=new AbortController(),raw=new Page([]);const result=await runFill(raw,{},{},{signal:c.signal,fillPage:async()=>{c.abort(Error('stop'));return {fields:[{status:'filled'}],counts:{filled:1}};},inspectPage:async()=>({fields:[{status:'existing'}],counts:{filled:0,existing:1}})});
 assert.equal(result.execution.state,'paused');assert.equal(result.counts.filled,0);assert.equal(result.counts.existing,1);
});
