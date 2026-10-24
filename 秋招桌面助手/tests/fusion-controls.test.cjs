const {test}=require('node:test'),assert=require('node:assert/strict');
const {_electron}=require('playwright-core');const path=require('path'),fs=require('fs'),os=require('os');
const {choose,selected}=require('../src/fusion-controls.cjs');
test('search input text is not a selected Fusion value; selection survives blur and rerun',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'fusion-test-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{await app.firstWindow();let p;for(let i=0;i<50;i++){p=app.context().pages().find(p=>p.url().includes("/fixtures/demo.html"));if(p)break;await new Promise(r=>setTimeout(r,100));}assert.ok(p);await p.setContent(`<div class="next-select"><span class="next-select-values"></span><input id="lab"></div><button>Save</button><script>
 const input=document.querySelector('input');input.onblur=()=>input.value='';input.onclick=()=>{if(document.querySelector('.next-menu-item'))return;const e=document.createElement('div');e.className='next-menu-item';e.textContent='Fixture laboratory';e.onclick=()=>{document.querySelector('.next-select-values').textContent=e.textContent;e.remove()};document.body.append(e)};
 </script>`);const l=p.locator('#lab');await l.fill('Fixture laboratory');await l.press('Tab');assert.equal(await selected(l),'');
 assert.equal(await choose(p,l,'Fixture laboratory',{search:true}),true);assert.equal(await selected(l),'Fixture laboratory');assert.equal(await l.inputValue(),'');
 assert.equal(await choose(p,l,'Fixture laboratory',{search:true}),false);assert.equal(await p.locator('.next-menu-item').count(),0);
 }finally{await app.close()}
});


