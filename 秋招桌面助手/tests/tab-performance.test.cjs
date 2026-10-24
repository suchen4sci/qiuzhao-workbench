const {test}=require('node:test'),assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {DesktopTabs}=require('../src/desktop-tabs.cjs');
const {SessionRetention}=require('../src/session-retention.cjs');
const {loadDocument}=require('../src/page-navigation.cjs');
function mockView(){
 const wc=new EventEmitter();let url='about:blank';
 Object.assign(wc,{isDestroyed:()=>false,setWindowOpenHandler(){},getURL:()=>url,getTitle:()=>'',executeJavaScript:async()=>{},loadURL:async value=>{url=value;},setBackgroundThrottling(){wc.throttles++;},throttles:0,close(){}});
 return {webContents:wc,bounds:{},visibilityCalls:0,boundsCalls:0,setVisible(){this.visibilityCalls++;},getBounds(){return this.bounds;},setBounds(value){this.bounds=value;this.boundsCalls++;}};
}
test('switching 51 loaded tabs only touches two views and saves the final state asynchronously',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qiuzhao-tab-perf-')),file=path.join(dir,'tabs.json');
 const views=[];const make=()=>{const v=mockView();views.push(v);return v;};let host;
 host=new DesktopTabs({window:{webContents:{send(){}},contentView:{removeChildView(){},addChildView(){}}},initialView:make(),createView:make,onActivate:()=>host.layout({x:300,y:150,width:900,height:600}),onState(){},storage:file,demoUrl:'file:///demo.html'});
 try{
  for(let i=0;i<50;i++)await host.open('https://fixture.example/'+i);
  await host.persist();const before=fs.readFileSync(file,'utf8');
  for(const view of views){view.visibilityCalls=0;view.boundsCalls=0;view.webContents.throttles=0;}
  host.activate(host.registry.tabs[1].id);
  assert.equal(views.reduce((n,v)=>n+v.visibilityCalls,0),2);
  assert.equal(views.reduce((n,v)=>n+v.webContents.throttles,0),2);
  assert.ok(views.reduce((n,v)=>n+v.boundsCalls,0)<=1);
  assert.equal(fs.readFileSync(file,'utf8'),before,'activation does not synchronously rewrite history');
  await host.persist();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).activeId,host.registry.tabs[1].id);
  assert.equal(fs.readFileSync(file+'.bak','utf8'),before);
  host.activate(host.registry.tabs[2].id);await host.persist();assert.equal(JSON.parse(fs.readFileSync(file,'utf8')).activeId,host.registry.tabs[2].id);
 }finally{host.destroy();}
});
test('unchanged session checkpoints do not schedule encrypted disk writes; logout still does',()=>{
 const retention=new SessionRetention({});let saves=0;retention.changed=()=>saves++;
 retention.capture('A01','https://fixture.example/',{token:'fixture'});
 retention.capture('A01','https://fixture.example/',{token:'fixture'});
 assert.equal(saves,1);
 retention.capture('A01','https://fixture.example/',{});assert.equal(saves,2);
});
test('document-ready navigation does not wait for slow resources and handles late errors',async()=>{
 const wc=new EventEmitter();let fail;wc.loadURL=()=>new Promise((_,reject)=>{fail=reject;});
 const errors=[];const navigation=loadDocument(wc,'https://fixture.example',error=>errors.push(error));
 wc.emit('dom-ready');await navigation;
 assert.equal(wc.listenerCount('dom-ready'),0);assert.equal(wc.listenerCount('destroyed'),0);
 fail(new Error('late resource failure'));await new Promise(r=>setImmediate(r));assert.equal(errors.length,1);
});
test('failed and destroyed navigations reject without leaving listeners',async()=>{
 const wc=new EventEmitter();wc.loadURL=()=>Promise.reject(new Error('offline'));
 await assert.rejects(loadDocument(wc,'https://fixture.example'),/offline/);
 assert.equal(wc.listenerCount('dom-ready'),0);
 wc.loadURL=()=>new Promise(()=>{});const navigation=loadDocument(wc,'https://fixture.example');wc.emit('destroyed');
 await assert.rejects(navigation,/网页已关闭/);assert.equal(wc.listenerCount('dom-ready'),0);
});
