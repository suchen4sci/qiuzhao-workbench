const {test}=require('node:test'),assert=require('node:assert/strict');
const {scopeMatches,identityMatches}=require('../src/phoenix-verified-fields.cjs');
test('reviewed conditional rows are completed before adding and repeat without duplicates',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {_electron}=require('playwright-core');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'reviewed-rows-'));
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:root};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;
  for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(page);
  await page.setContent('<main></main><button>添加获奖情况</button>');
  await page.evaluate(()=>{
   const add=()=>{
    const row=document.createElement('div');row.className='ux-standard-form';
    row.innerHTML='<div class="form-item"><label class="form-item__text">是否有获奖情况</label><div class="phoenix-radio-group"><div class="phoenix-radio"><span>是</span></div></div></div>';
    row.querySelector('.phoenix-radio').onclick=()=>{
     row.querySelector('.phoenix-radio').classList.add('phoenix-radio--checked');
     if(row.querySelector('input'))return;
     for(const label of ['获奖项','获奖级别']){const f=document.createElement('div');f.className='form-item';f.innerHTML='<label class="form-item__text">'+label+'</label><input>';row.append(f);}
    };document.querySelector('main').append(row);
   };
   document.querySelector('button').onclick=()=>{if([...document.querySelectorAll('input')].some(e=>!e.value))return;add();};add();
  });
  const u=new URL(page.url()),folder=path.join(root,'知识库/06-网站适配');fs.mkdirSync(folder,{recursive:true});
  const rule={status:'verified',origin:u.origin,path:u.pathname,records:['甲奖','乙奖'].map(name=>({identity:{获奖项:name},create:{button:'添加获奖情况',gate:'是否有获奖情况'},fields:{是否有获奖情况:'是',获奖项:name,获奖级别:'校级'}}))};
  fs.writeFileSync(path.join(folder,'Phoenix逐字段已核验.json'),JSON.stringify([rule]));
  const {prepare}=require('../src/phoenix-verified-fields.cjs');
  await prepare(page,{workspaceRoot:root});await prepare(page,{workspaceRoot:root});
  assert.equal(await page.locator('.ux-standard-form').count(),2);
  assert.deepEqual(await page.locator('input').evaluateAll(es=>es.map(e=>e.value)),['甲奖','校级','乙奖','校级']);
  await page.locator('input').nth(1).fill('本人已有内容');await prepare(page,{workspaceRoot:root});
  assert.equal(await page.locator('input').nth(1).inputValue(),'本人已有内容');
 }finally{await app.close();}
});
test('verified fields stay within exact employer and form path',()=>{
 const r={status:'verified',origin:'https://fixture.zhiye.com',path:'/form'};
 assert.equal(scopeMatches(r,r.origin+'/form?job=x'),true);
 assert.equal(scopeMatches(r,'https://other.zhiye.com/form'),false);
 assert.equal(scopeMatches(r,r.origin+'/campus'),false);
 assert.equal(scopeMatches({...r,status:'draft'},r.origin+'/form'),false);
});
test('same university records require their own degree identity',()=>{
 const id={'学校名称':'示例大学','学历':'硕士研究生'};
 assert.equal(identityMatches(id,{...id}),true);
 assert.equal(identityMatches(id,{'学校名称':'示例大学','学历':'本科'}),false);
 assert.equal(identityMatches({},{}),false);
});
test('shared-host invitation rules require the reviewed tenant and page code',()=>{
 const r={status:'verified',origin:'https://shared.example',path:'/PageHome/Index',query:{keyName:'ExampleTenant',pageCode:'RecruitPerfectResume'}};
 assert.equal(scopeMatches(r,r.origin+r.path+'?keyName=ExampleTenant&pageCode=RecruitPerfectResume&token=temporary'),true);
 assert.equal(scopeMatches(r,r.origin+r.path+'?keyName=AnotherTenant&pageCode=RecruitPerfectResume'),false);
 assert.equal(scopeMatches(r,r.origin+r.path+'?keyName=ExampleTenant&pageCode=AnotherPage'),false);
 assert.equal(scopeMatches(r,r.origin+r.path),false);
});
test('paged records can be absent but duplicate identities remain errors',async()=>{
 const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
 const {prepare}=require('../src/phoenix-verified-fields.cjs');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'phoenix-paged-'));
 try{
  const folder=path.join(root,'知识库/06-网站适配');fs.mkdirSync(folder,{recursive:true});
  const identity={'学校名称':'示例大学','学历':'硕士研究生'};
  fs.writeFileSync(path.join(folder,'Phoenix逐字段已核验.json'),JSON.stringify([{status:'verified',origin:'https://fixture.zhiye.com',path:'/form',records:[{identity,onlyWhenPresent:true,fields:{'成绩(GPA)':'3.50'}}]}]));
  let rows=[];
  const page={url:()=> 'https://fixture.zhiye.com/form',locator:()=>({evaluateAll:async()=>rows})};
  await prepare(page,{workspaceRoot:root});
  rows=[identity,identity];
  await assert.rejects(prepare(page,{workspaceRoot:root}),/身份不唯一/);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
