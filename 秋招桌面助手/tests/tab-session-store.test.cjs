const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {loadSession}=require('../src/tab-session-store.cjs');
const state={nextId:3,activeId:'A02',tabs:[{id:'A01',url:'https://example.com/first'},{id:'A02',url:'https://example.com/last',company:'测试公司'}]};
function fixture(fn){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tabs-store-'));try{fn(path.join(dir,'tabs.json'));}finally{fs.rmSync(dir,{recursive:true,force:true});}}
test('UTF8 BOM history restores all tabs and active identity',()=>fixture(file=>{fs.writeFileSync(file,'\uFEFF'+JSON.stringify(state));assert.deepEqual(loadSession(file).snapshot,state);}));
test('valid JSON with wrong schema falls back to verified backup',()=>fixture(file=>{fs.writeFileSync(file,'{}');fs.writeFileSync(file+'.bak',JSON.stringify(state));assert.deepEqual(loadSession(file).snapshot,state);assert(loadSession(file).recovered);}));
test('broken histories cannot silently start empty or overwrite files',()=>fixture(file=>{fs.writeFileSync(file,'broken');fs.writeFileSync(file+'.bak','null');assert.throws(()=>loadSession(file),/未创建空会话/);assert.equal(fs.readFileSync(file,'utf8'),'broken');}));
test('genuine first launch without history is allowed',()=>fixture(file=>assert.deepEqual(loadSession(file).snapshot,{})));
