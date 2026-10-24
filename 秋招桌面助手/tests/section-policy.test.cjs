const test=require('node:test'),assert=require('node:assert/strict');
const {scopedProfile}=require('../src/section-policy.cjs');
test('scoped record exclusion wins over additions without deleting other experiences',()=>{
 const p={values:{practices:[{name:'Research'},{name:'Independent activity'}]},workflow:{section_policies:[{status:'user-confirmed',origin:'https://example.test',path:'/resume',query:{company:'one'},additional_records:[{group:'practices',record:{name:'Independent activity'}}],exclude_records:[{group:'practices',identity:{name:'Independent activity'}}]}]}};
 const s=scopedProfile(p,'https://example.test/resume?company=one');assert.deepEqual(s.values.practices,[{name:'Research'}]);assert.equal(p.values.practices.length,2);assert.deepEqual(scopedProfile(s,'https://example.test/resume?company=one').values.practices,s.values.practices);assert.equal(scopedProfile(p,'https://example.test/resume?company=two'),p);
});
test('query-scoped sales experience is first only in the confirmed job',()=>{
 const p={values:{internship:[{company:'芯片实习'}]},workflow:{section_policies:[{status:'user-confirmed',origin:'https://example.test',path:'/resume',query:{postid:'sales'},additional_records:[{group:'internship',prepend:true,record:{company:'自主经营'}}]}]}};
 assert.deepEqual(scopedProfile(p,'https://example.test/resume?postid=sales').values.internship.map(x=>x.company),['自主经营','芯片实习']);
 assert.equal(scopedProfile(p,'https://example.test/resume?postid=hardware'),p);
 assert.equal(scopedProfile(p,'https://example.test/resume'),p);
});
test('additional independent-business record stays job scoped and idempotent',()=>{
 const p={values:{internship:[{company:'真实实习'}]},workflow:{section_policies:[{status:'user-confirmed',origin:'https://example.test',path:'/campus#/job/one/apply',additional_records:[{group:'internship',record:{company:'自主经营（非受雇实习）',position:'独立运营者'}}]}]}};
 const url='https://example.test/campus#/job/one/apply';
 const s=scopedProfile(p,url);assert.equal(s.values.internship.length,2);assert.equal(p.values.internship.length,1);
 assert.equal(scopedProfile(s,url).values.internship.length,2);
 assert.equal(scopedProfile(p,'https://example.test/campus#/job/two/apply'),p);
});
test('confirmed exclusion stays within exact origin and application hash without mutating old adapters',()=>{
 const url='https://example.test/campus#/job/one/apply';
 const profile={values:{campus:[{name:'Fixture activity'}],education:[{school:'Fixture school'}]},workflow:{section_policies:[{origin:'https://example.test',path:'/campus#/job/one/apply',skip_groups:['campus'],status:'user-confirmed'}]}};
 const scoped=scopedProfile(profile,url);assert.deepEqual(scoped.values.campus,[]);assert.deepEqual(scoped.ignoredSections,['campus']);assert.equal(scoped.values.education,profile.values.education);assert.equal(profile.values.campus.length,1);
 for(const other of ['https://other.test/campus#/job/one/apply','https://example.test/campus#/job/two/apply','https://example.test/other#/job/one/apply'])assert.equal(scopedProfile(profile,other),profile);
 const unconfirmed={...profile,workflow:{section_policies:[{...profile.workflow.section_policies[0],status:'unknown'}]}};assert.equal(scopedProfile(unconfirmed,url),unconfirmed);
});
