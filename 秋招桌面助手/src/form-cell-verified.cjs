// Exact reviewed templates supplement generic control handling; values stay private.
const fs=require('node:fs'),path=require('node:path');
const {scopeMatches}=require('./phoenix-verified-fields.cjs');
const {executeControl}=require('./control-dispatcher.cjs');
function inspectRow(row){
 const visible=e=>!!e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden';
 return [...row.querySelectorAll('.ant-form-item')].filter(visible).map(field=>{
  const label=field.querySelector('.ant-form-item-label label')?.cloneNode(true);label?.querySelectorAll('.labelRequired,.remarkShow').forEach(e=>e.remove());
  const controls=[...field.querySelectorAll('.ant-select,.ant-radio-group,input:not([type=file]):not([type=hidden]),textarea')].filter(e=>visible(e)&&!e.parentElement.closest('.ant-select,.ant-radio-group'));
  return {label:label?.textContent.trim(),values:controls.map(e=>e.matches('.ant-select')?e.querySelector('.ant-select-selection-selected-value')?.textContent.trim()||'':e.matches('.ant-radio-group')?e.querySelector('label.ant-radio-wrapper-checked')?.textContent.trim()||'':e.value||'')};
 }).filter(f=>f.label&&f.values.length);
}
function sameIdentity(fields,identity){return Object.keys(identity||{}).length>0&&Object.entries(identity).every(([k,v])=>fields.find(f=>f.label===k)?.values.join(' / ')===v);}
async function prepare(page,profile,cancelled=()=>false){
 const file=path.join(profile.workspaceRoot||'','知识库/06-网站适配/FormCell逐字段已核验.json');if(!fs.existsSync(file))return;
 const rules=JSON.parse(fs.readFileSync(file,'utf8')).filter(r=>scopeMatches(r,page.url()));
 for(const rule of rules)for(const record of rule.records){
  if(cancelled())return;
  const section=page.locator('.form-cell').filter({has:page.locator('.tit p').filter({hasText:new RegExp('^'+record.section+'$')})});
  if(await section.count()!==1)continue;
  const rows=section.locator('.form-cell-inner');let row;
  if(record.identity){const snapshots=[];for(let i=0;i<await rows.count();i++)snapshots.push(await rows.nth(i).evaluate(inspectRow));const matches=snapshots.flatMap((r,i)=>sameIdentity(r,record.identity)?[i]:[]);if(matches.length!==1)continue;row=rows.nth(matches[0]);}
  else {if(await rows.count()!==1)continue;row=rows.first();}
  for(const field of record.fields){
   if(cancelled())return;
   const fields=row.locator('.ant-form-item').filter({visible:true});const labels=await fields.evaluateAll(es=>es.map(e=>{const n=e.querySelector('.ant-form-item-label label')?.cloneNode(true);n?.querySelectorAll('.labelRequired,.remarkShow').forEach(x=>x.remove());return n?.textContent.trim();}));
   const indexes=labels.flatMap((label,i)=>label===field.label?[i]:[]);if(indexes.length!==1)continue;
   const surface=fields.nth(indexes[0]);const controls=surface.locator('.ant-select,.ant-radio-group,input:not([type=file]):not([type=hidden]),textarea').filter({visible:true});
   // Select top-level widget roots, excluding their internal search/radio inputs.
   const indices=await controls.evaluateAll(es=>es.flatMap((e,i)=>e.parentElement.closest('.ant-select,.ant-radio-group')?[]:[i]));if(indices.length!==field.values.length)continue;
   for(let n=0;n<indices.length;n++){const value=field.values[n];if(!value)continue;const control=controls.nth(indices[n]);const current=await control.evaluate(require('./control-value.cjs').controlValue);if(current)continue;await executeControl(page,control,{value,cancelled});}
  }
 }
}
module.exports={prepare,inspectRow,sameIdentity};
