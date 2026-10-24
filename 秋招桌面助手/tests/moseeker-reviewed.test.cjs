const test=require('node:test'),assert=require('node:assert/strict');
const {loadPlan,fill}=require('../src/moseeker-reviewed.cjs');
test('reviewed MoSeeker plan never applies to other portals or jobs',()=>{
 for(const url of ['https://a.zhiye.com/form','https://www.moseeker.com/profileform/edit/pid/other','https://www.moseeker.com.evil.test/profileform/edit/pid/3480888'])assert.equal(loadPlan({url:()=>url}),null);
});
test('changed education ordering blocks ordinal filling before any mutation',async()=>{
 const page={getByText:()=>({count:async()=>1}),getByPlaceholder:()=>({count:async()=>2,nth:i=>({inputValue:async()=>i?'硕士':'本科'})})};
 const result=await fill(page,{title:'测试申请表',education:['硕士','本科'],fields:[]});
 assert.equal(result.counts.pending,1);assert.match(result.fields[0].reason,/顺序变化/);assert.equal(result.counts.filled,0);
});
