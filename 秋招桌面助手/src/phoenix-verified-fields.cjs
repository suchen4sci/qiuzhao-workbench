// Private, reviewed template values. Match origin, path and record identity;
// never infer a record from its position or overwrite an unrelated filled field.
const fs=require('node:fs'),path=require('node:path');
const {executeControl}=require('./control-dispatcher.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
function scopeMatches(rule,url){const u=new URL(url);return rule.status==='verified'&&rule.origin===u.origin&&rule.path===u.pathname&&Object.entries(rule.query||{}).every(([key,value])=>u.searchParams.get(key)===value);}
function identityMatches(identity,actual){return Object.keys(identity||{}).length>0&&Object.entries(identity).every(([k,v])=>actual[k]===v);}
async function prepare(page,profile,cancelled=()=>false){
 const file=path.join(profile.workspaceRoot||'', '知识库/06-网站适配/Phoenix逐字段已核验.json');
 if(!fs.existsSync(file))return;
 const rules=JSON.parse(fs.readFileSync(file,'utf8')).filter(r=>scopeMatches(r,page.url()));
 if(!rules.length)return;
 const field=(scope,label)=>scope.locator('.form-item').filter({has:page.locator('.form-item__text').filter({hasText:exact(label)})});
 for(const rule of rules)for(const record of rule.records){
  if(cancelled())return;
  let scope=page;
  if(record.identity){
   const rows=page.locator('.ux-standard-form');
   const values=await rows.evaluateAll(es=>es.map(e=>Object.fromEntries([...e.querySelectorAll('.form-item')].map(f=>[f.querySelector('.form-item__text')?.textContent.trim(),f.querySelector('input:not([type=file]),textarea')?.value]))));
   const indices=values.flatMap((v,i)=>identityMatches(record.identity,v)?[i]:[]);
   // Paged update forms expose one section at a time. Skip absent records only
   // when the reviewed rule explicitly opts in; ambiguity must still fail.
   if(indices.length===0&&record.create){
    const c=record.create;
    const eligible=()=>rows.filter({has:page.locator('.form-item__text').filter({hasText:exact(c.gate||Object.keys(record.identity)[0])})});
    const empty=async()=>{const candidates=eligible();const flags=await candidates.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea')].every(n=>!n.value.trim())));return flags.flatMap((v,i)=>v?[i]:[]);};
    let blanks=await empty();
    if(blanks.length>1)throw Error('已核验记录存在多个空白候选，未猜选');
    if(!blanks.length){
     const before=await rows.count(),button=page.getByText(c.button,{exact:true});
     if(await button.count()!==1)throw Error('已核验记录新增入口不唯一');
     await button.click();
     await page.waitForFunction(n=>document.querySelectorAll('.ux-standard-form').length>n,before,{timeout:3000});
     blanks=await empty();
    }
    if(blanks.length!==1)throw Error('新增后未出现唯一空白记录');
    scope=eligible().nth(blanks[0]);
    if(c.gate)await executeControl(page,field(scope,c.gate).locator('.phoenix-radio-group'),{value:'是'});
    for(const [label,value] of Object.entries(record.identity)){
     const input=field(scope,label).locator('input:not([type=file]),textarea');
     await input.waitFor({state:'visible',timeout:3000});
     await executeControl(page,input,{value});
    }
   }else{
    if(indices.length===0&&record.onlyWhenPresent===true)continue;
    if(indices.length!==1)throw Error('已核验记录身份不唯一，未写入：'+Object.keys(record.identity).join('/'));
    scope=rows.nth(indices[0]);
   }
  }
  for(const [label,value] of Object.entries(record.fields)){
   if(cancelled())return;
   const surface=field(scope,label);
   const radio=surface.locator('.phoenix-radio-group');
   const input=await radio.count()===1?radio:surface.locator('input:not([type=file]):not([type=checkbox]):not([type=radio]),textarea');
   if(await input.count()!==1)throw Error('已核验字段不唯一：'+label);
   const read=()=>input.evaluate(require('./control-value.cjs').controlValue);
   const current=await read();
   if(current===value||current.trim())continue;
   await executeControl(page,input,{value,allowOverwrite:false});
   if(await read()!==value)throw Error('已核验字段回读不一致：'+label);
  }
 }
}
module.exports={prepare,scopeMatches,identityMatches};
