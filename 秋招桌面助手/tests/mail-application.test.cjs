const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),os=require('os'),path=require('path'),{_electron}=require('playwright-core');
const {parseMailApplication}=require('../src/mail-application.cjs');
test('email links preserve recipient and draft fields, reject other protocols and header injection',()=>{
 assert.deepEqual(parseMailApplication('mailto:jobs@example.com?subject=Campus&body=Hello'),{href:'mailto:jobs@example.com?subject=Campus&body=Hello',recipients:'jobs@example.com',subject:'Campus',body:'Hello'});
 for(const u of ['javascript:alert(1)','file:///private','mailto:bad','mailto:jobs@example.com%0Afoo','mailto:jobs@example.com?subject=x%0Ay'])assert.throws(()=>parseMailApplication(u));
});
test('real portal click shows application panel, clipboard works, portal and HTTP navigation survive',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'mailto-test-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 const priorClipboard=await app.evaluate(({clipboard})=>clipboard.readText());
 try{
  await app.firstWindow();let page,ui;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));ui=app.context().pages().find(p=>p.url().includes('/src/ui/index.html'));if(page&&ui)break;await new Promise(r=>setTimeout(r,100));}
  await ui.waitForFunction(()=>!!window.desktop?.call);
  await page.route('https://mail-fixture.example/**',r=>r.fulfill({contentType:'text/html',body:'<a href="mailto:jobs@example.com?subject=Campus">Apply by email</a>'}));
  await ui.evaluate(()=>window.desktop.call('navigate','https://mail-fixture.example/'));
  await page.getByText('Apply by email').waitFor();
  const url=page.url();await page.getByText('Apply by email').click({noWaitAfter:true});
  await ui.locator('#mail-recipient').waitFor();assert.equal(await ui.locator('#mail-recipient').innerText(),'jobs@example.com');assert.equal(page.url(),url);
  await ui.locator('#mail-copy').click();assert.equal(await app.evaluate(({clipboard})=>clipboard.readText()),'jobs@example.com');
  await ui.locator('#close-panel').click();assert.equal(await page.getByText('Apply by email').isVisible(),true);
  await ui.evaluate(()=>window.desktop.call('demo'));assert(page.url().includes('/fixtures/demo.html'));
 }finally{await app.evaluate(({clipboard},text)=>clipboard.writeText(text),priorClipboard).catch(()=>{});await app.close();}
});
