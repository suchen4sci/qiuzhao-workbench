const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function allows(format,accept){
 if(!String(accept||'').trim())return true;
 const tokens=String(accept).toLowerCase().split(',').map(s=>s.trim());
 return tokens.some(s=>s==='*/*'||s==='.'+format||s===(format==='png'?'image/png':'application/pdf')||(format==='png'&&s==='image/*'));
}
function chooseTranscript(catalog,level,accept){
 if(catalog?.transcript_policy?.status!=='user-confirmed')return null;
 const rows=(catalog.attachments||[]).filter(a=>a.kind==='课程成绩单'&&a.education_level===level&&a.status==='user-confirmed');
 for(const format of catalog.transcript_policy.preferred_formats||['png','pdf']){
  if(!allows(format,accept))continue;
  const found=rows.filter(a=>(a.format||path.extname(a.path).slice(1).toLowerCase())===format);
  if(found.length>1)return null;
  if(found.length===1)return found[0];
 }
 return null;
}
function authorized(profile,attachment){
 const root=profile.workspaceRoot;if(!root||!attachment)return false;
 const full=path.resolve(attachment.path);
 return (profile.workflow?.upload_authorized||[]).some(rel=>{
  const dir=path.resolve(root,rel),relative=path.relative(dir,full);
  return relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative);
 });
}
async function ensurePhoenixTranscripts(page,profile,cancelled=()=>false){
 const result=[];
 if(!profile.attachmentCatalog)return result;
 const titles=page.locator('.form-item__title').filter({hasText:/^(本硕成绩单|成绩单|课程成绩单)$/});
 const rows=page.locator('.ux-standard-form').filter({has:titles});
 for(const row of await rows.all()){
  if(cancelled())break;
  const levelText=await row.locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^学历$/})}).locator('.phoenix-select__calcEle').allTextContents();
  const level=levelText.length===1?({'硕士研究生':'研究生','硕士':'研究生','本科':'本科'})[levelText[0].trim()]:null;
  if(!level){result.push({label:'成绩单上传',status:'pending',reason:'教育学历无法唯一匹配成绩单'});continue;}
  const wrapper=row.locator('.form-item').filter({has:titles}).locator('.file-uploader__wrapper');
  if(await wrapper.count()!==1)throw Error('成绩单上传入口不唯一');
  const input=wrapper.locator('input[type=file]');
  const attachment=chooseTranscript(profile.attachmentCatalog,level,await input.getAttribute('accept'));
  if(!attachment||!authorized(profile,attachment)){result.push({label:level+'成绩单',status:'pending',reason:'未找到格式兼容且已授权的成绩单原件'});continue;}
  const list=wrapper.locator('.file-uploader__list-view');
  if((await list.innerText()).includes(attachment.filename)){result.push({label:level+'成绩单',status:'existing',reason:'已显示对应原件文件名，保留；保存需另行核验'});continue;}
  if((await list.innerText()).trim()){result.push({label:level+'成绩单',status:'pending',reason:'已有不同附件，未覆盖'});continue;}
  const data=fs.readFileSync(attachment.path);
  if(crypto.createHash('sha256').update(data).digest('hex')!==attachment.sha256)throw Error(level+'成绩单文件已变化，须重新核对原件');
  await input.setInputFiles(attachment.path);
  try{
   await list.getByText(attachment.filename,{exact:true}).first().waitFor({state:'visible',timeout:6000});
   result.push({label:level+'成绩单',status:'filled',reason:'已选择原件且上传列表显示文件名；尚未核验保存'});
  }catch{result.push({label:level+'成绩单',status:'pending',reason:'已选择原件但网站未显示上传结果，未标成功'});}
 }
 return result;
}
module.exports={allows,chooseTranscript,authorized,ensurePhoenixTranscripts};
