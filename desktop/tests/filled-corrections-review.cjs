// Independent real-browser review; run explicitly with node (requires local Chrome).
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const correction=require('../src/ai-corrections.cjs');
const {executeControl}=require('../src/control-dispatcher.cjs');
const {mappingInput}=require('../src/ai-mapping.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
 try{
 const page=await browser.newPage();await page.route('https://review.invalid/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:'<label>项目名称<input id="a" value="网站旧项目"></label><label>项目描述<input id="b" value="网站旧描述"></label><label>其他<input id="c" value="未选字段"></label>'}));await page.goto('https://review.invalid/apply');
 const profile={values:{basic:[{name:'本机姓名不外发'}],projects:[{name:'甲项目',description:'甲事实'},{name:'乙项目',description:'乙事实'}]}};
 const scan=async()=>({url:page.url(),items:await Promise.all(['a','b'].map(async id=>({id,frame:page.mainFrame(),frameIndex:0,frameUrl:page.url(),selector:'#'+id,labels:[id==='a'?'项目名称':'项目描述'],label:id,headings:['项目经历'],type:'text',tag:'input',section:'projects',hasValue:true,observedValue:await page.locator('#'+id).inputValue(),recordIdentity:{}})))});
 const ticket=async()=>{const s=await scan();return {url:s.url,candidates:s.items,profileStamp:correction.profileStamp(profile),proposals:correction.proposals(s.items,[{id:'a',group:'projects',key:'name'},{id:'b',group:'projects',key:'description'}],profile,s.url)};};
 const beforeProfile=JSON.stringify(profile),t=await ticket(),provider=JSON.stringify(mappingInput(t.candidates));assert(!provider.includes('网站旧项目'));assert(!provider.includes('乙项目'));assert(!provider.includes('本机姓名'));
 const result=await correction.apply(page,profile,t,[{id:'a',index:1}],{scanPage:scan,executeControl});
 assert.equal(await page.locator('#a').inputValue(),'乙项目');assert.equal(await page.locator('#b').inputValue(),'网站旧描述');assert.equal(result.results[0].status,'filled');assert.match(result.results[0].source,/第 2 条/);assert.equal(JSON.stringify(profile),beforeProfile);
 console.log('PASS real dispatcher overwrites only selected field from explicit second record; facts unchanged, metadata excludes values');
 const stale=await ticket();await page.locator('#a').fill('人工最新');await assert.rejects(correction.apply(page,profile,stale,[{id:'a',index:0}],{scanPage:scan,executeControl}),/变化/);assert.equal(await page.locator('#a').inputValue(),'人工最新');
 await assert.rejects(correction.apply(page,{...profile,changed:true},stale,[{id:'a',index:0}],{scanPage:scan,executeControl}),/变化/);
 console.log('PASS stale field and profile rejected, manual value retained');
 const partial=await ticket();let calls=0;const stopped=await correction.apply(page,profile,partial,[{id:'a',index:0},{id:'b',index:1}],{scanPage:scan,executeControl:async(...args)=>{calls++;const r=await executeControl(...args);await page.locator('#b').fill('第二项人工最新');return r;}});
 assert.equal(calls,1);assert.deepEqual(stopped.results.map(r=>r.status),['needs_review','skipped']);assert.equal(await page.locator('#b').inputValue(),'第二项人工最新');
 console.log('PASS re-scan between fields preserves later manual edit and reports partial result');
 // Dirty, focused input emits a trusted native change when the guarded setter blurs it.
 await page.locator('#a').click();await page.locator('#a').press('ControlOrMeta+A');await page.locator('#a').pressSequentially('focused-old');
 await page.locator('#a').evaluate(el=>{globalThis.__reviewTrustedChanges=0;el.addEventListener('change',e=>{if(e.isTrusted)globalThis.__reviewTrustedChanges++;});});
 const focusedTicket=await ticket(),focusedResult=await correction.apply(page,profile,focusedTicket,[{id:'a',index:0}],{scanPage:scan,executeControl:async(...args)=>{const result=await executeControl(...args);const allowed=await page.evaluate(()=>{const key=Object.keys(globalThis).find(k=>k.startsWith('__qiuzhaoCorrection_')),state=globalThis[key];state.listener({isTrusted:true,type:'change',target:document.querySelector('#a')});return !state.changed;});assert.equal(allowed,true,'same-node same-value trusted change is allowed by listener');return result;}});
 assert.equal(focusedResult.results[0].status,'filled');assert.equal(await page.locator('#a').inputValue(),'甲项目');const nativeBlurEvents=await page.evaluate(()=>globalThis.__reviewTrustedChanges);
 console.log('PASS focused dirty input and direct same-value trusted-change listener case; native blur trusted events:',nativeBlurEvents);
 const keyTicket=await ticket(),keyResult=await correction.apply(page,profile,keyTicket,[{id:'a',index:1}],{scanPage:scan,executeControl:async(...args)=>{const r=await executeControl(...args);await page.locator('#a').press('ArrowRight');return r;}});
 assert.equal(keyResult.results[0].status,'needs_review');assert.equal(await page.locator('#a').inputValue(),'乙项目');await page.locator('#a').fill('键盘暂停后旧值');
 console.log('PASS trusted keydown pauses even when value remains exactly the expected value');
 // Real DOM: enter a manual value after first fill but before read-back; retries must not erase it.
 const racing=await ticket();let injected=false;
 const race=await correction.apply(page,profile,racing,[{id:'a',index:1}],{scanPage:scan,executeControl:async(frame,locator,request)=>executeControl(frame,new Proxy(locator,{get(target,key){if(key==='evaluate')return async(...args)=>{const result=await target.evaluate(...args);if(!injected&&args[1]?.next){injected=true;await page.locator('#a').fill('执行期间人工输入');}return result;};if(key==='fill')return async(...args)=>{await target.fill(...args);if(!injected){injected=true;await page.locator('#a').fill('执行期间人工输入');}};const value=target[key];return typeof value==='function'?value.bind(target):value;}}),request)});
 assert.equal(await page.locator('#a').inputValue(),'执行期间人工输入','manual edit during first strategy must survive keyboard fallback');assert.notEqual(race.results[0].status,'filled');
 console.log('PASS manual input during execution wins');
 const late=await ticket();let lateInjected=false;const lateResult=await correction.apply(page,profile,late,[{id:'a',index:1}],{scanPage:scan,executeControl:async(frame,locator,request)=>executeControl(frame,new Proxy(locator,{get(target,key){if(key==='evaluate')return async(...args)=>{if(!lateInjected&&args[1]?.next){lateInjected=true;await page.locator('#a').fill('原子写入前人工输入');}return target.evaluate(...args);};const value=target[key];return typeof value==='function'?value.bind(target):value;}}),request)});
 assert.equal(await page.locator('#a').inputValue(),'原子写入前人工输入');assert.equal(lateResult.results[0].status,'needs_review');
 console.log('PASS compare/set rejects edits between dispatcher guard and browser mutation');
 // A controlled field can reject synthetic input. Retain site value and report review rather than retry.
 await page.locator('#a').evaluate(el=>el.addEventListener('input',()=>{if(el.value==='乙项目')el.value='网站受控值';}));
 const controlled=await ticket(),controlledResult=await correction.apply(page,profile,controlled,[{id:'a',index:1}],{scanPage:scan,executeControl});
 assert.equal(await page.locator('#a').inputValue(),'网站受控值');assert.equal(controlledResult.results[0].status,'needs_review');
 console.log('PASS controlled field rejection remains visible without forceful fallback');
 const globalTicket=await ticket(),bBefore=await page.locator('#b').inputValue();let globalCalls=0;
 const globalResult=await correction.apply(page,profile,globalTicket,[{id:'a',index:0},{id:'b',index:0}],{scanPage:scan,executeControl:async(...args)=>{globalCalls++;const r=await executeControl(...args);if(globalCalls===1)await page.locator('#c').fill('用户接管未选字段');return r;}});
 assert.equal(globalCalls,1,'manual input outside selected fields pauses remaining corrections');assert.equal(await page.locator('#b').inputValue(),bBefore);assert.equal(await page.locator('#c').inputValue(),'用户接管未选字段');assert(globalResult.results.some(r=>r.status==='skipped'));
 const resumed=await ticket(),resumedResult=await correction.apply(page,profile,resumed,[{id:'b',index:0}],{scanPage:scan,executeControl});assert.equal(resumedResult.results[0].status,'filled');assert.equal(await page.locator('#b').inputValue(),'甲事实');
 console.log('PASS unrelated manual input pauses and a fresh review resumes after cleanup');
 await page.setContent('<select id="gender"><option value="m">男</option><option value="f">女</option></select><input id="dob" type="date" value="2000-01-01">');
 const nativeProfile={values:{basic:[{gender:'女',birthDate:'2001-02-03'}]}};
 const nativeScan=async()=>({url:page.url(),items:await Promise.all(['gender','dob'].map(async id=>({id,frame:page.mainFrame(),frameIndex:0,frameUrl:page.url(),selector:'#'+id,labels:[id==='gender'?'性别':'出生日期'],label:id,headings:[],tag:id==='gender'?'select':'input',type:id==='gender'?'select-one':'date',section:'basic',hasValue:true,observedValue:id==='gender'?await page.locator('#gender option:checked').textContent():await page.locator('#dob').inputValue(),recordIdentity:{}})))});
 const ns=await nativeScan(),nt={url:page.url(),candidates:ns.items,profileStamp:correction.profileStamp(nativeProfile),proposals:correction.proposals(ns.items,[{id:'gender',group:'basic',key:'gender'},{id:'dob',group:'basic',key:'birthDate'}],nativeProfile,page.url())};
 const nr=await correction.apply(page,nativeProfile,nt,[{id:'gender',index:0},{id:'dob',index:0}],{scanPage:nativeScan,executeControl});assert.deepEqual(nr.results.map(r=>r.status),['filled','filled']);assert.equal(await page.locator('#gender').inputValue(),'f');assert.equal(await page.locator('#dob').inputValue(),'2001-02-03');
 assert.equal(await page.evaluate(()=>Object.keys(globalThis).filter(k=>k.startsWith('__qiuzhaoCorrection_')).length),0);
 console.log('PASS native select/date corrections do not trigger their own manual-input guard; listeners cleaned');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
