function records(profile){const s=profile.aircasSupplement||{},intern=profile.values.internship?.[0];return [
...(s.family||[]).map(values=>({label:'家庭：'+values.relation,button:'button-open-family',table:'familyTable',path:'/system/family/add',identity:[values.relation,values.userName],values:{relation:values.relation,userName:values.userName,workUnit:values.workUnit,tel:values.tel}})),
...profile.values.education.map(e=>({label:'教育：'+e.level,button:'button-open-2',table:'educationTable',path:'/system/edution/add',identity:[e.level.replace('研究生',''),e.school],values:{educationBackground:e.level.replace('研究生',''),startTime:e.startTime,endTime:e.endTime,graduationHome:e.school,major:e.major,eduDegree:/硕士/.test(e.level)?s.application_degree:e.degree,teacher:/硕士/.test(e.level)?s.supervisor_name:'无',tel:/硕士/.test(e.level)?s.supervisor_phone:'无'}})),
...(s.high_school?[{label:'教育：高中',button:'button-open-2',table:'educationTable',path:'/system/edution/add',identity:['高中',s.high_school],values:{educationBackground:'高中',startTime:s.high_school_start,endTime:s.high_school_end,graduationHome:s.high_school,major:'无',eduDegree:'无',teacher:'无',tel:'无'}}]:[]),
...(intern&&s.include_internship_in_work_history?[{label:'实习：'+intern.company,button:'button-open-3',table:'workTable',path:'/system/exp/add',identity:[intern.company,intern.startTime],values:{startTime:intern.startTime,endTime:intern.endTime,unit:intern.company,position:intern.position,leader:s.internship_leader,tel:s.internship_leader_phone,salary:s.internship_salary}}]:[])];}
async function fillRecords(page,profile,calendar,cancelled,inspect=false){const results=[];
for(const record of records(profile)){
const item={label:record.label,group:'空天新增记录',status:'pending',reason:''};results.push(item);
const rows=await page.locator('#'+record.table+' tbody tr').evaluateAll(es=>es.map(e=>[...e.querySelectorAll('td')].map(x=>x.textContent.trim())));
const matches=rows.filter(cells=>record.identity.every(v=>cells.includes(v)));
if(matches.length){const consistent=matches.length===1&&Object.values(record.values).filter(v=>v!==null&&v!==undefined&&v!=='').every(v=>matches[0].includes(String(v)));item.status=consistent?'existing':'pending';item.reason=matches.length>1?'表格存在重复记录':consistent?'表格各字段与知识库一致，不重复新增':'记录已存在但内容与知识库不一致，请核对';continue;}
const missing=Object.entries(record.values).filter(([k,v])=>v===null||v===undefined||v==='').map(([k])=>k);
if(missing.length){item.reason='缺少确认字段：'+missing.join('、');continue;}
if(inspect){item.status='ready';continue;}if(cancelled())break;
try{
if(await page.locator('.layui-layer-iframe:visible').count())throw Error('已有编辑弹窗，请先完成或关闭');
await page.locator('#'+record.button).click();let frame;for(let attempt=0;attempt<30;attempt++){frame=page.frames().find(f=>f.url().includes(record.path));if(frame)break;await new Promise(r=>setTimeout(r,100));}if(!frame)throw Error('新增弹窗未加载');
await frame.locator('input:visible').first().waitFor({timeout:2500});
for(const [name,value]of Object.entries(record.values)){if(cancelled())throw Error('已停止');const input=frame.locator('[name="'+name+'"]:visible');if(await input.count()!==1)throw Error('弹窗字段不唯一：'+name);
if(name==='startTime'||name==='endTime')await calendar(frame,input,String(value));else if(await input.evaluate(e=>e.tagName==='SELECT'))await input.selectOption({label:String(value)});else{await input.fill(String(value));await input.press('Tab');}
if(await input.inputValue()!==String(value))throw Error('回读失败：'+name);}
// User requested adding these records; confirm only this verified row, never the full resume.
await page.locator('.layui-layer-iframe:visible .layui-layer-btn0').click();
await page.waitForFunction(({table,identity})=>[...document.querySelectorAll('#'+table+' tbody tr')].some(r=>{const cells=[...r.querySelectorAll('td')].map(e=>e.textContent.trim());return identity.every(v=>cells.includes(v));}),{table:record.table,identity:record.identity},{timeout:5000});
item.status='filled';item.reason='逐字段回读后新增，已核验表格记录';
await page.locator('.layui-layer-iframe:visible').waitFor({state:'hidden',timeout:5000});
}catch(e){item.reason=e.message;break;}}
return results;}
module.exports={records,fillRecords};
