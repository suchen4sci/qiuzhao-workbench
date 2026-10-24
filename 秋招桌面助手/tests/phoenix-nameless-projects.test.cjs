const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{_electron}=require('playwright-core');
const {ensureProjects}=require('../src/add-projects.cjs');
test('nameless project section is filled twice without leaking into campus practice',async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'nameless-projects-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;
  for(let i=0;i<80;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}assert.ok(page);
  await page.setContent('<section id="projects"><h2>项目经历</h2><div class="ux-standard-form"><div class="form-item"><div class="form-item__title">项目描述</div><textarea></textarea></div></div><button onclick="this.before(this.previousElementSibling.cloneNode(true))">添加项目经历</button></section><section><h2>在校实践</h2><div class="ux-standard-form"><div class="form-item"><div class="form-item__title">实践名称</div><input id="practice"></div></div><button>添加在校实践</button></section>');
  const profile={autoProjectNames:['甲项目','乙项目'],values:{projects:[{name:'甲项目',description:'甲的研究内容'},{name:'乙项目',description:'乙的研究内容'}]}};
  await ensureProjects(page,profile);await ensureProjects(page,profile);
  assert.equal(await page.locator('#projects .ux-standard-form').count(),2);
  assert.equal(await page.locator('#projects textarea').nth(0).inputValue(),'项目：甲项目\n甲的研究内容');
  assert.equal(await page.locator('#projects textarea').nth(1).inputValue(),'项目：乙项目\n乙的研究内容');
  assert.equal(await page.locator('#practice').inputValue(),'');
 }finally{await app.close();}
});
