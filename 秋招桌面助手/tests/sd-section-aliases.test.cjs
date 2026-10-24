const test=require('node:test'),assert=require('node:assert/strict');
const {matchField,sectionFrom}=require('../src/rules.cjs');const {valueForControl}=require('../src/engine.cjs');
test('day widget keeps confirmed full birthday even when its label says birth month',()=>{
 const spec={date:true},control={tag:'input',type:'text',readonly:true,labels:['出生年月'],placeholder:'日期（年月日）'};
 assert.equal(valueForControl('1980-03-26',spec,control).value,'1980-03-26');
 assert.match(valueForControl('1980-03',spec,control).reason,/不能/);
 assert.equal(valueForControl('1980-03-26',spec,{...control,type:'month'}).value,'1980-03');
});
test('observed SD section aliases remain scoped',()=>{assert.equal(sectionFrom('院校经历'),'campus');assert.equal(sectionFrom('主要家庭成员及社会关系'),'family');for(const [g,l,k] of [['education','学校所在地','schoolLocation'],['campus','项目名称','name'],['campus','项目描述','activityDescription'],['family','称谓','relation'],['family','联系地址/联系电话','phone'],['intent','期望城市','city'],['internship','薪资','monthlySalary']])assert.equal(matchField([l],g).key,k);assert.equal(matchField(['项目名称'],'projects').key,'name');assert.equal(matchField(['学校所在地'],'internship'),null);});
test('readonly day calendar does not invent a day from confirmed campus month',()=>{assert.match(valueForControl('2021-09',{date:true},{type:'text',readonly:true,placeholder:'日期（年月日）',labels:['开始时间']}).reason,/补造/);});

test('two campus description fields have independent semantic slots',()=>{assert.notEqual(matchField(['项目描述'],'campus').key,matchField(['职务描述'],'campus').key);assert.deepEqual(matchField(['政治面貌'],'basic').spec.optionAliases['中共党员'],['党员','中国共产党党员']);});
test('provisional derived data does not become an autofill fact',()=>{const {confirmedRecordValue}=require('../src/engine.cjs');assert.match(confirmedRecordValue({workLocation:'北京市',fieldStatus:{workLocation:'needs-confirmation'}},'workLocation','https://example.com').reason,/未获本人确认/);assert.equal(confirmedRecordValue({workLocation:'北京市'},'workLocation','https://example.com').value,'北京市');});
test('current salary amount and portal range remain distinct',()=>{assert.equal(matchField(['当前薪资'],'intent').key,'currentSalaryAmount');assert.equal(matchField(['现月薪(税前)'],'intent').key,'currentSalary');});
