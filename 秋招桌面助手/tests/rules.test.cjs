const test = require('node:test');
const assert = require('node:assert/strict');
const { matchField } = require('../src/rules.cjs');
const { valueForControl, selectOption, inferSection } = require('../src/engine.cjs');
test('numeric input filters reject a WeChat identifier without stripping letters',()=>{
  const c={tag:'input',type:'text',labels:['证明人联系方式'],numericOnlyFilter:true};
  assert.match(valueForControl('example_contact88',{},c).reason,/纯数字/);
  assert.equal(valueForControl('00000000000',{},c).value,'00000000000');
  assert.equal(valueForControl('example_contact88',{}, {...c,numericOnlyFilter:false}).value,'example_contact88');
});
test('family labels retain the family scope instead of using applicant fields',()=>{
  for(const [label,key] of [['亲属姓名','name'],['亲属职位','position'],['政治面貌','politicalStatus'],['现居住地址','currentAddress'],['出生日期','birthDate']]){
    const m=matchField([label],'family');assert.equal(m.groupId,'family');assert.equal(m.key,key);
  }
});
test('employment declarations stay separate from internship and work duration', () => {
  for (const [label,key] of [['是否存在“竞业限制”','nonCompeteRestriction'],['是否存在“知识产权限制”','intellectualPropertyRestriction'],['是否有正式工作经历','formalWorkExperience']]) {
    const match=matchField([label],'basic');
    assert.equal(match.key,key);
    assert.equal(match.spec.manual,true);
    assert.match(valueForControl(undefined,match.spec,{labels:[label]}).reason,/空|缺|未/);
  }
});
test('ambiguous dates are scoped; internship and project descriptions stay separate', () => {
  assert.equal(matchField(['开始时间'], null), null);
  assert.equal(matchField(['工作内容'], 'internship').groupId, 'internship');
  assert.equal(matchField(['工作内容'], 'projects'), null);
  assert.equal(matchField(['学校名称'], 'education').key, 'school');
  assert.equal(inferSection(['教育经历 · 本科']), 'education');
  assert.equal(inferSection(['实习经历']), 'internship');
});
test('dates preserve precision and prose is never truncated', () => {
  assert.match(valueForControl('2026-05', { date: true }, { type: 'date', labels: [] }).reason, /补造/);
  assert.equal(valueForControl('2027-06-20', { date: true }, { type: 'month', labels: [] }).value, '2027-06');
  assert.match(valueForControl('至今', { date: true }, { type: 'date', labels: [] }).reason, /在职/);
  assert.match(valueForControl('完整描述', {}, { labels: [], maxLength: 2 }).reason, /未截断/);
  assert.match(valueForControl('3.44/4', {}, { labels: [], type: 'number' }).reason, /口径/);
});
test('rank may map to a broader band but never a better percentile', () => {
  const options = ['前20%', '前50%', '前80%'].map(label => ({label,value:label}));
  assert.equal(selectOption(options, '前40%', {rank:true}).label, '前50%');
  assert.equal(selectOption(options.slice(0,1), '前40%', {rank:true}), null);
  assert.equal(selectOption([{label:'男',value:'M'}], '男', {}).value, 'M');
  assert.equal(selectOption([{label:'女',value:'F'}], '男', {}), null);
});
