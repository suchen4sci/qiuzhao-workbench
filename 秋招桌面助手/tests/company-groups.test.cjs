const{test}=require('node:test'),assert=require('node:assert/strict');
const{openedMetadata,migrate,groups}=require('../src/ui/company-groups.js');
const{ApplicationTabRegistry}=require('../src/application-tab-registry.cjs');
test('opener identity follows company across a generic authentication domain',()=>{const tabs=[{id:'A01',company:'甲公司',companyId:'A01',url:'https://one.example/jobs',role:'硬件'}];assert.deepEqual(openedMetadata(tabs,'A01','https://passport.example/auth'),{parentId:'A01',companyId:'A01',company:'甲公司',role:'硬件',companySource:'opener'});});
test('different ATS tenants never inherit an unrelated company',()=>{const tabs=[{id:'A01',company:'甲公司',url:'https://app.mokahr.com/campus-recruitment/one/123'}];assert.equal(openedMetadata(tabs,'A01','https://app.mokahr.com/campus-recruitment/two/456').companyId,undefined);assert.equal(openedMetadata(tabs,'A01','https://other.zhiye.com/campus').companyId,undefined);});
test('legacy generic resume titles merge only with an unambiguous ATS tenant',()=>{const tabs=[{id:'A01',company:'甲公司',url:'https://wecruit.hotjob.cn/SUabc/pb/jobs'},{id:'A02',company:'乙公司',url:'https://wecruit.hotjob.cn/SUdef/pb/jobs'},{id:'A03',company:'',title:'简历操作',url:'https://wecruit.hotjob.cn/SUabc/pb/resume'}];migrate(tabs);assert.equal(tabs[2].companyId,'A01');assert.equal(tabs[2].company,'甲公司');assert.equal(groups(tabs).length,2);});
test('ambiguous shared tenant and global authentication pages stay unassigned without provenance',()=>{const tabs=[{id:'A01',company:'甲单位',url:'https://group.zhiye.com/jobs'},{id:'A02',company:'乙单位',url:'https://group.zhiye.com/jobs'},{id:'A03',company:'',url:'https://group.zhiye.com/resume'},{id:'A04',company:'',url:'https://www.iguopin.com/auth/c'}];migrate(tabs);assert.equal(tabs[2].companyId,'A03');assert.equal(tabs[3].companyId,'A04');});
test('company identity survives root tab close and restart',()=>{const r=new ApplicationTabRegistry();const a=r.add('https://one.example/jobs',{company:'甲公司'});const child=r.add('https://passport.example/auth',openedMetadata(r.tabs,a.id,'https://passport.example/auth'));r.close(a.id);const restored=new ApplicationTabRegistry(r.snapshot());assert.equal(restored.get(child.id).companyId,a.id);assert.equal(groups(restored.tabs)[0].company,'甲公司');});
test('legacy standalone company pages merge but shared job boards do not',()=>{const tabs=[{id:'A01',company:'甲公司',url:'https://own.example/'},{id:'A02',company:'',companyId:'A02',url:'https://own.example/jobs'},{id:'A03',company:'乙公司',url:'https://www.iguopin.com/company?id=1'},{id:'A04',company:'',url:'https://www.iguopin.com/company?id=2'}];migrate(tabs);assert.equal(tabs[1].companyId,'A01');assert.equal(tabs[3].companyId,'A04');});
const {closeCompany}=require('../src/ui/company-groups.js');
test('close company snapshots children, including orphaned root, without closing neighbours',async()=>{
 const tabs=[{id:'A2',companyId:'A1'},{id:'A3',companyId:'A1'},{id:'B1',companyId:'B1'}],calls=[];
 const api=async r=>{calls.push(r);if(r.action==='list')return {tabs};if(r.action==='close')tabs.splice(tabs.findIndex(t=>t.id===r.id),1);};
 assert.deepEqual(await closeCompany(api,'A1'),['A2','A3']);assert.deepEqual(tabs.map(t=>t.id),['B1']);assert.equal(calls.filter(r=>r.action==='open').length,0);
});
test('last company opens neutral page before closing all children',async()=>{
 const calls=[],api=async r=>{calls.push(r);if(r.action==='list')return {tabs:[{id:'A1'},{id:'A2',companyId:'A1'}]};};
 await closeCompany(api,'A1');assert.deepEqual(calls.map(r=>r.action),['list','open','close','close']);assert.equal(calls[1].company,'秋招看板');
});
test('unknown company closes nothing',async()=>{const calls=[];assert.deepEqual(await closeCompany(async r=>{calls.push(r);return {tabs:[]};},'missing'),[]);assert.equal(calls.length,1);});
