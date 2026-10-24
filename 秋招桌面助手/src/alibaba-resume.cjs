const {normalize}=require('./rules.cjs');
const controls=require('./fusion-controls.cjs');
function isAlibaba(page){const u=new URL(page.url());return u.origin==='https://campus-talent.alibaba.com'&&u.pathname==='/personal/resume';}
function matchExperience(profile,name){
 const work=(profile.values.internship||[]).filter(r=>normalize(r.company)===normalize(name));
 const projects=(profile.values.projects||[]).filter(r=>require('./project-identity.cjs').projectMatches(r,name));
 return work.length+projects.length===1?(work[0]?{record:work[0],role:work[0].position}:{record:projects[0],role:projects[0].role}):null;
}
async function fillAlibaba(page,profile,cancelled=()=>false,inspect=false){
 const start=Date.now(),fields=[],checks=[];
 const byId=id=>page.locator('[id='+JSON.stringify(id)+']');
 const add=async(label,group,input,value,type='text',options={})=>{
  if(cancelled())return;
  if(value===undefined||value===null||value===''){fields.push({label,group,status:'pending',reason:'知识库没有确认资料，未猜填'});return;}
  if(await input.count()!==1){fields.push({label,group,status:'pending',reason:'控件无法唯一定位'});return;}
  try{
   const existing=type==='select'?await controls.selected(input):await input.inputValue();
   if(normalize(existing)===normalize(type==='month'?String(value).slice(0,7):value)){const field={label,group,status:'existing',reason:'已独立回读与确认资料一致'};fields.push(field);checks.push({field,input,value,type});return;}
   if(inspect){fields.push({label,group,status:'ready',reason:'可使用确认资料修补'});return;}
   if(type==='select')await controls.choose(page,input,String(value),options);
   else if(type==='month')await controls.month(page,input,value);
   else {await input.fill(String(value));await input.press('Tab');if(await input.inputValue()!==String(value))throw Error('文本回读失败');}
   const field={label,group,status:'filled',reason:'填写后已回读，保存另行核验'};fields.push(field);checks.push({field,input,value,type});
  }catch(e){fields.push({label,group,status:'pending',reason:e.message});}
 };
 const basic=profile.values.basic[0],extra=profile.alibaba||{};
 await add('身份证号','个人信息',byId('idCard'),basic.idNumber);
 await add('学校所在城市','个人信息',byId('schoolCity'),'中国-北京-北京','select',{search:true});
 await add('家庭所在城市','个人信息',byId('familyCity'),extra.familyCity,'select',{search:true});
 const education=page.locator('.tiled-item-form').filter({has:page.locator('input[id$=".academy"]')});
 for(const row of await education.all()){
  const prefix=(await row.locator('input[id$=".academy"]').getAttribute('id')).split('.')[0];
  const level=await controls.selected(byId(prefix+'.topDegree'));
  const records=profile.values.education.filter(r=>normalize(r.level)===normalize(level)||r.level==='硕士研究生'&&level==='硕士');
  if(records.length!==1){fields.push({label:'教育记录身份',group:'教育情况',status:'pending',reason:'学历不能唯一匹配知识库'});continue;}
  const r=records[0];
  await add(level+'院系','教育情况',byId(prefix+'.academy'),r.department);
  await add(level+'专业类别','教育情况',byId(prefix+'.majorCategory'),r.majorCategory,'select');
  await add(level+'专业','教育情况',byId(prefix+'.major'),r.major,'select',{search:true,replace:true});
  await add(level+'结束时间','教育情况',byId(prefix+'.timeRange').locator('input').nth(1),r.endTime,'month');
  await add(level+'导师','教育情况',byId(prefix+'.tutor'),r.supervisor||(level==='本科'?'无':undefined));
  const laboratory=r.laboratory||extra.laboratory?.[r.level];
  if(laboratory)await add(level+'实验室','教育情况',byId(prefix+'.laboratory'),laboratory,'select',{search:true});
  await add(level+'GPA','教育情况',byId(prefix+'.gpaScore'),r.gpa);
  await add(level+'国家奖学金','教育情况',byId(prefix+'.hasNationalScholarship'),extra.nationalScholarship?.[r.level],'select');
 }
 const experience=page.locator('.tiled-item-form').filter({has:page.locator('input[id$=".responsibility"]')});
 for(const row of await experience.all()){
  const prefix=(await row.locator('input[id$=".responsibility"]').getAttribute('id')).split('.')[0];
  const match=matchExperience(profile,await byId(prefix+'.name').inputValue());
  if(!match){fields.push({label:'实习/项目身份',group:'实习/项目经历',status:'pending',reason:'名称无法唯一对应实习或项目，未按序套填'});continue;}
  await add('职位或职责','实习/项目经历',byId(prefix+'.responsibility'),match.role);
  await add('工作描述','实习/项目经历',byId(prefix+'.description'),match.record.description);
 }
 const lang=page.locator('input[id$=".language"]');
 if(await lang.count()===1){const prefix=(await lang.getAttribute('id')).split('.')[0];await add('语言','语言能力',lang,'英语','select');await add('掌握程度','语言能力',byId(prefix+'.languageRank'),'精通','select');}
 const competition=profile.values.projects.find(r=>r.sourceLabel?.includes('国央企'));
 await add('大赛经历','实习/项目经历',byId('competitionsExp'),competition?[competition.name,competition.startTime+'至'+competition.endTime,competition.description].join('\n'):undefined);
 await add('奖励与荣誉','实习/项目经历',byId('reward'),basic.awardsSummary);
 await add('其它','其他信息',byId('otherInformation'),profile.values.evaluation?.[0]?.description);
 await add('招聘信息来源','其他信息',byId('informationSource'),extra.recruitmentSource||'BOSS直聘','select');
 // Verify again after all dependency callbacks, not just immediately after each input.
 for(const {field,input,value,type} of checks){
  try{const actual=type==='select'?await controls.selected(input):await input.inputValue();
   if(normalize(actual)!==normalize(type==='month'?String(value).slice(0,7):value)){field.status='failed';field.reason='整页回读发现控件被清空或改变，未计为成功';}
  }catch(e){field.status='failed';field.reason='整页回读失败：'+e.message;}
 }
 const counts={filled:0,ready:0,pending:0,existing:0,failed:0,notApplicable:0};for(const f of fields)counts[f.status]++;
 return {fields,counts,elapsedMs:Date.now()-start,steps:[]};
}
module.exports={isAlibaba,matchExperience,fillAlibaba};
