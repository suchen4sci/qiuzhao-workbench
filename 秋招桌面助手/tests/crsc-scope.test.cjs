const {test}=require('node:test'),assert=require('node:assert/strict');
const {prepare,isCrsc}=require('../src/crsc-resume.cjs');
test('CRSC additions never access another employer or job-list page',async()=>{
 for(const url of ['https://other.zhiye.com/form','https://crscd.zhiye.com/jobs','https://xiaoyuan.zhaopin.com/scrd/resume2']){
  const page={url:()=>url,locator:()=>{throw Error('other template was accessed');}};
  assert.equal(isCrsc(page),false);await prepare(page,{});
 }
 assert.equal(isCrsc({url:()=> 'https://crscd.zhiye.com/form?fromPage=job'}),true);
});
