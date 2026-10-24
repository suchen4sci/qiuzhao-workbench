const {_electron}=require('playwright-core');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {scanPage,fillPage,valueMatches,confirmedRecordValue}=require('../src/engine.cjs');
const field=(label,content,extra='')=>`<div class="ant-form-item" ${extra}><div class="ant-form-item-label"><label>${label}<span class="labelRequired">*</span><span class="remarkShow">?</span></label></div><div>${content}</div></div>`;
const input=(id,value='',extra='')=>`<input id="${id}" value="${value}" ${extra}>`;
const select=(id,value='')=>`<div id="${id}" class="ant-select"><div role="combobox"><div class="ant-select-selection__rendered">${value?`<div class="ant-select-selection-selected-value">${value}</div>`:'<div class="ant-select-selection__placeholder">请选择</div>'}<input style="display:none" value="opaque"></div></div></div>`;
const record=content=>`<div class="form-cell-inner">${content}</div>`;
const cell=(title,content)=>`<div class="form-cell"><div class="tit-wrap"><div class="tit"><p>${title}</p><span>必填</span></div></div><div class="form-cell-right">${content}</div></div>`;
const profile={values:{basic:[{name:'测试本人',gender:'女',height:'185',email:'fixture@example.com',phone:'123456789'}],education:[{school:'同名大学',level:'硕士研究生',department:'硕士院系',major:'电子技术'},{school:'同名大学',level:'本科',department:'本科院系',major:'电子科学'}],family:[{name:'测试父亲',relation:'父亲',company:'父亲单位',position:'经理'},{name:'测试母亲',relation:'母亲',company:'母亲单位',position:'职员'}],internship:[{company:'本人实习单位',position:'工程师'}],projects:[],awards:[],skills:[],intent:[],campus:[],languages:[],evaluation:[]},learnedFields:[],noPublications:true};
(async()=>{
 const env={...process.env,QIUZHAO_TEST:'1',QIUZHAO_USER_DATA:fs.mkdtempSync(path.join(os.tmpdir(),'engine-section-scan-'))};delete env.ELECTRON_RUN_AS_NODE;
 const app=await _electron.launch({executablePath:require('electron'),args:[path.resolve('.')],env});
 try{
  await app.firstWindow();let page;
  for(let i=0;i<50;i++){page=app.context().pages().find(p=>p.url().includes('/fixtures/demo.html'));if(page)break;await new Promise(r=>setTimeout(r,100));}
  assert.ok(page,'isolated fixture guest created');
  const html=cell('基本信息',record(field('身高',input('height'))+field('性别','<div class="ant-radio-group"><label><input type="radio" name="gender" value="opaque-m">男</label><label><input type="radio" name="gender" value="opaque-f">女</label></div>')+field('民族',select('ethnicity'))+field('现居住地','<div class="cascader-plugins-wrap">'+select('province')+select('city')+'</div>')))
   +cell('教育经历',['硕士研究生','本科'].map((level,i)=>record(field('学校',select('school'+i,'同名大学'))+field('学校',input('hidden-school'+i,'opaque-school-path'),'style="display:none"')+field('学历',select('level'+i,level))+field('院系',input('department'+i))+field('专业',select('major'+i,i?'电子科学':'')))).join(''))
   +cell('家庭关系',record(field('姓名',input('father-name','测试父亲'))+field('关系',select('father-relation','父亲'))+field('工作单位',input('father-company'))+field('职位',input('father-position')))+record(field('姓名',input('blank-name'))+field('工作单位',input('blank-company'))))
   +cell('其他证明材料',record(field('工作单位',input('unknown-company','某个旧值'))))
   +cell('声明',record(field('我确认并授权','<div class="ant-radio-group"><label><input type="radio" name="consent">确认</label></div>')));
  await page.route('https://scanner-fixture.invalid/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:html}));
  await page.goto('https://scanner-fixture.invalid/form');
  const scan=await scanPage(page,profile),byId=id=>scan.items.find(i=>i.selector==='#'+id);
  assert.equal(scan.items.filter(i=>i.antRadio).length,2,'radio groups must be scanned once');
  assert.equal(scan.items.filter(i=>i.type==='radio').length,0,'hidden radio children must not be separate fields');
  assert.equal(byId('ethnicity').hasValue,false,'placeholder is not a selected value');
  assert.equal(byId('height').label,'身高','help icon must not contaminate title');
  assert.equal(byId('department0').recordIndex,0);assert.equal(byId('department0').value,'硕士院系');
  assert.equal(byId('department1').recordIndex,1);assert.equal(byId('department1').value,'本科院系');
  assert.equal(byId('major1').status,'existing');assert.equal(byId('major1').recordIndex,1,'populated fields still require record identity');
  assert.equal(byId('father-company').value,'父亲单位');assert.equal(byId('father-position').value,'经理');
  assert.equal(byId('blank-company').status,'pending','blank family record must not inherit selected person');
  assert.equal(byId('unknown-company').match,undefined);assert.equal(byId('unknown-company').status,'pending','unknown section must never borrow internship');
  assert.equal(byId('province').componentIndex,0);assert.equal(byId('city').componentIndex,1);assert.equal(byId('city').componentCount,2);
  const componentProfile={...profile,values:{...profile.values,basic:[{...profile.values.basic[0],currentAddress:['某省','某市'],currentAddressFullPath:['某省','某市','某区']}]}};
  const twoParts=await scanPage(page,componentProfile);assert.equal(twoParts.items.find(i=>i.selector==='#city').value,'某市');
  await page.locator('.cascader-plugins-wrap').evaluate(el=>{const third=el.lastElementChild.cloneNode(true);third.id='district';el.append(third)});
  const threeParts=await scanPage(page,componentProfile);assert.equal(threeParts.items.find(i=>i.selector==='#district').componentCount,3);assert.equal(threeParts.items.find(i=>i.selector==='#district').value,'某区','full path must be selected by actual component count');
  assert.equal(scan.items.filter(i=>i.headings[0]==='声明').every(i=>i.status==='pending'),true);
  assert.equal(valueMatches({labels:[],type:'text',observedValue:'旧值'},'新值'),false);
  assert.equal(valueMatches({labels:[],type:'month',observedValue:'2024-06'},'2024-06-24',{date:true}),true);
  assert.equal(valueMatches({labels:[],type:'text',observedValue:'2024-06-01'},'2024-06-24',{date:true}),false);
  assert.equal(valueMatches({labels:[],type:'text',observedValue:'硕士'},'工学硕士',{optionAliases:{'工学硕士':['硕士']}}),true);
  const confirmedRank={classRank:'前40%',portalOverrides:[{origin:'https://specific-fixture.invalid',key:'classRank',value:'前30%'}]};
  assert.deepEqual(confirmedRecordValue(confirmedRank,'classRank','https://specific-fixture.invalid'),{value:'前30%',portalOverride:true});
  assert.deepEqual(confirmedRecordValue(confirmedRank,'classRank','https://different-fixture.invalid'),{value:'前40%',portalOverride:false});
  assert.equal(confirmedRank.classRank,'前40%','a site-specific instruction must not rewrite the fact');
  assert.ok(confirmedRecordValue({...confirmedRank,portalOverrides:[...confirmedRank.portalOverrides,...confirmedRank.portalOverrides]},'classRank','https://specific-fixture.invalid').reason);
  assert.ok(confirmedRecordValue({...confirmedRank,portalOverrides:[{origin:'https://specific-fixture.invalid',key:'classRank',value:30}]},'classRank','https://specific-fixture.invalid').reason);
  const rankPage=cell('教育经历',record(field('学校',select('rank-school','同名大学'))+field('学历',select('rank-level','本科'))+field('年级排名',select('rank'))));
  const rankProfile={...profile,values:{...profile.values,education:[{...profile.values.education[1],...confirmedRank}]}};
  for(const origin of ['https://specific-fixture.invalid','https://different-fixture.invalid']){
    await page.route(origin+'/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:rankPage}));await page.goto(origin+'/form');
    const target=(await scanPage(page,rankProfile)).items.find(i=>i.selector==='#rank');assert.equal(target.value,origin.includes('specific')?'前30%':'前40%');assert.equal(target.portalOverride,origin.includes('specific'));
  }
  const upload=field('必填成绩单','<div class="file-single-wrap"><input id="upload-file" type="file" style="display:none"><input type="file" style="display:none"><button>上传成绩单</button><div class="ant-upload-list"><a class="ant-upload-list-item-name">已有成绩单.pdf</a></div></div>');
  const dependency='<h2>基本信息</h2>'+field('邮箱',input('email','','disabled'))+field('手机号',input('phone','','disabled'))+field('姓名',input('name'))+field('身高',input('wrong-height','170'))+upload+`<script>nameField=document.getElementById('name');nameField.addEventListener('input',()=>document.getElementById('email').disabled=false);document.getElementById('email').addEventListener('input',()=>document.getElementById('phone').disabled=false);document.querySelectorAll('input[type=file]').forEach(e=>e.addEventListener('change',()=>window.uploadChanged=true));</script>`;
  await page.route('https://dependency-fixture.invalid/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:dependency}));await page.goto('https://dependency-fixture.invalid/form');
  const filled=await fillPage(page,profile,{});assert.equal(filled.counts.filled,3,JSON.stringify(filled));assert.equal(await page.locator('#email').inputValue(),'fixture@example.com');assert.equal(await page.locator('#phone').inputValue(),'123456789');assert.equal(await page.locator('#wrong-height').inputValue(),'170');
  const files=filled.fields.filter(f=>f.group==='附件');assert.equal(files.length,1,'mirror file inputs must deduplicate by upload component');assert.equal(files[0].required,true);assert.equal(files[0].status,'pending');assert.deepEqual(files[0].fileNames,['已有成绩单.pdf']);assert.equal(await page.evaluate(()=>window.uploadChanged),undefined,'scanner must never upload');
  const repeated=await fillPage(page,profile,{});assert.equal(repeated.counts.filled,0);assert.equal(repeated.counts.existing,3);assert.equal(repeated.counts.pending,2);
  const radio='<section><h2>基本信息</h2><fieldset><legend>性别</legend><input id="male" type="radio" name="native-gender" value="M"><label for="male">男</label><input id="female" type="radio" name="native-gender" value="F"><label for="female">女</label></fieldset></section>';
  await page.route('https://radio-fixture.invalid/**',route=>route.fulfill({contentType:'text/html; charset=utf-8',body:radio}));await page.goto('https://radio-fixture.invalid/form');
  const nativeScan=await scanPage(page,profile);assert.equal(nativeScan.items.length,1);assert.equal(nativeScan.items[0].nativeRadioGroup,true);assert.equal(nativeScan.items[0].status,'ready');
  const nativeFill=await fillPage(page,profile,{});assert.equal(nativeFill.counts.filled,1,JSON.stringify(nativeFill));assert.equal(await page.locator('#female').isChecked(),true);
  assert.equal((await fillPage(page,profile,{})).counts.existing,1);
  await page.setContent('<div class="edit-resume-div"><div class="mdf-tit"><p>教育经历</p></div>'+['硕士研究生','本科'].map((level,i)=>`<div id="subGroup_14_${i+1}"><dy-form><select msg="学历"><option>${level}</option></select></dy-form><dy-form><input id="wt-dept-${i}" name="14_100106_${i+1}" msg="院系"></dy-form></div>`).join('')+'</div>');
  const wtScan=await scanPage(page,profile);
  for(const [i,value] of ['硕士院系','本科院系'].entries()){const f=wtScan.items.find(x=>x.selector==='#wt-dept-'+i);assert.equal(f.label,'院系');assert.equal(f.recordIndex,i);assert.equal(f.value,value);}
  const wtFill=await fillPage(page,profile,{});assert.equal(wtFill.counts.filled,2,JSON.stringify(wtFill));
  assert.equal((await fillPage(page,profile,{})).counts.filled,0);
  await page.setContent(`<div class="edit-resume-div"><div class="mdf-tit"><p>奖励荣誉</p></div><div id="subGroup_120_1"><dy-form><dy-form-special><input type="hidden" msg="奖励名称"><input readonly school-or-subject="1"><input school-or-subject="2" data-canadd="1" ng-model="justForModelVal2" style="display:none"></dy-form-special></dy-form></div></div><script>const root=document.querySelector('dy-form-special'),display=root.querySelector('[readonly]'),editor=root.querySelector('[data-canadd]');display.onclick=()=>{display.style.display='none';editor.style.display='block';editor.focus()};editor.onblur=()=>{root.querySelector('[type=hidden]').value=editor.value;display.value=editor.value;editor.style.display='none';display.style.display='block'};</script>`);
  const awardProfile={...profile,values:{...profile.values,awards:[{name:'测试竞赛一等奖'}]}};
  const awardFill=await fillPage(page,awardProfile,{});assert.equal(awardFill.counts.filled,1,JSON.stringify(awardFill));
  assert.equal(await page.locator('input[type=hidden]').inputValue(),'测试竞赛一等奖');
  assert.equal((await fillPage(page,awardProfile,{})).counts.filled,0);
  console.log(JSON.stringify({passed:true,wintalentMsgAndIdentity:true,antRootCoverage:true,sectionIsolation:true,educationIdentity:true,familyIdentity:true,hiddenMirrorIgnored:true,helpIconIgnored:true,existingVerified:true,dependencyRescan:true,nativeRadioGroup:true,repeatIdempotent:true,requiredUploadReported:true,noAutomaticUpload:true}));
 }finally{await app.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
