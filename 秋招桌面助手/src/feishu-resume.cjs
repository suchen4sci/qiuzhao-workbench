const {normalize}=require('./rules.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
async function isFeishuResume(page){return await page.locator('.atsx-form [data-cy="education[0].school"]').count()===1&&await page.locator('.createFormSection-container').count()>0;}
async function selectValue(page,field,value){
 const root=field.locator('.atsx-select').first();
 const read=()=>root.evaluate(e=>e.querySelector('.atsx-select-selection-selected-value')?.textContent.trim()||e.querySelector('input')?.value||'');
 const panel=page.locator('.atsx-select-dropdown:visible:not(.slide-up-leave):not(.slide-up-leave-active)');
 const combo=await root.evaluate(e=>e.classList.contains('atsx-select-combobox'));
 if(normalize(await read())===normalize(value))return false;
 await field.locator('.atsx-form-item-label').click({timeout:1500});
 if(combo)await root.locator('input').fill(value,{timeout:2000});else await root.click({timeout:2000});
 await panel.waitFor({timeout:3000});
 let option=panel.locator('.atsx-select-dropdown-menu-item').filter({hasText:exact(value)});
 if(!await option.count()){
  const input=root.locator('input');if(await input.count()===1){await input.fill(value,{timeout:2000});await option.first().waitFor({timeout:3000});}
 }
 if(await option.count()!==1)throw Error('下拉选项不唯一或不可用：'+value);
 await option.click({timeout:2000});
 if(normalize(await read())!==normalize(value))throw Error('下拉回读不一致');return true;
}
async function setPeriod(page,field,start,end){
 let changed=false;const labels=field.locator('.atsx-date-picker-period-month-label');
 if(await labels.count()!==2)throw Error('起止日期控件结构不明确');
 for(const [index,raw] of [[0,start],[1,end]]){
  const wanted=String(raw||'').slice(0,7);if(!/^\d{4}-\d{2}$/.test(wanted))throw Error('日期缺少确认年月');
  const label=labels.nth(index);if((await label.innerText()).replace(/\s/g,'')===wanted)continue;
  await label.click({timeout:2000});const panel=page.locator('.atsx-date-picker-dropdown:visible');await panel.waitFor({timeout:2000});
  for(const part of wanted.split('-')){const option=panel.locator('.atsx-date-picker-period-month-panel-list-item').filter({hasText:exact(part)});if(await option.count()!==1)throw Error('年月选项不唯一：'+part);await option.click({timeout:2000});}
  if((await label.innerText()).replace(/\s/g,'')!==wanted)throw Error('起止年月回读失败');changed=true;
 }
 return changed;
}
async function fillFeishuResume(page,profile,cancelled=()=>false){
 const started=Date.now(),items=[];let sequence=0;
 const add=(group,label,status,reason='')=>items.push({id:'atsx-'+sequence++,label,status,reason,match:group?{groupId:group,key:label}:undefined});
 const field=cy=>page.locator('.atsx-form-item').filter({has:page.locator('[data-cy="'+cy+'Input"]')}).or(page.locator('.atsx-form-item[data-cy="'+cy+'"]'));
 const act=async(group,label,fn)=>{if(cancelled())return;try{add(group,label,await fn()?'filled':'existing','已独立回读；保存状态另行核验');}catch(e){add(group,label,'pending',e.message);await page.getByText('基本信息',{exact:true}).click({timeout:1000}).catch(()=>{});}};
 const text=async(f,value)=>{if(value===undefined||value===null||value==='')throw Error('知识库未确认');const input=f.locator('input:not(.atsx-select-search__field),textarea').filter({visible:true}).first();if(await input.inputValue()===String(value))return false;await input.fill(String(value),{timeout:2000});await input.press('Tab');if(await input.inputValue()!==String(value))throw Error('文本回读失败');return true;};
 await act('basic','姓名',()=>text(field('name'),profile.values.basic[0].name));
 await act('basic','手机号码',async()=>{const f=field('phone');await selectValue(page,f,'+86');const i=f.locator('.atsx-phone-input');const value=profile.values.basic[0].phone;if(await i.inputValue()===value)return false;await i.fill(value);await i.press('Tab');if(await i.inputValue()!==value)throw Error('手机号回读失败');return true;});
 await act('basic','邮箱',()=>text(field('email'),profile.values.basic[0].email));
 const transfer=page.locator('#accept_transfer_preferred_city');
 if(profile.values.intent?.[0]?.acceptLocationAdjustment==='是')await act('intent','接受城市调剂',async()=>{if(await transfer.isChecked())return false;await transfer.locator('xpath=../..').click();if(!await transfer.isChecked())throw Error('调剂状态未生效');return true;});
 const section=title=>page.locator('.createFormSection-container').filter({has:page.locator('.createFormSection-text').filter({hasText:exact(title)})});
 async function sync(title,prefix,identityKey,records,fill){
  const container=section(title);if(await container.count()!==1)return;
  const identityFields=()=>container.locator('.atsx-form-item[data-cy]').filter({has:page.locator('input[id$=".'+identityKey+'"]')});
  const rowIndex=f=>f.getAttribute('data-cy').then(c=>Number(c.match(/\[(\d+)\]/)[1]));
  const readIdentity=async f=>{const select=f.locator('.atsx-select');return await select.count()?select.evaluate(e=>e.querySelector('.atsx-select-selection-selected-value')?.textContent.trim()||e.querySelector('input')?.value||''):f.locator('input,textarea').first().inputValue();};
  for(const record of records){if(cancelled())return;let chosen;
   for(const f of await identityFields().all()){
    const name=await readIdentity(f),index=await rowIndex(f);
    if(prefix==='education'){
     const degree=await field(prefix+'['+index+'].degree').evaluate(e=>e.querySelector('.atsx-select-selection-selected-value')?.textContent.trim()||e.querySelector('input')?.value||'');
     const major=await field(prefix+'['+index+'].fieldOfStudy').locator('input').inputValue();
     if((!name||normalize(name)===normalize(record.school))&&((degree&&normalize(degree)===normalize(record.level.replace('研究生','')))||(!degree&&(!major||normalize(major)===normalize(record.major))))){chosen=index;break;}
    }else if(normalize(name)===normalize(record.identity)||!name){chosen=index;break;}
   }
   if(chosen===undefined){const count=await identityFields().count();const buttons=container.getByText('添加',{exact:true});if(await buttons.count()!==1){add(null,title,'pending','记录添加入口不唯一');return;}await buttons.click({timeout:2000});await identityFields().nth(count).waitFor({timeout:2000});chosen=await rowIndex(identityFields().nth(count));}
   await fill(prefix+'['+chosen+']',record);
  }
 }
 await sync('教育经历','education','school',profile.values.education,async(id,r)=>{
  await act('education','学校名称 '+r.level,()=>selectValue(page,field(id+'.school'),r.school));
  await act('education','学历 '+r.level,()=>selectValue(page,field(id+'.degree'),r.level.replace('研究生','')));
  await act('education','专业 '+r.level,()=>text(field(id+'.fieldOfStudy'),r.major));
  await act('education','起止年月 '+r.level,()=>setPeriod(page,field(id+'.period'),r.startTime,r.endTime));
 });
 await sync('实习经历','internship','company',profile.values.internship.map(r=>({...r,identity:r.company})),async(id,r)=>{
  for(const [key,value] of [['company',r.company],['title',r.position],['desc',r.description]])await act('internship',key+' '+r.company,()=>text(field(id+'.'+key),value));
  await act('internship','起止年月',()=>setPeriod(page,field(id+'.period'),r.startTime,r.endTime));
 });
 await sync('项目经历','project','name',profile.values.projects.filter(r=>(profile.autoProjectNames||[]).includes(r.name)).map(r=>({...r,identity:r.name})),async(id,r)=>{
  for(const [key,value] of [['name',r.name],['role',r.role],['desc',r.description]])await act('projects',key+' '+r.name,()=>text(field(id+'.'+key),value));
  await act('projects','起止年月 '+r.name,()=>setPeriod(page,field(id+'.period'),r.startTime,r.endTime));
 });
 await sync('获奖','award','title',profile.values.awards.map(r=>({...r,identity:r.name})),async(id,r)=>{
  await act('awards','名称 '+r.name,()=>text(field(id+'.title'),r.name));
  await act('awards','获奖年份 '+r.name,()=>text(field(id+'.date'),String(r.date||'').slice(0,4)));
  await act('awards','描述 '+r.name,()=>text(field(id+'.desc'),[r.date,r.description].filter(Boolean).join('\n')));
 });
 await sync('语言能力','language','language',[{identity:'英语'}],async(id)=>{
  await act('languages','英语',()=>selectValue(page,field(id+'.language'),'英语'));
  await act('languages','英语掌握程度',()=>selectValue(page,field(id+'.proficiency'),'无障碍沟通'));
 });
 // Exam scores have no separate fields here. Keep them in confirmed self evaluation.
 const evaluation=section('自我评价').locator('.atsx-form-item').filter({has:page.locator('textarea')});
 const exams=(profile.values.languages||[]).filter(r=>['雅思','大学英语六级'].includes(r.name)).map(r=>r.name+' '+r.score+'分').join('；');
 const body=profile.values.evaluation[0].description;
 const evaluationText=exams&&!/六级/.test(body)?body+'\n语言成绩：'+exams+'。':body;
 await act('evaluation','自我评价',()=>text(evaluation,evaluationText));
 const uploaded=await page.locator('.atsx-upload .uploadFile-loadedWrapper').count();
 add(null,'附件简历',uploaded?'existing':'pending',uploaded?'页面显示已上传附件；未重新解析覆盖，未声称核验正文':'尚未显示已上传简历，需要核对对应文件');
 add(null,'意向城市及内推码','existing','保留当前已有北京和内推码，未替换成其他公司的码');
 add(null,'项目链接、作品、社交账号','notApplicable','暂无对应确认资料，不编造链接或新增空记录');
 const emptyRequired=await page.locator('.atsx-form-item').evaluateAll(es=>es.filter(f=>f.getClientRects().length&&f.querySelector('.atsx-form-item-required')).filter(f=>{
  const selected=f.querySelector('.atsx-select-selection-selected-value,.atsx-select-selection__choice');
  if(selected?.textContent.trim())return false;
  const periods=[...f.querySelectorAll('.atsx-date-picker-period-month-label')];
  if(periods.length===2&&periods.every(e=>/^\d{4}-\d{2}$/.test(e.textContent.replace(/\s/g,''))))return false;
  return ![...f.querySelectorAll('input:not([type=hidden]),textarea')].some(i=>i.type!=='checkbox'&&i.value.trim());
 }).map(f=>f.querySelector('.customResumeForm-fieldName')?.textContent||f.querySelector('.atsx-form-item-label')?.textContent||'未标注必填项'));
 for(const label of emptyRequired)add(null,label,'pending','独立检查发现必填项为空，未用默认值掩盖');
 add(null,'保存与提交','pending','本页只有提交简历，未触发最终投递；当前字段快照另行保存');
 return require('./engine.cjs').report({items,frameFailures:[]},Date.now()-started);
}
module.exports={isFeishuResume,selectValue,setPeriod,fillFeishuResume};
