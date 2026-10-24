const {test}=require('node:test'),assert=require('node:assert/strict');
const {isAlibaba,matchExperience}=require('../src/alibaba-resume.cjs');
test('combined experience records select by identity, never row index',()=>{
 const profile={values:{internship:[{company:'Fixture chip company',position:'IC intern'}],projects:[{name:'Fixture FPGA timing ｜ Grant',aliases:['Timing project'],role:'负责人'}]}};
 assert.equal(matchExperience(profile,'Fixture chip company').role,'IC intern');
 assert.equal(matchExperience(profile,'Timing project').role,'负责人');
 assert.equal(matchExperience(profile,'Fixture FPGA timing').role,'负责人');
 assert.equal(matchExperience(profile,'FPGA'),null);
 assert.equal(matchExperience(profile,'Unknown company'),null);
 assert.equal(matchExperience({values:{internship:[{company:'Same'},{company:'Same'}],projects:[]}},'Same'),null);
});
test('Alibaba binder cannot replace other portal execution branches',()=>{
 assert.equal(isAlibaba({url:()=> 'https://campus-talent.alibaba.com/personal/resume'}),true);
 assert.equal(isAlibaba({url:()=> 'https://campus-talent.alibaba.com/jobs'}),false);
 assert.equal(isAlibaba({url:()=> 'https://fixture.zhiye.com/form'}),false);
});
