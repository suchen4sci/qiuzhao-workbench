const fs=require('node:fs'),path=require('node:path');
const {groups}=require('./rules.cjs');
function loadProfile(root){
 const source='知识库/profile.json';const p=JSON.parse(fs.readFileSync(path.join(root,source),'utf8').replace(/^\uFEFF/,''));
 if(p.schemaVersion!==1||!p.values||!Array.isArray(p.values.basic))throw Error('知识库格式无效，请使用 templates 中的模板');
 const values=Object.fromEntries(Object.keys(groups).map(k=>[k,Array.isArray(p.values[k])?p.values[k]:[]]));
 const library=Object.entries(groups).map(([id,g])=>({id,label:g.label,records:values[id].map((r,index)=>({id:id+':'+index,index,title:id==='education'?[r.level,r.school].filter(Boolean).join(' · '):r.name||r.company||g.label,fields:Object.entries(g.fields).filter(([k])=>r[k]!==undefined&&r[k]!==null&&String(r[k])!=='').map(([key,s])=>({id:id+':'+index+':'+key,key,label:s.label,value:String(r[key]),manual:!!s.manual}))}))}));
 const b=values.basic[0]||{},intern=values.internship[0]||{};
 return {...p,values,library,sources:[source],notes:[p.demo?'当前为虚构演示资料，禁止真实投递':'仅复用已确认资料','正文不摘要，日期不猜测，最终投递由本人确认'],autoAwardNames:values.awards.map(x=>x.name),autoProjectNames:values.projects.map(x=>x.name),aircasFacts:{health_status:b.healthStatus,current_hukou:{address:b.hukouLocation}},aircasSupplement:{mailing_address:b.mailingAddress,postal_code:b.postalCode,arrival_date:values.intent[0]?.arrivalDate,internship_monthly_salary:intern.monthlySalary},zhaopin:{skills:values.skills},wjx:null,awardCorrections:null};
}
module.exports={loadProfile};
