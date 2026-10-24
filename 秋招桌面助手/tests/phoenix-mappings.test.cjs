const {test}=require('node:test'),assert=require('node:assert/strict');
const {groups,matchField,sectionFrom}=require('../src/rules.cjs');
const {valueMatches,valueForControl}=require('../src/engine.cjs');
test('relative arrival display is verified only for arrival date and a date beyond three months',()=>{
 const future=new Date();future.setMonth(future.getMonth()+6);const date=[future.getFullYear(),String(future.getMonth()+1).padStart(2,'0'),String(future.getDate()).padStart(2,'0')].join('-');
 const c={labels:['到岗时间'],match:{groupId:'intent',key:'arrivalDate'},observedValue:'三个月以上'};
 assert.ok(valueMatches(c,date,{date:true}));assert.equal(valueMatches(c,'2000-01-01',{date:true}),false);
 assert.equal(valueMatches({...c,match:{groupId:'basic',key:'birthDate'}},date,{date:true}),false);
});
test('family and language fields are scoped, not computer skill aliases',()=>{
 assert.equal(sectionFrom('家庭情况'),'family');
 assert.equal(matchField(['掌握程度'],'languages').key,'proficiency');
 assert.equal(matchField(['掌握程度'],'skills').key,'level');
 assert.equal(matchField(['学院名称'],'education').key,'department');
 assert.equal(matchField(['身高(厘米)'],'basic').key,'height');
 assert.equal(matchField(['奖项'],'awards').key,'name');
 assert.equal(matchField(['在校职务名称'],'campus').key,'role');
 assert.equal(matchField(['在校职务描述'],'campus').key,'description');
 assert.equal(matchField(['毕业时间（年）'],'basic').key,'graduationYear');
 assert.equal(matchField(['毕业时间（月）'],'basic').key,'graduationMonth');
});
test('single-line descriptions preserve every word with spaces, textarea retains paragraphs',()=>{
 assert.equal(valueForControl('第一段\n\n第二段',{}, {tag:'input',type:'text',labels:[]}).value,'第一段 第二段');
 assert.equal(valueForControl('第一段\n\n第二段',{}, {tag:'textarea',type:'textarea',labels:[]}).value,'第一段\n\n第二段');
});
test('month display compares with exact-date knowledge without inventing or dropping days in date controls',()=>{
 assert.equal(valueMatches({customSelect:true,labels:[],observedValue:'2024-09'},'2024-09-01',{date:true}),true);
 assert.equal(valueMatches({type:'date',labels:[],observedValue:'2024-09-02'},'2024-09-01',{date:true}),false);
 assert.equal(valueMatches({labels:[],observedValue:'2024-09'},'2024-09-01',{date:true}),false);
});
test('municipality hierarchy collapses only equal components; option aliases preserve semantics',()=>{
 assert.equal(valueForControl(['北京市','北京市'],{}, {labels:[]}).value,'北京市');
 assert.equal(valueMatches({observedValue:'北京'},'北京市',groups.intent.fields.primaryCity),true);
 assert.equal(valueMatches({observedValue:'学士'},'工学学士',groups.education.fields.degree),true);
});
