const fs=require('node:fs'),path=require('node:path');
const normalize=s=>String(s).replace(/\s+/g,'');
function matches(url,plan){try{const u=new URL(url);return u.origin===plan.origin&&u.pathname===plan.pathname&&['job_id','project_id','resume_id','template_id'].every(k=>plan.scope[k]&&u.searchParams.get(k)===plan.scope[k]);}catch{return false;}}
function loadPlan(page){const file=path.resolve(__dirname,'../../知识库/06-网站适配/iguopin-reviewed.json');if(!fs.existsSync(file))return null;const plan=JSON.parse(fs.readFileSync(file,'utf8'));return matches(page.url(),plan)?plan:null;}
async function fill(page,plan,cancelled=()=>false){
 const fields=[],started=Date.now();
 const result=()=>({fields,elapsedMs:Date.now()-started,counts:Object.fromEntries(['filled','existing','pending','failed','ready','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]))});
 if(!matches(page.url(),plan))return result();
 if(await page.locator('form:visible').count()){fields.push({label:'编辑状态',status:'pending',reason:'存在尚未保存的编辑器，请先保存，避免跨栏目丢失内容'});return result();}
 // Only this verified text section is automatically repaired. Other discrepancies
 // remain explicit pending findings, never silently overwritten by generic mapping.
 const assessment=page.locator('div[id="assessment"]').first();
 if(!normalize(await assessment.innerText()).includes(normalize(plan.assessment))&&!cancelled()){
  await assessment.locator('.section-title-content button').click();
  const form=page.locator('form:visible');await form.locator('textarea#assessment').fill(plan.assessment);
  await form.getByRole('button',{name:'保 存',exact:true}).click();
  await form.waitFor({state:'hidden',timeout:10000});
  fields.push({label:'自我评价',status:'filled',reason:'已按本岗位审核过的技术版本修复并保存'});
 }
 for(const c of plan.checks){if(cancelled())break;const el=page.locator('div[id="'+c.id+'"]').first();const text=await el.innerText(),count=await el.locator('.item-section-tpl').count();const ok=normalize(text)===normalize(c.text)&&count===c.records;fields.push({label:c.id,status:ok?'existing':'pending',reason:ok?'保存栏目正文与记录数回读一致':'栏目内容或记录数变化，需要重新核验；未猜测或覆盖'});}
 return result();
}
module.exports={matches,normalize,loadPlan,fill};
