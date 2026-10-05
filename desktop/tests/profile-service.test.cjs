const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { createProfileService } = require('../src/services/profile-service.cjs');
function fixture(t) {
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'profile-service-'));
  fs.mkdirSync(path.join(root,'知识库'));
  fs.writeFileSync(path.join(root,'知识库/profile.json'),JSON.stringify({schemaVersion:1,demo:false,values:{basic:[{name:'测试用户'}],projects:[{name:'保留项目',description:'完整的原始事实'}]}}));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  return createProfileService(root);
}
test('selective merge preserves omitted facts and rejects stale revisions',t=>{
  const svc=fixture(t), before=svc.read();
  const after=svc.merge([{group:'basic',index:0,key:'email',before:'',value:'sample@example.invalid'}],before.hash);
  assert.equal(after.profile.values.projects[0].description,'完整的原始事实');
  assert.throws(()=>svc.save(before.profile,before.hash),/已变化/);
  assert.throws(()=>svc.merge([{group:'basic',index:0,key:'name',before:'错误',value:'新名字'}],after.hash),/已变化/);
  assert.equal(svc.read().hash,after.hash);
});
test('undo creates a new revision and malformed facts never replace valid profile',t=>{
  const svc=fixture(t),before=svc.read();
  const after=svc.save({...before.profile,values:{...before.profile.values,basic:[{name:'更改'}]}},before.hash);
  assert.equal(svc.history().length,1);
  const restored=svc.restore(before.hash,after.hash);
  assert.equal(restored.profile.values.basic[0].name,'测试用户');
  assert.equal(svc.history().length,2);
  assert.throws(()=>svc.save({...restored.profile,values:{basic:[]}},restored.hash));
  assert.equal(svc.read().hash,restored.hash);
});
test('corrupt current profile can be restored; a damaged history entry does not hide valid ones',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'profile-recovery-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'知识库'));
  const file=path.join(root,'知识库/profile.json');
  fs.writeFileSync(file,JSON.stringify({schemaVersion:1,demo:false,values:{basic:[{name:'真实资料'}]}}));
  const svc=createProfileService(root), before=svc.read();
  svc.save(before.profile,before.hash);
  fs.writeFileSync(file,'{ damaged');
  fs.writeFileSync(path.join(root,'.workbench/profile-history','a'.repeat(64)+'.json'),'broken');
  assert.equal(svc.status().valid,false);
  assert.equal(svc.history().filter(x=>!x.corrupt).length,1);
  assert.equal(svc.history().filter(x=>x.corrupt).length,1);
  const recovered=svc.restore(before.hash,svc.status().hash);
  assert.equal(recovered.profile.values.basic[0].name,'真实资料');
  assert.equal(fs.readdirSync(path.join(root,'.workbench/profile-history')).filter(x=>x.endsWith('.corrupt')).length,1);
});
