const {test}=require('node:test');
const assert=require('node:assert/strict');
const {scopeMatches,fingerprintMatches,overwriteConfirmed}=require('../src/phoenix-record-repair.cjs');
test('parser corrections require confirmed exact portal and path',()=>{
 const r={origin:'https://fixture.zhiye.com',path:'/form',status:'user-confirmed',overwrite:{internship:['position']}};
 assert.equal(scopeMatches(r,'https://fixture.zhiye.com/form?fromPage=job'),true);
 assert.equal(scopeMatches(r,'https://other.zhiye.com/form'),false);
 assert.equal(scopeMatches(r,'https://fixture.zhiye.com/other'),false);
 assert.equal(scopeMatches({...r,status:'provisional'},'https://fixture.zhiye.com/form'),false);
 assert.equal(overwriteConfirmed({recordRepairs:[r]},'https://fixture.zhiye.com/form','internship','position'),true);
 assert.equal(overwriteConfirmed({recordRepairs:[r]},'https://fixture.zhiye.com/form','internship','company'),false);
});
test('known parser fragment must match all recorded fields, never just a keyword',()=>{
 const f={'公司名称':'Fixture student office','职位名称':'','开始时间':'2024-09','工作职责':'Confirmed student organization'};
 assert.equal(fingerprintMatches(f,{...f}),true);
 assert.equal(fingerprintMatches(f,{...f,'开始时间':'2023-09'}),false);
 assert.equal(fingerprintMatches(f,{...f,'工作职责':'Different work'}),false);
 assert.equal(fingerprintMatches({'公司名称':f['公司名称']},f),false);
 assert.equal(fingerprintMatches(f,{'单位名称':f['公司名称'],'职位名称':'','开始时间':'2024-09','工作职责':f['工作职责']}),true);
});
test('confirmed shared work structure remains limited to Beisen form paths',()=>{
 const r={structure:'phoenix-work-records',status:'user-confirmed'};
 assert.equal(scopeMatches(r,'https://new-fixture.zhiye.com/form'),true);
 assert.equal(scopeMatches(r,'https://new-fixture.zhiye.com/other'),false);
 assert.equal(scopeMatches(r,'https://not-beisen.example/form'),false);
});
