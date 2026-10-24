const test=require('node:test'),assert=require('node:assert/strict');
const {projectMatches}=require('../src/project-identity.cjs');
test('project identity reuses confirmed aliases and source suffix without loose substring matching',()=>{
 const r={name:'Fixture FPGA TDC ｜ Fixture funding',aliases:['Fixture TDC code']};
 assert.ok(projectMatches(r,'Fixture TDC code'));assert.ok(projectMatches(r,'FixtureFPGA TDC'));assert.ok(projectMatches(r,'Fixture FPGA TDC | Fixture funding'));
 assert.equal(projectMatches(r,'FPGA'),false);assert.equal(projectMatches(r,'description fragment'),false);assert.equal(projectMatches(r,''),false);
});
