const {executeControl}=require('./control-dispatcher.cjs');
const {fillSelect2Multiple}=require('./select2-multiple.cjs');
const {chooseTranscript,authorized}=require('./transcript-upload.cjs');
const fs=require('fs'),crypto=require('crypto');
function isPhytium(page){const u=new URL(page.url());return u.origin==='https://www.phytium.com.cn'&&u.pathname==='/recruitment/resume/delivery/';}
function graduationOption(date,labels){
 if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(date||''))return null;
 const month=Number(date.slice(0,4))*12+Number(date.slice(5,7));
 const matches=labels.filter(label=>{const m=label.match(/^(\d{4})年(\d{1,2})月-(\d{4})年(\d{1,2})月$/);return m&&month>=Number(m[1])*12+Number(m[2])&&month<=Number(m[3])*12+Number(m[4]);});
 return matches.length===1?matches[0]:null;
}
async function fillPhytium(page,profile,cancelled=()=>false){
 const fields=[],start=Date.now(),basic=profile.values.basic[0],education=profile.values.education.filter(e=>e.level===basic.highestEducation);
 const input=id=>page.locator('#'+id);
 const add=async(label,group,locator,value,action)=>{if(cancelled())return;try{if(value===undefined||value===null||value==='')throw Error('缺少已确认资料');const result=action?await action():await executeControl(page,locator,{value,allowOverwrite:true,cancelled});fields.push({label,group,...result,reason:'按确认资料填写并回读，未最终投递'});}catch(e){fields.push({label,group,status:'pending',reason:e.message});}};
 if(await input('id_interviewer').count()!==1||await input('id_highest_education').count()!==1)throw Error('飞腾候选人表单结构已变化');
 await add('姓名','候选人信息',input('id_interviewer'),basic.name);
 await add('手机号','候选人信息',input('id_interviewer_phone'),basic.phone);
 await add('邮箱','候选人信息',input('id_interviewer_email'),basic.email);
 const province=basic.nativePlace?.match(/^.*?(省|自治区|特别行政区|市)/)?.[0];
 await add('籍贯（省级）','候选人信息',input('id_native_place'),province);
 const edu=education.length===1?education[0]:null;
 await add('毕业院校（在读）','候选人信息',input('id_graduate_school').locator('xpath=following-sibling::*[contains(@class,"select2")][1]').locator('.select2-selection'),edu?.school);
 await add('所学专业','候选人信息',input('id_major'),edu?.major);
 const degree={'硕士研究生':'硕士','博士研究生':'博士'}[basic.highestEducation]||basic.highestEducation;
 await add('最高学历（在读）','候选人信息',input('id_highest_education'),degree);
 const labels=await input('id_estimated_graduation_time').locator('option').allTextContents();
 await add('预计毕业时间','候选人信息',input('id_estimated_graduation_time'),graduationOption(edu?.endTime,labels));
 const intent=profile.values.intent[0],cities=[intent.primaryCity,...intent.otherCities||[]].filter(Boolean).map(s=>s.replace(/市$/,''));
 await add('意向工作地点','求职意向',input('id_intended_workplace'),cities.length?cities:undefined,()=>fillSelect2Multiple(page,input('id_intended_workplace'),[...new Set(cities)]));
 const resume=input('id_attachment').locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," file-input ")][1]');
 const resumeName=await resume.locator('.file-caption-name').inputValue();
 fields.push({label:'上传简历',group:'附件',status:resumeName?'existing':'pending',reason:resumeName?'已显示已有简历文件名，保留':'未上传简历，需核对版本'});
 const upload=input('id_school_report'),wrapper=upload.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," file-input ")][1]');
 const filename=await wrapper.locator('.file-caption-name').inputValue();
 const level=degree==='硕士'?'研究生':degree==='本科'?'本科':null;
 const attachment=chooseTranscript(profile.attachmentCatalog,level,await upload.getAttribute('accept'));
 if(filename){
  const ready=await upload.evaluate(e=>!!window.jQuery?.(e).data('value'));
  fields.push({label:'成绩单',group:'附件',status:attachment&&filename===attachment.filename&&ready?'existing':'pending',reason:attachment&&filename===attachment.filename&&ready?'已显示对应成绩单且上传数据就绪，未重复上传':'已有附件未能匹配确认原件或尚未上传完成，未覆盖'});
 }
 else if(!cancelled())try{
  const a=attachment;
  if(!a||!authorized(profile,a))throw Error('缺少已授权且格式兼容的对应成绩单');
  const bytes=fs.readFileSync(a.path);if(crypto.createHash('sha256').update(bytes).digest('hex')!==a.sha256)throw Error('成绩单原件校验失败');
  await upload.setInputFiles(a.path);
  await wrapper.locator('.file-caption-name').waitFor({state:'visible',timeout:10000});
  await page.waitForFunction(({id,name})=>{const e=document.getElementById(id),w=e?.closest('.file-input');return w?.querySelector('.file-caption-name')?.value===name&&w?.querySelector('.progress-bar')?.getAttribute('aria-valuenow')==='100'&&!!window.jQuery?.(e).data('value');},{id:'id_school_report',name:a.filename},{timeout:20000});
  fields.push({label:'研究生成绩单',group:'附件',status:'filled',reason:'上传文件名与完成状态均已核验'});
 }catch(e){fields.push({label:'成绩单',group:'附件',status:'pending',reason:e.message});}
 fields.push({label:'校园大使',group:'候选人信息',status:'notApplicable',reason:'无已确认校园大使代码，非必填，保留空白'});
 const counts={filled:0,ready:0,pending:0,existing:0,failed:0,notApplicable:0};for(const f of fields)counts[f.status]++;
 return {fields,counts,elapsedMs:Date.now()-start,steps:[]};
}
module.exports={isPhytium,graduationOption,fillPhytium};
