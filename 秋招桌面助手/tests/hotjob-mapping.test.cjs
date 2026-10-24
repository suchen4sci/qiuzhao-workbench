const test=require('node:test'),assert=require('node:assert/strict');
const {matchField}=require('../src/rules.cjs');
const {equivalentMajor}=require('../src/dictionary-major.cjs');
test('project role/company labels stay scoped and basic highest degree does not replace education degree',()=>{
 assert.equal(matchField(['项目职务'],'projects').key,'role');
 assert.equal(matchField(['所属公司'],'projects').key,'company');
 assert.equal(matchField(['所属公司'],'family'),null);
 assert.equal(matchField(['学位'],'education').key,'degree');
 assert.equal(matchField(['学位'],'basic').key,'highestDegree');
 assert.equal(matchField(['专业'],'basic').key,'latestMajor');
 assert.equal(matchField(['专业'],null).groupId,'education');
 assert.equal(matchField(['学位'],null).groupId,'education');
 assert.equal(matchField(['学历'],null).groupId,'education');
 const adjustment=matchField(['接受调剂'],'basic');assert.equal(adjustment.key,'acceptAdjustment');
 assert.deepEqual(adjustment.spec.optionAliases['是'],['接受']);
});
test('major dictionary accepts classification suffix without inventing a different discipline',()=>{
 assert.equal(equivalentMajor('新一代电子信息技术(含量子技术等)(工学类专业学位)','新一代电子信息技术(含量子技术等)'),true);
 assert.equal(equivalentMajor('电子信息科学与技术(电子信息类)','电子信息科学与技术'),true);
 assert.equal(equivalentMajor('电子信息工程(电子信息类)','电子信息科学与技术'),false);
 assert.equal(equivalentMajor('电子信息科学与技术(其他方向)','电子信息科学与技术'),false);
});
