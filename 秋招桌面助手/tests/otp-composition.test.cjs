const {test}=require('node:test'),assert=require('node:assert/strict');
const {_electron}=require('playwright-core'),fs=require('fs'),os=require('os'),path=require('path');
const {installOtpCompositionGuard}=require('../src/otp-composition.cjs');
test('one physical OTP stroke advances once, two strokes distribute two digits, paste and backspace stay usable',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'otp-composition-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  await page.setContent('<div role="dialog">'+Array.from({length:6},(_,i)=>'<input class="code-input" type="number" data-id="'+i+'">').join('')+'</div><input id="normal">');
  await page.evaluate(()=>{window.commits=0;window.normalInputs=0;document.addEventListener('keydown',e=>{if(e.target.classList.contains('code-input')&&e.key==='Backspace'){e.preventDefault();e.target.value='';e.target.previousElementSibling?.focus();}});document.addEventListener('input',e=>{if(e.target.classList.contains('code-input')){window.commits++;const inputs=[...document.querySelectorAll('.code-input')],index=inputs.indexOf(e.target),text=e.target.value;for(let j=0;j<text.length&&index+j<inputs.length;j++)inputs[index+j].value=text[j];inputs[Math.min(index+Math.max(1,text.length),5)].focus();}else window.normalInputs++;});});
  const send=async()=>page.evaluate(()=>{
   const edit=(composing,cancelable)=>{const e=document.activeElement,before=new InputEvent('beforeinput',{bubbles:true,cancelable,inputType:composing?'insertCompositionText':'insertText',isComposing:composing,data:'1'});if(e.dispatchEvent(before)){e.value+='1';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:before.inputType,isComposing:composing,data:'1'}));}};
   document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Process'}));edit(true,false);edit(false,true);document.activeElement.dispatchEvent(new KeyboardEvent('keyup',{bubbles:true,key:'Process'}));
  });
  await page.locator('.code-input').first().focus();await send();assert.equal(await page.evaluate(()=>window.commits),2,'original widget duplicates IME commit');
  await page.evaluate(()=>{document.querySelectorAll('.code-input').forEach(i=>i.value='');window.commits=0;delete window.__qiuzhaoOtpCompositionGuardV3;});
  await page.evaluate(installOtpCompositionGuard);await page.evaluate(installOtpCompositionGuard);
  await page.locator('.code-input').first().focus();await send();
  assert.equal(await page.evaluate(()=>window.commits),1);assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'1');
  await send();assert.equal(await page.evaluate(()=>window.commits),2);assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'2');
  assert.deepEqual(await page.locator('.code-input').evaluateAll(es=>es.map(i=>i.value)),['1','1','','','','']);
  await page.evaluate(()=>{const target=document.activeElement;target.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Process'}));target.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:false,isComposing:true,inputType:'insertCompositionText',data:'2'}));target.value='2';target.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,inputType:'insertCompositionText',data:'2'}));const next=document.activeElement;next.dispatchEvent(new InputEvent('beforeinput',{bubbles:true,cancelable:false,inputType:'insertText',data:'2'}));next.value='2';next.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'2'}));});
  assert.deepEqual(await page.locator('.code-input').evaluateAll(es=>es.map(i=>i.value)),['1','1','2','','',''],'non-cancelable duplicate must restore the next box');
  await page.locator('.code-input').nth(3).evaluate(e=>{e.value='34';e.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertFromPaste',data:'34'}));});
  assert.deepEqual(await page.locator('.code-input').evaluateAll(es=>es.map(i=>i.value)),['1','1','2','3','4','']);
  await page.locator('.code-input').nth(4).focus();await page.keyboard.press('Backspace');assert.equal(await page.locator('.code-input').nth(4).inputValue(),'');assert.equal(await page.evaluate(()=>document.activeElement.dataset.id),'3');
  await page.locator('#normal').evaluate(e=>e.dispatchEvent(new InputEvent('input',{bubbles:true,isComposing:true,data:'字'})));assert.equal(await page.evaluate(()=>window.normalInputs),1);
 }finally{await app.close();}
});
