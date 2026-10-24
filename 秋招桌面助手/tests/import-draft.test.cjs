const {test}=require('node:test'),assert=require('node:assert/strict'),{readImportDraft}=require('../src/ui/import-draft.js');
test('dead hot bridge falls back to main process without hanging',async()=>{
 let calls=0;const expected={company:'已核验公司',role:'工程师',url:'https://example.test/job'};
 assert.deepEqual(await readImportDraft({hot:()=>new Promise(()=>{}),primary:async()=>{calls++;return expected},hotTimeout:10}),expected);assert.equal(calls,1);
});
test('unresponsive readers open a manual review draft rather than spinning forever',async()=>{
 const r=await readImportDraft({hot:()=>new Promise(()=>{}),primary:()=>new Promise(()=>{}),url:'https://example.test/',hotTimeout:10,timeout:10});
 assert.equal(r.url,'https://example.test/');assert.equal(r.company,'');assert.equal(r.role,'');assert.match(r.companyReason,/超时/);
});
test('healthy hot reader avoids redundant main reads',async()=>{
 const r=await readImportDraft({hot:async()=>({company:'公司'}),primary:async()=>{throw Error('should not be called')}});assert.equal(r.company,'公司');
});
