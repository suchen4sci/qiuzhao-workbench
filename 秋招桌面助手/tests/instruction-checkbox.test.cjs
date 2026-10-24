const test=require('node:test'),assert=require('node:assert/strict'),{isEducationInstruction}=require('../src/instruction-checkbox.cjs');
const text='请大家务必填写完整的教育经历，按照学历由高至低顺序填写。确认并开始填写';
test('only education order acknowledgement is a routine instruction',()=>{assert(isEducationInstruction('教育信息填写说明',text));for(const label of ['隐私政策','从业声明承诺','同意条款','教育信息真实性承诺'])assert(!isEducationInstruction(label,text));assert(!isEducationInstruction('教育信息填写说明',text+'本人承诺信息真实性'));assert(!isEducationInstruction('教育信息填写说明','确认并开始填写'));});
