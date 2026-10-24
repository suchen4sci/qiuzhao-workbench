// Structure-driven save/navigation. Final application actions are never selected.
const SAVE_NEXT=/^保存(?:并|后)(?:下一步|翻页|进入下一页|翻到下一页)$/;
async function fingerprint(page){return page.evaluate(()=>JSON.stringify({url:location.origin+location.pathname+location.search,headings:Array.from(document.querySelectorAll('h1,h2,.dl_menutit')).filter(e=>e.getClientRects().length).map(e=>e.textContent.trim()),fields:Array.from(document.querySelectorAll('input:not([type=hidden]),select,textarea')).filter(e=>e.getClientRects().length).map(e=>e.name||e.id)}));}
async function safeNext(page){const result=page.getByText(SAVE_NEXT).filter({visible:true});if(await result.count()>1)throw Error('保存并翻页入口不唯一');if(await result.count()===1)return result;
 const legacy=page.locator('input[title="Next"][onclick*="saveCheck"]:visible');
 if(await legacy.count()===1&&await page.locator('#container [cname]').count()){
  const navigation=await page.locator('li.leftli1,li.leftli2').evaluateAll(es=>({count:es.length,current:es.findIndex(e=>e.classList.contains('leftli2'))}));
  if(navigation.current>=0&&navigation.current<navigation.count-1)return legacy;
 }
 return null;}
async function runSavedPageFlow(page,profile,selections,cancelled,progress,fillSinglePage){
 const fields=[],steps=[];const started=Date.now(),seen=new Set();
 const enabled=profile.workflow?.auto_save===true&&profile.workflow?.auto_save_and_next===true;
 for(let n=0;n<10;n++){
  if(cancelled())break;
  const before=await fingerprint(page);if(seen.has(before))throw Error('页面重复，已停止自动翻页');seen.add(before);
  if(enabled&&await page.locator('.mainContainer .form_container h2.form_title strong').count()){
   let records;try{records=await require('./legacy-records.cjs').completeLegacyRecords(page,profile,cancelled);}catch(e){fields.push({label:'保存经历记录',status:'pending',required:true,reason:e.message});break;}
   for(const r of records)for(const f of r.fields)fields.push({...f,label:require('./rules.cjs').groups[r.group].label+' '+(r.index+1)+' · '+f.label,reason:'记录已保存，保存后回读通过'});
  }
  const report=await fillSinglePage(page,profile,selections,cancelled,progress);fields.push(...report.fields);
  for(const link of await page.locator('.fileuploadname a:visible').all())if(await link.getAttribute('href'))fields.push({label:'简历附件',status:'existing',fileNames:[await link.innerText()],reason:'已保存的附件文件名及预览链接可见；未改动附件版本'});
  const next=enabled&&!cancelled()?await safeNext(page):null;
  if(!next)break;
  const missing=report.fields.filter(f=>f.required&&['pending','failed'].includes(f.status));
  if(missing.length){steps.push({url:page.url(),status:'blocked',reason:'必填项未通过回读'});break;}
  const legacyNext=(await next.getAttribute('title'))==='Next';
  const label=(await next.innerText())||(legacyNext?'保存并下一步':'');await next.click({timeout:10000});
  let changed=false;for(let attempt=0;attempt<80;attempt++){if(await fingerprint(page)!==before){changed=true;break;}await new Promise(r=>setTimeout(r,100));}
  if(!changed){fields.push({label,status:'pending',reason:'保存后未进入新页面，需检查网站校验错误'});break;}
  if(legacyNext)await page.locator('#container h1:visible').waitFor({timeout:10000});
  steps.push({action:label,status:'saved-and-navigated',url:page.url()});
  progress({fields,steps,counts:counts(fields)});
 }
 if(steps.length===10)fields.push({label:'自动翻页',status:'pending',reason:'达到10页上限，请检查后继续'});
 const text=await page.locator('body').innerText();
 const blocked=text.match(/您的[^\n]{0,80}(?:还未填写完整|无法提交申请)/);
 if(blocked)fields.push({label:'最终预览校验',status:'pending',reason:blocked[0]});
 return {fields,steps,elapsedMs:Date.now()-started,counts:counts(fields),pageStatus:/您的简历已经符合投递要求/.test(text)?'ready-not-submitted':undefined};
}
function counts(fields){return Object.fromEntries(['filled','ready','pending','existing','failed','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]));}
module.exports={runSavedPageFlow,SAVE_NEXT,fingerprint,safeNext};
