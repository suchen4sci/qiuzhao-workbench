const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const mapping=require('../src/ai-mapping.cjs');
const url='https://site.test/form';
const field=(id='field-1')=>({id,status:'pending',label:'国际交流称谓',labels:['国际交流称谓'],headings:['基本信息'],section:'basic',tag:'input',type:'text',selector:'#'+id,frameUrl:url,recordIdentity:{}});
test('scope accepts precisely selected unchanged candidates and rejects malformed selections',()=>{
 const a=field(),b=field('field-2'),ticket={url,candidates:[a,b]},scan={url,items:[a,b]};
 assert.deepEqual(mapping.selectedCandidates(ticket,['field-2'],scan),[b]);
 for(const ids of [[],['missing'],[a.id,a.id],Array.from({length:61},(_,i)=>'field-'+i),null])assert.throws(()=>mapping.selectedCandidates(ticket,ids,scan));
 assert.throws(()=>mapping.selectedCandidates(ticket,[a.id],{...scan,url:url+'/next'}));
});
test('rescan rejects newly populated, disabled, known, relabelled or replaced fields',()=>{
 const a=field(),ticket={url,candidates:[a]};
 for(const changes of [{hasValue:true},{disabled:true},{match:{}},{labels:['另一字段']},{headings:['教育背景']},{selector:'#replacement'},{recordIdentity:{school:'changed'}}])assert.throws(()=>mapping.selectedCandidates(ticket,[a.id],{url,items:[{...a,...changes}]}));
});
test('model payload contains selected metadata only, never values, record identity or URL',async()=>{
 const a={...field(),observedValue:'PRIVATE_VALUE',recordIdentity:{name:'PRIVATE_NAME'},frameUrl:url+'?token=PRIVATE_TOKEN'},b=field('field-2');
 let payload;
 const chosen=mapping.selectedCandidates({url,candidates:[a,b]},[a.id],{url,items:[a,b]});
 await mapping.suggestMappings({enabled:true,baseUrl:'https://provider.test/v1',model:'test',apiKey:'PRIVATE_KEY'},chosen,{fetchImpl:async(_url,request)=>{payload=JSON.parse(request.body);return {ok:true,json:async()=>({choices:[{message:{content:'{"mappings":[]}'}}]})};}});
 const raw=JSON.stringify(payload);for(const text of ['PRIVATE_VALUE','PRIVATE_NAME','PRIVATE_TOKEN','PRIVATE_KEY','field-2','#field-1'])assert.equal(raw.includes(text),false);
 assert.deepEqual(JSON.parse(payload.messages[1].content).fields.map(x=>x.id),['field-1']);
});
function handlers(){
 const source=fs.readFileSync(path.join(__dirname,'../src/main.cjs'),'utf8'),registered={};let release;
 const pending=new Promise(resolve=>{release=resolve;});
 const context={busy:false,teaching:{active:false},aiTicket:{token:'ticket',applicationId:'app',expires:Date.now()+60000,url,candidates:[field()],suggestions:[]},aiScopeTicket:null,aiAbort:null,aiPageEpoch:0,activeApplicationId:'app',profile:{},workspace:'unused',Date,AbortController,Error,TypeError,
 handle:(name,fn)=>{registered[name]=fn;},push:()=>{},executionProfile:()=>({}),getPage:async()=>({url:()=>url}),scanPage:()=>pending,aiSettings:{read:()=>({enabled:false})},require:name=>name==='./ai-mapping.cjs'?{...mapping,confirmMappings:()=>{context.saved=true;return 1;}}:require(name)};
 vm.runInNewContext(source.slice(source.indexOf("  handle('ai-cancel'"),source.indexOf("  handle('runtime-info'")),context);
 return {context,registered,release};
}
test('cancel during confirmation rescan prevents persisted mapping',async()=>{
 const {context,registered,release}=handlers();const result=registered['ai-confirm']({token:'ticket',ids:['field-1']});
 await Promise.resolve();registered['ai-cancel']();release({url,items:[field()]});
 await result.catch(()=>{});assert.notEqual(context.saved,true,'cancelled confirmation persisted a rule');
});
test('cancel during local scope scan prevents fresh scope ticket',async()=>{
 const {context,registered,release}=handlers();const result=registered['ai-scope']();
 await Promise.resolve();registered['ai-cancel']();release({url,items:[field()]});
 await result.catch(()=>{});assert.equal(context.aiScopeTicket,null,'cancelled scan issued a fresh scope ticket');
});
test('suggestion IPC requires live token, explicit confirmation and same application',async()=>{
 for(const change of [{request:{token:'wrong',confirmed:true}},{request:{token:'scope',confirmed:false}},{applicationId:'other'},{expires:0}]){
  const {context,registered}=handlers();context.aiScopeTicket={token:'scope',applicationId:'app',expires:Date.now()+60000,...change};
  await assert.rejects(registered['ai-suggest'](change.request||{token:'scope',confirmed:true,ids:['field-1']}),/重新选择/);assert.equal(context.busy,false);
 }
});
test('concurrent scans are rejected while first scan owns busy state',async()=>{
 const {context,registered,release}=handlers();const first=registered['ai-scope']();
 await assert.rejects(registered['ai-scope'](),/结束当前任务/);
 release({url,items:[field()]});await first;assert.equal(context.busy,false);
});
test('same URL navigation epoch or application switch invalidates in-flight confirmation',async()=>{
 for(const mutate of [context=>context.aiPageEpoch++,context=>context.activeApplicationId='other']){
  const {context,registered,release}=handlers();const result=registered['ai-confirm']({token:'ticket',ids:['field-1']});
  await Promise.resolve();mutate(context);release({url,items:[field()]});
  await assert.rejects(result,/变化|停止/);assert.notEqual(context.saved,true);assert.equal(context.busy,false);
 }
});
