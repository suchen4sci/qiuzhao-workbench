const {test}=require('node:test'),assert=require('node:assert/strict');
const {isPhytium,graduationOption}=require('../src/phytium-resume.cjs');
test('graduation month maps only to a unique containing offered range',()=>{
 const labels=['2026年1月-2026年12月','2027年1月-2027年12月'];
 assert.equal(graduationOption('2027-06-20',labels),labels[1]);
 assert.equal(graduationOption('2027',labels),null);
 assert.equal(graduationOption('2028-06',labels),null);
 assert.equal(graduationOption('2027-06',[...labels,labels[1]]),null);
});
test('candidate application binder is confined to confirmed portal and delivery form',()=>{
 assert.equal(isPhytium({url:()=> 'https://www.phytium.com.cn/recruitment/resume/delivery/?id=fixture'}),true);
 assert.equal(isPhytium({url:()=> 'https://www.phytium.com.cn/recruitment/'}),false);
 assert.equal(isPhytium({url:()=> 'https://fixture.zhiye.com/form'}),false);
});
