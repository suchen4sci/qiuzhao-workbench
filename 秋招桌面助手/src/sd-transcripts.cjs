const {chooseTranscript,authorized}=require('./transcript-upload.cjs');
const fs=require('fs'),crypto=require('crypto');
function sdUploadsReady(el,names){const root=el.closest('[class*="apply-field-"]')||el;return names.every(name=>[...root.querySelectorAll('[class*="sd-Upload-list-"]')].some(row=>row.querySelector('[class*="sd-Upload-file-name-"]')?.textContent===name&&!/上传中|上传失败|失败重试/.test(row.textContent)&&(/^https?:/.test(row.querySelector('img')?.getAttribute('src')||'')||(/\.pdf$/i.test(name)&&/^\d+(?:\.\d+)?\s*[KM]?B$/i.test(row.querySelector('[class*="sd-Upload-ellipsis-"]')?.textContent.trim()||'')))));}
function chooseSDTranscript(catalog,level,accept,url){const u=new URL(url);const variants=(catalog.sd_transcript_variants||[]).filter(a=>a.status==='derived-verified'&&a.origin===u.origin&&a.portal_path===u.pathname&&a.education_level===level&&require('./transcript-upload.cjs').allows(a.format,accept));if(variants.length>1)throw Error('上传压缩副本不唯一');return variants[0]||chooseTranscript(catalog,level,accept);}
async function ensureSDTranscripts(page,profile,cancelled=()=>false){
 const result=[];const fields=page.locator('[class*="apply-field-"]').filter({has:page.locator(':scope > [class*="title-"]').filter({hasText:/^(请上传成绩单|成绩单|课程成绩单)$/})});
 for(const field of await fields.all()){
  if(cancelled())break;const input=field.locator('input[type=file]');if(await input.count()!==1||!await field.locator('[class*="sd-Upload-"]').count())continue;
  const highest=profile.values.basic[0].highestEducation,levels=await input.evaluate(e=>e.multiple)?['本科','研究生']:highest==='硕士研究生'?['研究生']:highest==='本科'?['本科']:[];
  const accept=await input.getAttribute('accept'),attachments=levels.map(l=>chooseSDTranscript(profile.attachmentCatalog,l,accept,page.url()));
  if(!attachments.length||attachments.some(a=>!a||!authorized(profile,a)))throw Error('成绩单缺少已授权且格式兼容的确认原件');
  let changed=false;
  for(const a of attachments){
   if(cancelled())break;if(await input.evaluate(sdUploadsReady,[a.filename]))continue;
   const row=field.locator('[class*="sd-Upload-list-"]').filter({has:page.getByText(a.filename,{exact:true})});
   if(await row.count()){
    if(await row.count()!==1)throw Error('已有重复成绩单，未删除');
    const stalled=await row.evaluate(e=>/上传中\s*:\s*100%/.test(e.textContent)&&/^data:/.test(e.querySelector('img')?.getAttribute('src')||''));
    if(!stalled)throw Error('已有成绩单尚未完成，保留待核验');
    await row.locator('[class*="sd-Upload-delete-icon-"]').click();await row.waitFor({state:'detached',timeout:3000});
   }
   if(crypto.createHash('sha256').update(fs.readFileSync(a.path)).digest('hex')!==a.sha256)throw Error('成绩单原件 SHA256 校验失败');
   await input.setInputFiles(a.path);changed=true;await field.getByText(a.filename,{exact:true}).waitFor({state:'visible',timeout:20000});
   for(let i=0;i<50;i++){if(await input.evaluate(sdUploadsReady,[a.filename]))break;if(i===49)throw Error('成绩单上传未完成，未标成功');await page.waitForTimeout(400);}
  }
  result.push({label:'请上传成绩单',status:changed?'filled':'existing',names:attachments.map(a=>a.filename)});
 }
 return result;
}
module.exports={ensureSDTranscripts,sdUploadsReady,chooseSDTranscript};
