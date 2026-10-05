const {test}=require('node:test'),assert=require('node:assert/strict');
const {valueForControl,valueMatches}=require('../src/engine.cjs');
const {matchField}=require('../src/rules.cjs');
test('heading-only length fitting retains every substantive sentence',()=>{
 const raw='背景与目标： 甲乙\n技术实现： 丙丁\n测试成果： 戊己';
 assert.equal(valueForControl(raw,{}, {tag:'textarea',labels:[],maxLength:8}).value,'甲乙\n丙丁\n戊己');
 assert.match(valueForControl(raw,{}, {tag:'textarea',labels:[],maxLength:7}).reason,/未截断/);
});
test('proof composite does not collide with contact-only label',()=>{
 assert.equal(matchField(['证明人/联系方式'],'internship').key,'referenceSummary');
 assert.equal(matchField(['证明人联系方式'],'internship').key,'referenceContact');
});
test('native region comparison handles municipality repetition but not another city',()=>{
 assert(valueMatches({nativeRegion:true},'北京',{},'北京市/北京市'));
 assert(valueMatches({nativeRegion:true},'河南省安阳市',{},'河南省/安阳市'));
 assert(!valueMatches({nativeRegion:true},'河南省安阳市',{},'河南省/郑州市'));
});
