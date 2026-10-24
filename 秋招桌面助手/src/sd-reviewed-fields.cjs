// Private reviewed values, scoped to one application and identified record.
const fs=require('node:fs'),path=require('node:path');
const {fillSelect}=require('./sd-controls.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$');
function matches(rule,url){const u=new URL(url);return rule.status==='verified'&&rule.origin===u.origin&&rule.path===u.pathname&&rule.hash===u.hash&&Object.entries(rule.query||{}).every(([k,v])=>u.searchParams.get(k)===v);}
async function prepare(page,profile,cancelled=()=>false){
 const file=path.join(profile.workspaceRoot||'','知识库/06-网站适配/SD逐字段已核验.json');
 if(!fs.existsSync(file))return;
 const rules=JSON.parse(fs.readFileSync(file,'utf8')).filter(r=>matches(r,page.url()));
 const field=(scope,label)=>scope.locator('[class*="apply-field-"]').filter({has:page.locator(':scope > [class*="title-"]').filter({hasText:exact(label)})});
 const read=f=>f.evaluate(e=>e.querySelector('[class*="sd-Input-display-value-"]')?.textContent.trim()||e.querySelector('textarea,input')?.value||'');
 for(const rule of rules)for(const item of rule.fields){
  if(cancelled())return;
  let scope=page.locator(`[data-nav-id="${item.section}"]`);
  if(await scope.count()!==1)continue;
  if(item.identity){
   const rows=scope.locator('[class*="apply-fields-"]'),found=[];
   for(const row of await rows.all()){
    let same=true;for(const [label,value]of Object.entries(item.identity)){const f=field(row,label);if(await f.count()!==1||await read(f)!==value){same=false;break;}}
    if(same)found.push(row);
   }
   if(found.length!==1)throw Error('SD已核验记录身份不唯一：'+item.label);
   scope=found[0];
  }
  const f=field(scope,item.label);if(await f.count()!==1)throw Error('SD已核验字段不唯一：'+item.label);
  if(await read(f))continue;
  const input=f.locator('textarea,input:not([type=checkbox]):not([type=radio])');
  if(await input.count()!==1)throw Error('SD已核验控件不唯一：'+item.label);
  if(item.kind==='cascader'){
   await input.click();for(const text of item.steps)await f.locator('[class*="sd-Menu-content-item-"]:visible').filter({hasText:exact(text)}).click();
  }else if(item.kind==='select')await fillSelect(page,input,item.value);
  else if(item.kind==='text'){await input.fill(item.value);await input.press('Tab');}
  else throw Error('SD未知已核验执行类型');
  if(await read(f)!==item.value)throw Error('SD已核验字段回读失败：'+item.label);
 }
}
module.exports={prepare,matches};
