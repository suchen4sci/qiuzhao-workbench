const test=require('node:test'),assert=require('node:assert/strict');
const {sectionFrom,matchField}=require('../src/rules.cjs');
const {valueMatches}=require('../src/engine.cjs');
test('SD region keeps district precision while retaining province-city inputs',()=>{
 const {regionSteps}=require('../src/sd-controls.cjs');
 assert.deepEqual(regionSteps('山东省济南市历下区'),['山东','济南市','历下区']);
 assert.deepEqual(regionSteps('山东省济南市'),['山东','济南市']);
 assert.deepEqual(regionSteps('上海市徐汇区'),['上海市','徐汇区']);
 assert.deepEqual(regionSteps('山东 济南市 历下区'),['山东','济南市','历下区']);
});
test('referral overrides cannot leak to another employer sharing a portal',()=>{
 const {confirmedRecordValue}=require('../src/engine.cjs');
 const record={portalOverrides:[{key:'referralCode',origin:'https://portal.example',path:'/campus/company-a',value:'confirmed-code'}]};
 assert.equal(matchField(['推荐码'],'intent').key,'referralCode');
 assert.equal(matchField(['预计获取双证时间'],'basic').key,'certificateDate');
 assert.equal(matchField(['微信'],'basic').key,'wechat');
 assert.equal(confirmedRecordValue(record,'referralCode','https://portal.example','https://portal.example/campus/company-a#/apply').value,'confirmed-code');
 assert.equal(confirmedRecordValue(record,'referralCode','https://portal.example','https://portal.example/campus/company-b#/apply').value,undefined);
 assert.equal(confirmedRecordValue(record,'referralCode','https://portal.example').value,undefined);
});
test('SD rank uses a containing real range without improving the rank',()=>{
 const {rankOption}=require('../src/sd-controls.cjs');
 assert.equal(rankOption(['1%-10%','10%-30%','30%-50%','50%-100%'],'前20%'),'10%-30%');
 assert.equal(rankOption(['1%-10%','10%-30%','30%-50%','50%-100%'],'前40%'),'30%-50%');
 assert.equal(rankOption(['前10%','前50%'],'前40%'),'前50%');
 assert.equal(matchField(['成绩分位'],'education').key,'classRank');
 assert.equal(matchField(['专业学习方向/研究方向'],'education').key,'researchDirection');
});
test('structured form labels retain their section semantics',()=>{
 assert.equal(sectionFrom('申请信息'),'intent');
 assert.equal(sectionFrom('自我描述'),'evaluation');
 assert.equal(matchField(['国家/地区'],'basic').key,'nationality');
 assert.equal(matchField(['最高学历毕业时间'],'basic').key,'graduationDate');
 assert.equal(matchField(['听说'],'languages').key,'listeningSpeaking');
 assert.equal(matchField(['项目中职责'],'projects').key,'responsibilities');
 assert.equal(matchField(['工作地点'],'internship').key,'workLocation');
 assert.equal(matchField(['获奖经历'],'basic').key,'awardsSummary');
});
test('region and age display formatting does not create false conflicts',()=>{
 assert.equal(valueMatches({sdRegion:true},'河南省安阳市',{},'河南 安阳市'),true);
 assert.equal(valueMatches({sdRegion:true},'河南省安阳市',{},'河南 郑州市'),false);
 assert.equal(valueMatches({},'2002-05-28',{date:true},'2002-05 (24岁)'),true);
 assert.equal(valueMatches({},'2002-05-28',{date:true},'2002-06 (24岁)'),false);
});
