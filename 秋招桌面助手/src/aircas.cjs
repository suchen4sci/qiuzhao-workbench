const {executeControl}=require('./control-dispatcher.cjs');
function isAircas(page){const u=new URL(page.url());return u.hostname==='zhaopin.aircas.ac.cn' && u.pathname==='/system/userInfo/updateUserInfo';}
async function calendar(page,input,value){
if(!/^\d{4}-\d{2}-\d{2}$/.test(value))throw Error('需要已确认完整日期');
await input.press('Tab');await input.click();await page.locator('.datetimepicker-days:visible .switch').click({timeout:2000});await page.locator('.datetimepicker-months:visible .switch').click({timeout:2000});
const [y,m,d]=value.split('-').map(Number),years=page.locator('.datetimepicker-years:visible');
for(let n=0;n<20;n++){const target=years.locator('.year').filter({hasText:new RegExp('^'+y+'$')});if(await target.count()){await target.click();break;}const first=Number(await years.locator('.year').first().textContent());await years.locator(y<first?'.prev':'.next').click();}
await page.locator('.datetimepicker-months:visible .month').nth(m-1).click();await page.locator('.datetimepicker-days:visible .day:not(.old):not(.new)').filter({hasText:new RegExp('^'+d+'$')}).click();
if(await input.inputValue()!==value)throw Error('日历回读失败');
}
async function fillAircas(page,profile,cancelled=()=>false,inspect=false){
const start=Date.now(),fields=[],b=profile.values.basic[0],edu=profile.values.education[0],latest=profile.aircasFacts||{};
const awards=profile.values.awards.slice(0,3).map(a=>a.name+'（'+a.date+'）\n'+a.description).join('\n\n');
const projects=profile.values.projects.filter(p=>profile.autoProjectNames.includes(p.name)).map(p=>p.name+'\n'+p.startTime+'—'+p.endTime+'\n'+(p.role?p.role+'\n':'')+p.description).join('\n\n');
const extra=profile.aircasSupplement||{}; const answers={arrivalTime:extra.arrival_date,address:extra.mailing_address,postcode:extra.postal_code,academicDegree:extra.application_degree,positionCategory:extra.position_category,contryBelong:extra.nationality,exSalary:profile.expectedSalary,userName:b.name,sex:b.gender,nation:b.ethnicity,place:b.nativePlace,birthday:b.birthDate,political:b.politicalStatus,locationPlace:latest.current_hukou?.address||b.hukouLocation,graduateHome:edu.school,education:edu.level?.replace('研究生',''),major:edu.major,eMail:b.email,mobile:b.phone,phone:b.phone,tel:b.phone,userIdCard:b.idNumber,isAbroad:b.overseasStudy==='无'?'否':undefined,winJieShao:awards,complateJieShao:projects,healthStatus:latest.health_status?.startsWith('健康')?'健康或良好':undefined,position:profile.targetRoles?.join('、')};
if(profile.noPublications)Object.assign(answers,{ariticleNum:'0',sciLunWen:'0',eiNum:'0',coreAriticle:'0',authorNum:'无'});
const controls=await page.locator('input,select,textarea').evaluateAll(es=>es.filter(e=>e.getClientRects().length).map(e=>({name:e.name,id:e.id,type:e.type,label:e.closest('.form-info')?.previousElementSibling?.textContent.replace(/^[*\s]+|[：:\s]+$/g,'')||e.name,required:e.required})));
const seen=new Set();for(const c of controls){if(seen.has(c.name))continue;seen.add(c.name);const item={label:c.label,group:'空天研究院',required:c.required,status:'pending',reason:''};fields.push(item);if(cancelled())break;
const value=answers[c.name];if(value===undefined||value===null||value===''){item.reason='缺少该字段确认资料，或需单独处理附件/承诺';continue;}
if(inspect){item.status='ready';continue;}
try{const l=page.locator('[name="'+c.name+'"]:visible');
if(c.type==='radio'){const checked=await l.evaluateAll(es=>es.find(e=>e.checked)?.value||'');if(checked&&checked!==value)throw Error('已有选择冲突');await page.locator('input[name="'+c.name+'"][value="'+value+'"]').check();if(!await page.locator('input[name="'+c.name+'"][value="'+value+'"]').isChecked())throw Error('单选回读失败');item.status=checked?'existing':'filled';continue;}
if(await l.count()!==1)throw Error('字段不唯一');const current=await l.inputValue();if(current===String(value)){item.status='existing';continue;}
const repairPosition=c.name==='position'&&current===profile.values.internship[0]?.position;
if(['birthday','arrivalTime'].includes(c.name)){await calendar(page,l,value);item.status='filled';item.reason='日历选择并回读';continue;}
if(current&&c.type!=='select-one'&&!repairPosition)throw Error('已有内容与知识库不一致，待核对');
const max=await l.getAttribute('maxlength');if(max&&String(value).length>Number(max))throw Error('完整正文超出网站字数限制，未截断');
const result=await executeControl(page,l,{value:String(value),allowOverwrite:c.type==='select-one'||repairPosition,cancelled});item.controlType=result.controlType;item.attempts=result.attempts;
if(await l.inputValue()!==result.value)throw Error('回读失败');item.status='filled';item.reason=repairPosition?'已修复职业定位误用实习职位':'已回读，未保存';
}catch(e){item.reason=e.message;}}
fields.push(...await require('./aircas-records.cjs').fillRecords(page,profile,calendar,cancelled,inspect));
const attachments=await page.locator('#fileInfoTable tbody tr').count();fields.push({label:'附件',group:'空天研究院',status:attachments?'existing':'pending',reason:attachments?'已有附件记录，具体文件仍按要求核验':'缺少附件'});
return {fields,elapsedMs:Date.now()-start,counts:Object.fromEntries(['filled','ready','pending','existing','failed','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]))};
}
module.exports={isAircas,fillAircas,calendar};



