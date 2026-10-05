const { test } = require('node:test');
const assert = require('node:assert/strict');
const { importJob, safeUrl } = require('../src/dashboard-import.cjs');
const request = {company:'示例公司',role:'验证工程师',url:'https://example.com/jobs?token=secret#/resume',date:'2026-09-19',confirmed:true};
test('import creates applied job, removes query secrets, requires explicit applied confirmation', async () => {
  let posted;
  const api = async (route,method,body) => method === 'POST' ? (posted=body,{job:body}) : {jobs:[]};
  const result = await importJob(request,api);
  assert.equal(result.updated,false); assert.equal(posted['当前状态'],'已投递'); assert(!posted['投递链接'].includes('secret'));
  await assert.rejects(()=>importJob({...request,confirmed:false},api));
  await assert.rejects(()=>importJob({...request,date:'2026-02-30'},api));
  assert.throws(()=>safeUrl('file:///private'));
});
test('duplicate updates in place and preserves advanced stage and original application date', async () => {
  let patch;
  const existing = {'公司名称':'示例公司','投递岗位':'验证工程师','记录ID':'id','当前状态':'一面','投递日期':'2026-09-10',__version:'v'};
  const api = async (route,method,body) => method === 'PATCH' ? (patch=body,{job:{...existing,...body.patch}}) : {jobs:[existing]};
  const result = await importJob(request,api);
  assert(result.updated); assert.equal(result.job['当前状态'],'一面'); assert.equal(result.job['投递日期'],'2026-09-10'); assert.equal(patch.expectedVersion,'v');
});
