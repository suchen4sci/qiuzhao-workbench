const {_electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('fs'),os=require('os'),path=require('path');
const {fillPage,scanPage}=require('../src/engine.cjs');
(async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'sd-form-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  const select=(id,placeholder,options)=>`<div class="sd-Dropdown-container-test"><label class="sd-Select-container-test"><span class="sd-Input-display-value-test"></span><input id="${id}" placeholder="${placeholder}" data-options="${options}"></label></div>`;
  const field=(name,html)=>`<div class="apply-field-test"><div class="title-test">${name}</div>${html}</div>`;
  await page.setContent(`<div data-nav-id="education"><div class="blockTitle-test"><span class="text-test">教育背景</span></div><div class="apply-fields-test">
  ${field('学校名称',select('school','请输入就读学校','测试大学'))}
  ${field('学历',select('level','请选择','本科|硕士'))}
  ${field('就读时间',select('sy','年','2024|2025')+select('sm','月','1|9')+select('ey','年','2026|2027')+select('em','月','1|6'))}
  </div></div><script>
  document.querySelectorAll('input').forEach(input=>{input.onclick=()=>{document.querySelectorAll('.sd-Dropdown-dropdown-test').forEach(n=>n.remove());const p=document.createElement('div');p.className='sd-Dropdown-dropdown-test';input.closest('div').append(p);for(const v of input.dataset.options.split('|')){const o=document.createElement('div');o.className='sd-Menu-content-item-test';o.textContent=v;o.onclick=()=>{input.previousElementSibling.textContent=v;input.placeholder='';p.remove();if(input.id==='sy'||input.id==='ey'){const m=document.getElementById(input.id==='sy'?'sm':'em');m.previousElementSibling.textContent='1';m.placeholder='';}};p.append(o);}}});
  </script>`);
  const profile={values:{education:[{school:'测试大学',level:'硕士研究生',startTime:'2024-09-01',endTime:'2027-06-20'}]},learnedFields:[],autoProjectNames:[],autoAwardNames:[]};
  const r=await fillPage(page,profile,{});assert.equal(r.counts.filled,6,JSON.stringify(r));
  assert.equal(await page.locator('#sm').evaluate(e=>e.previousElementSibling.textContent),'9');
  assert.equal(await page.locator('#em').evaluate(e=>e.previousElementSibling.textContent),'6');
  const again=await fillPage(page,profile,{});assert.equal(again.counts.filled,0);assert.equal(again.counts.existing,6);
  const scan=await scanPage(page,profile,{});assert.equal(scan.items.filter(i=>i.match).length,6);
  await page.evaluate(()=>{const e=document.getElementById('school');e.dataset.options='公司官网';e.previousElementSibling.textContent='';});
  const {fillSelect}=require('../src/sd-controls.cjs');
  assert.equal(await fillSelect(page.mainFrame(),page.locator('#school'),'官网',{optionAliases:{'官网':['公司官网','官方网站']}}),'公司官网');
  await page.evaluate(()=>{document.getElementById('school').dataset.options='公司官网|官方网站';});
  await assert.rejects(()=>fillSelect(page.mainFrame(),page.locator('#school'),'官网',{optionAliases:{'官网':['公司官网','官方网站']}}),/AMBIGUOUS/);
  await page.evaluate(()=>{document.querySelectorAll('.sd-Dropdown-dropdown-test').forEach(n=>n.remove());document.getElementById('school').previousElementSibling.textContent='测试大学';});
  await page.evaluate(()=>{const p=document.createElement('div');p.className='apply-form-preview';p.textContent='预览';document.body.append(p);document.querySelector('#sm').previousElementSibling.textContent='1';});
  const previewRun=await fillPage(page,profile,{});
  assert.equal(previewRun.counts.filled,0);
  assert.equal(await page.locator('#sm').evaluate(e=>e.previousElementSibling.textContent),'1','preview must never mutate the covered editor');
  await page.setContent('<div data-nav-id="practice"><div class="blockTitle-test"><span class="text-test">实习经历</span></div><div class="apply-fields-test">'+field('公司名称','<input value="测试公司">')+field('起止时间','<label><input id="ongoing" type="checkbox">至今</label>')+'</div></div>');
  const endedProfile={values:{internship:[{company:'测试公司',endTime:'2026-08-29'}]},learnedFields:[]};
  assert.equal((await scanPage(page,endedProfile)).items.find(i=>i.type==='checkbox').status,'notApplicable');
  await page.locator('#ongoing').check();
  assert.equal((await scanPage(page,endedProfile)).items.find(i=>i.type==='checkbox').status,'pending','checked ongoing must not be silently accepted or cleared');
  await page.setContent('<div data-upload><input type="file" style="display:none"><button class="file_upload-btn">测试简历.pdf</button></div><div data-upload><input type="file" style="display:none"><button class="file_upload-btn">上传照片</button></div>');
  const attachments=await scanPage(page,profile,{});
  assert.deepEqual(attachments.items.filter(i=>i.type==='file').map(i=>i.fileNames),[['测试简历.pdf'],[]]);
  assert.equal(attachments.items.find(i=>i.fileNames?.length).status,'pending','filename evidence alone must not imply verified attachment');
  await page.setContent('<div class="sd-Dropdown-container-test"><input id="birthday" readonly><div id="calendar" class="sd-panal-menu-wrapper-test" style="display:none"></div></div>');
  await page.evaluate(()=>{
   const input=document.getElementById('birthday'),panel=document.getElementById('calendar');
   const days=()=>{panel.innerHTML='<span class="sd-basic-selector-year-test">1980年</span><span class="sd-basic-selector-month-test">十月</span><table><tr><td class="sd-basic-item-wrapper-test sd-basic-fade-test"><div class="sd-basic-date-item-test">26</div></td><td class="sd-basic-item-wrapper-test"><div class="sd-basic-date-item-test">26</div></td></tr></table>';panel.querySelector('[class*=selector-year]').onclick=()=>{panel.innerHTML='<span class="sd-basic-selector-year-test">1970-1989</span><div class="sd-basic-item-wrapper-test">1980</div>';panel.querySelector('[class*=item-wrapper]').onclick=days;};panel.querySelector('[class*=selector-month]').onclick=()=>{panel.innerHTML='<div class="sd-basic-year-item-test">三月</div>';panel.firstElementChild.onclick=()=>{days();panel.querySelector('[class*=selector-month]').textContent='三月';panel.querySelector('td:not([class*=fade])').onclick=()=>{input.value='1980-03-26';panel.style.display='none';};};};};
   input.onclick=()=>{panel.style.display='block';days();};
  });
  await require('../src/sd-controls.cjs').fillDate(page.mainFrame(),page.locator('#birthday'),'1980-03-26');
  assert.equal(await page.locator('#birthday').inputValue(),'1980-03-26','day-calendar year return and faded neighbouring dates are handled');
  await page.setContent('<div data-nav-id="interview">'+field('面试站点','<span class="sd-Input-display-value-test"></span><input id="site">')+'</div>');
  await page.evaluate(()=>{const input=document.getElementById('site');input.onclick=()=>{const root=input.parentElement;const first=document.createElement('div');first.className='sd-Menu-content-item-test';first.textContent='线上';root.append(first);first.onclick=()=>{const leaf=document.createElement('div');leaf.className='sd-Menu-content-item-test';leaf.textContent='线上面试';root.append(leaf);leaf.onclick=()=>{input.previousElementSibling.textContent='线上面试';first.remove();leaf.remove();};};};});
  const reviewRoot=fs.mkdtempSync(path.join(os.tmpdir(),'sd-reviewed-')),reviewDir=path.join(reviewRoot,'知识库/06-网站适配'),u=new URL(page.url());fs.mkdirSync(reviewDir,{recursive:true});
  fs.writeFileSync(path.join(reviewDir,'SD逐字段已核验.json'),JSON.stringify([{status:'verified',origin:u.origin,path:u.pathname,hash:u.hash,fields:[{section:'interview',label:'面试站点',kind:'cascader',steps:['线上','线上面试'],value:'线上面试'}]}]));
  await require('../src/sd-reviewed-fields.cjs').prepare(page,{workspaceRoot:reviewRoot});
  assert.equal(await page.locator('#site').evaluate(e=>e.previousElementSibling.textContent),'线上面试','must select leaf, not just parent');
  await require('../src/sd-reviewed-fields.cjs').prepare(page,{workspaceRoot:reviewRoot});
  assert.equal(await page.locator('[class*=sd-Menu-content-item]').count(),0,'repeat must preserve selected leaf without reopening');
  console.log(JSON.stringify({passed:true,fields:6,splitDateDefaultCorrected:true,labelsSurvivePlaceholderRemoval:true,repeatPreserved:true,unrelatedDomain:true,previewReadOnly:true,reviewedCascaderLeaf:true}));
 }finally{await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
