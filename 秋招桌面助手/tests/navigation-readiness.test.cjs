const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),http=require('node:http');
const {_electron}=require('playwright-core');
test('desktop navigation returns while an image is pending, and the image still finishes',async()=>{
 let imageResponse,releaseImage;
 const requested=new Promise(resolve=>{releaseImage=resolve;});
 const server=http.createServer((req,res)=>{
  if(req.url==='/slow.svg'){imageResponse=res;releaseImage();return;}
  res.setHeader('Content-Type','text/html');res.end('<title>Slow asset fixture</title><input id="name" value="retained"><img id="slow" src="/slow.svg">');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+server.address().port+'/';
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'qiuzhao-ready-'))};delete env.ELECTRON_RUN_AS_NODE;
 let app,timer;
 try{
  app=await _electron.launch({executablePath:require('electron'),args:[path.resolve(__dirname,'..')],env});
  const ui=await app.firstWindow();await ui.waitForSelector('#application-tabbar');
  const start=Date.now();
  await Promise.race([ui.evaluate(url=>window.desktop.call('navigate',url),url),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('navigation waited for unfinished image')),5000);})]);clearTimeout(timer);
  await requested;
  const page=app.context().pages().find(p=>p.url()===url);assert(page);
  assert.equal(await page.locator('#name').inputValue(),'retained');
  assert.equal(await page.locator('#slow').evaluate(image=>image.complete),false);
  console.log('Navigation ready with image pending: '+(Date.now()-start)+'ms');
  imageResponse.setHeader('Content-Type','image/svg+xml');imageResponse.end('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');
  await page.waitForFunction(()=>document.getElementById('slow').complete);
 }finally{clearTimeout(timer);imageResponse?.end();if(app)await app.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
