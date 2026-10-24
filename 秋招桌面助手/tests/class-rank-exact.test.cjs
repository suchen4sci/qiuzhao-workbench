const {test}=require('node:test'),assert=require('node:assert/strict');
const {_electron}=require('playwright-core'),fs=require('fs'),os=require('os'),path=require('path');
const {fillPage,selectOption}=require('../src/engine.cjs');
test('rank fractions use plain input; percentage bands never improve actual rank',async()=>{
 const options=[5,10,20,30,50].map(n=>({label:'前'+n+'%',value:String(n)}));
 assert.equal(selectOption(options,'前'+(38/360*100)+'%',{rank:true}).label,'前20%');
 assert.equal(selectOption(options,'前40%',{rank:true}).label,'前50%');
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'class-rank-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{await app.firstWindow();let page;for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  const row=(id,level)=>'<div class="ux-standard-form"><div class="form-item"><label class="form-item__title">学校名称</label><input value="Fixture University"></div><div class="form-item"><label class="form-item__title">学历</label><span class="phoenix-select__calcEle">'+level+'</span></div><div class="form-item"><label class="form-item__title">班级排名</label><input id="'+id+'"></div></div>';
  await page.setContent('<section><div>教育经历</div>'+row('undergraduate','本科')+row('graduate','硕士研究生')+'</section>');
  const profile={values:{education:[{school:'Fixture University',level:'硕士研究生',classRank:'前'+(38/360*100)+'%',classRankExact:'38/360'},{school:'Fixture University',level:'本科',classRank:'前40%',classRankExact:'48/120'}]},autoProjectNames:[],autoAwardNames:[],learnedFields:[]};
  await fillPage(page,profile);assert.equal(await page.locator('#graduate').inputValue(),'38/360');assert.equal(await page.locator('#undergraduate').inputValue(),'48/120');assert.equal((await fillPage(page,profile)).counts.filled,0);
 }finally{await app.close();}
});
