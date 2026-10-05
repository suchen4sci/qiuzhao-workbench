const test=require('node:test'),assert=require('node:assert/strict');
const {validateChanges}=require('../src/services/resume-ai.cjs');
const asset={pages:[{page:1,text:'姓名：张三\n项目名称：求职助手',sourceLabel:'正文段落1（非页码）'}]};
const profile={values:{basic:[{name:'原姓名'}]}};
test('resume proposals require original quotes and copied values, retaining conflict and paragraph source',()=>{
 const valid={changes:[{group:'basic',index:0,key:'name',value:'张三',page:1,quote:'姓名：张三'}]};
 const changes=validateChanges(valid,asset,profile);assert.equal(changes[0].state,'conflict');assert.match(changes[0].sourceLabel,/非页码/);
 assert.throws(()=>validateChanges({changes:[{...valid.changes[0],value:'李四'}]},asset,profile),/原文依据/);
 assert.throws(()=>validateChanges({changes:[{...valid.changes[0],page:2}]},asset,profile),/原文依据/);
 assert.throws(()=>validateChanges({changes:[valid.changes[0],valid.changes[0]]},asset,profile),/重复/);
});
