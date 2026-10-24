const {test}=require('node:test'),assert=require('node:assert/strict'),{_electron}=require('playwright-core');
const fs=require('fs'),os=require('os'),path=require('path');
const {inspectDocument,fillPage}=require('../src/engine.cjs'),{sdUploadsReady,chooseSDTranscript}=require('../src/sd-transcripts.cjs');
test('verified compressed upload variants are confined to their exact portal; old PNG preference remains',()=>{
 const original={kind:'课程成绩单',education_level:'本科',format:'png',filename:'fixture.png',status:'user-confirmed'};
 const variant={origin:'https://fixture.example',portal_path:'/apply',education_level:'本科',format:'pdf',filename:'compressed.pdf',status:'derived-verified'};
 const catalog={transcript_policy:{status:'user-confirmed',preferred_formats:['png','pdf']},attachments:[original],sd_transcript_variants:[variant]};
 assert.equal(chooseSDTranscript(catalog,'本科','image/png,application/pdf','https://fixture.example/apply'),variant);
 assert.equal(chooseSDTranscript(catalog,'本科','image/png,application/pdf','https://another.example/apply'),original);
 assert.equal(chooseSDTranscript(catalog,'本科','image/png','https://fixture.example/apply'),original);
});
test('hashed SD required marker prevents optional-intent skipping; current job and upload completion are verified',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'sd-required-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});try{
 await app.firstWindow();let p;for(let i=0;i<50;i++){p=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(p)break;await new Promise(r=>setTimeout(r,100));}assert.ok(p);await p.route('https://fixture.example/apply',r=>r.fulfill({contentType:'text/html',body:'<body></body>'}));await p.goto('https://fixture.example/apply');
 const field=(label,id,required)=>`<div class="apply-field-fixture"><div class="title-fixture">${label}${required?'<span class="required-asterisk-fixture"></span>':''}</div><input id="${id}" placeholder="${label}"></div>`;
 await p.setContent('<div class="job-info-fixture"><div class="title-fixture">Fixture工程师</div></div><div data-nav-id="intent"><div class="blockTitle-fixture"><span class="text-fixture">求职意向</span></div>'+field('期望城市','city',true)+field('期望岗位','role',true)+field('推荐码','referral',false)+'</div>');
 const controls=await p.evaluate(inspectDocument);assert.equal(controls.find(c=>c.labels.includes('期望城市')).required,true);assert.equal(controls.find(c=>c.labels.includes('推荐码')).required,false);
 const profile={values:{intent:[{city:'Fixture city'}]},workflow:{fill_optional_intent:false},learnedFields:[]};
 const r=await fillPage(p,profile,{});assert.equal(r.counts.filled,2,JSON.stringify(r));assert.equal(await p.locator('#role').inputValue(),'Fixture工程师');assert.equal(await p.locator('#city').inputValue(),'Fixture city');assert.equal(await p.locator('#referral').inputValue(),'');
 assert.equal((await fillPage(p,profile,{})).counts.filled,0);
 await p.setContent('<div class="apply-field-fixture"><input id="upload" type="file"><div class="sd-Upload-list-fixture"><img src="https://example.invalid/fixture.png"><div class="sd-Upload-file-name-fixture">fixture.png</div><span id="state">上传中: 100%</span></div></div>');
 assert.equal(await p.locator('#upload').evaluate(sdUploadsReady,['fixture.png']),false);await p.locator('#state').evaluate(e=>e.textContent='100 KB');assert.equal(await p.locator('#upload').evaluate(sdUploadsReady,['fixture.png']),true);assert.equal(await p.locator('#upload').evaluate(sdUploadsReady,['wrong.png']),false);
 }finally{await app.close()}
});

