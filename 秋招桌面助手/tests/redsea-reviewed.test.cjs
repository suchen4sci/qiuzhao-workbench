const test=require('node:test'),assert=require('node:assert/strict');
const {isRedsea,loadPlan,setField}=require('../src/redsea-reviewed.cjs');
test('Redsea routes exclude other ATS and other people',()=>{
 for(const url of ['https://a.zhiye.com/form','https://cloud.italent.cn/form','https://51hrc.cn.evil.test/fillResume.mc','https://ejdekd.51hrc.cn/officeWebsite.mob'])assert.equal(isRedsea({url:()=>url}),false);
 assert.equal(loadPlan({url:()=> 'https://ejdekd.51hrc.cn/fillResume.mc?peopleId=unrelated'}),null);
});
test('dropdown has locator is relative to dictionary, not modal ancestor',async()=>{
 let chosen=false;
 const selected={inputValue:async()=>chosen?'精通':'一般',click:async()=>{}};
 const box={filter({has}){assert.equal(has.selector,'[name="ext_mastery"]');return {locator:()=>selected};}};
 const modal={locator:s=>s==='.dictionary-selector'?box:{selector:s}};
 const page={locator:s=>s==='.layui-layer:visible'?modal:s.startsWith('.el-select-dropdown')?{filter:()=>({waitFor:async()=>{},click:async()=>{chosen=true;}})}:{selector:s}};
 assert.equal(await setField(page,{name:'ext_mastery',kind:'select',value:'精通'}),true);
 assert.equal(await setField(page,{name:'ext_mastery',kind:'select',value:'精通'}),false);
});
