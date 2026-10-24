const {test}=require('node:test'),assert=require('node:assert/strict');
const {matches}=require('../src/sd-reviewed-fields.cjs');
test('reviewed SD answers cannot leak to another tenant or application',()=>{
 const r={status:'verified',origin:'https://example.test',path:'/campus/company/1',hash:'#/job/sales/apply',query:{source:'test'}};
 assert.equal(matches(r,'https://example.test/campus/company/1?source=test#/job/sales/apply'),true);
 for(const u of ['https://other.test/campus/company/1?source=test#/job/sales/apply','https://example.test/campus/other/1?source=test#/job/sales/apply','https://example.test/campus/company/1?source=test#/job/engineering/apply','https://example.test/campus/company/1#/job/sales/apply'])assert.equal(matches(r,u),false);
 assert.equal(matches({...r,status:'draft'},'https://example.test/campus/company/1?source=test#/job/sales/apply'),false);
});
