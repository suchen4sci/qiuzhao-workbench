const test=require('node:test'),assert=require('node:assert/strict');
const {matches,normalize}=require('../src/iguopin-reviewed.cjs');
const plan={origin:'https://c.iguopin.com',pathname:'/apply',scope:{job_id:'a',project_id:'b',resume_id:'c',template_id:'d'}};
test('reviewed plan must match every identity, not merely host',()=>{
 const url='https://c.iguopin.com/apply?job_id=a&project_id=b&resume_id=c&template_id=d';
 assert.equal(matches(url,plan),true);
 for(const key of Object.keys(plan.scope)){const u=new URL(url);u.searchParams.set(key,'other');assert.equal(matches(u.href,plan),false);}
 assert.equal(matches(url.replace('/apply?','/resume-preview?'),plan),false);
 assert.equal(matches(url.replace('c.iguopin.com','other.example'),plan),false);
});
test('comparison tolerates layout spacing but preserves factual differences',()=>{assert.equal(normalize('负责人\n 北京邮电大学'),normalize('负责人 北京邮电大学'));assert.notEqual(normalize('前10%'),normalize('前20%'));});
