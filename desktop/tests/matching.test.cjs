const test=require('node:test'),assert=require('node:assert/strict');
const {matchOpportunity,validatePreferences,searchQueries}=require('../src/services/matching.cjs');
const profile={values:{basic:[{highestEducation:'硕士',graduationDate:'2027-06'}]}};
const job={route:['enterprise'],nature:['私企'],direction:['销售'],city:['北京'],openStatus:'open',statusVerified:true,eligibility:{anyOf:[[{field:'highestEducation',operator:'minimum',values:['本科'],verified:true,evidence:'本科及以上'}]]}};
const prefs={plans:[{id:'a',conditions:{route:['civil'],direction:['技术']}},{id:'b',conditions:{route:['enterprise'],nature:['私企'],direction:['销售']}}]};
test('OR between plans and tags; AND between dimensions without leaking across cards',()=>{
 assert.equal(matchOpportunity(job,profile,prefs).included,true);
 assert.deepEqual(matchOpportunity(job,profile,prefs).matchedPlans.map(x=>x.id),['b']);
 assert.equal(matchOpportunity({...job,route:['civil']},profile,prefs).included,false);
 assert.equal(matchOpportunity({...job,route:['civil'],direction:['软件开发']},profile,prefs).included,true);
 assert.equal(matchOpportunity(job,profile,{plans:[{conditions:{direction:['技术','销售']}}]}).included,true);
});
test('unknown conditions retain high recall; explicit exclusion wins; soft preferences only rank',()=>{
 const unknown=matchOpportunity({...job,direction:undefined},profile,prefs);
 assert.equal(unknown.included,true);assert.equal(unknown.tier,'verify');
 assert.equal(matchOpportunity(job,profile,{...prefs,excluded:{city:['北京']}}).included,false);
 const soft=matchOpportunity(job,profile,{plans:[{conditions:{},preferred:{city:['上海']}}]});
 assert.equal(soft.included,true);assert.equal(soft.tier,'explore');
});
test('qualification alternatives are OR, unknown facts and unverified evidence do not hard filter',()=>{
 const rule={field:'graduationYear',operator:'oneOf',values:['2026'],verified:true,evidence:'2026届'};
 assert.equal(matchOpportunity({...job,eligibility:{anyOf:[[rule]]}},profile,prefs).included,false);
 assert.equal(matchOpportunity({...job,eligibility:{anyOf:[[{...rule,verified:false}]]}},profile,prefs).included,true);
 assert.equal(matchOpportunity({...job,eligibility:{anyOf:[[rule],job.eligibility.anyOf[0]]}},profile,prefs).tier,'recommended');
 assert.equal(matchOpportunity(job,{values:{basic:[{}]}},prefs).tier,'verify');
});
test('closing without reliable confirmation stays visible and query expansion is explicit',()=>{
 assert.equal(matchOpportunity({...job,openStatus:'closed',statusVerified:false},profile,prefs).included,true);
 assert.equal(matchOpportunity({...job,openStatus:'closed'},profile,prefs).included,false);
 assert.ok(searchQueries(prefs).some(q=>q.terms.includes('研发')));
 assert.throws(()=>validatePreferences({plans:[{conditions:{route:['not-a-route']}}]}));
});
test('malformed qualification values and certificate naming differences never silently discard candidates',()=>{
 const malformed={...job,eligibility:{anyOf:[[{field:'graduationYear',operator:'oneOf',values:[null],verified:true,evidence:'要求未知'}]]}};
 assert.equal(matchOpportunity(malformed,profile,prefs).included,true);
 const certificate={...job,eligibility:{anyOf:[[{field:'certificates',operator:'oneOf',values:['CET6'],verified:true,evidence:'英语六级'}]]}};
 assert.equal(matchOpportunity(certificate,{values:{basic:[{}],languages:[{name:'大学英语六级'}]}},prefs).tier,'recommended');
 const yearJob={...job,eligibility:{anyOf:[[{field:'graduationYear',operator:'oneOf',values:['2027'],verified:true,evidence:'2027届'}]]}};
 assert.equal(matchOpportunity(yearJob,{values:{basic:[{graduationYear:'2027'}]}},prefs).tier,'recommended');
 const two={plans:[{conditions:{route:['enterprise']}},{conditions:{keyword:['不存在'],industry:['未知']}}]};
 assert.equal(matchOpportunity(job,profile,two).tier,'recommended');
});
