const {test}=require('node:test'),assert=require('node:assert/strict');
const {addRecord}=require('../src/add-record-control.cjs');
test('a click timeout after adding a record must not add a duplicate',async()=>{
 let count=1,clicks=0;
 const rows={count:async()=>count,nth:()=>({waitFor:async()=>{}})};
 const add={evaluate:async()=>{},click:async()=>{clicks++;count++;throw Error('timeout after action');}};
 assert.equal(await addRecord(add,rows),1);assert.equal(clicks,1);assert.equal(count,2);
});
test('a genuinely intercepted click can recover once and must verify record count',async()=>{
 let count=2,clicks=0;
 const rows={count:async()=>count,nth:()=>({waitFor:async()=>{if(count===2)throw Error('not added');}})};
 const add={evaluate:async()=>{},click:async()=>{if(++clicks===1)throw Error('intercepted');count++;}};
 assert.equal(await addRecord(add,rows),2);assert.equal(clicks,2);assert.equal(count,3);
});
