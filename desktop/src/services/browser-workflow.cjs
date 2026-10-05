'use strict';
const fs=require('node:fs'),{randomUUID}=require('node:crypto');
const {safeUrl}=require('../dashboard-import.cjs');
async function uploadFields(page){
 const result=[];
 for(const [frameIndex,frame]of page.frames().entries()){
  const inputs=frame.locator('input[type=file]'),count=await inputs.count();
  if(count>30)throw Error('附件控件过多，请只打开当前申请栏目');
  for(let index=0;index<count;index++){
   const info=await inputs.nth(index).evaluate(el=>({name:el.name||'',id:el.id||'',accept:el.accept||'',multiple:el.multiple,disabled:el.disabled,label:el.labels?.[0]?.textContent.trim().slice(0,200)||el.getAttribute('aria-label')||el.closest('label')?.textContent.trim().slice(0,200)||el.name||'附件',files:[...el.files].map(f=>({name:f.name,size:f.size}))}));
   result.push({...info,fieldId:`file-${frameIndex}-${index}`,frameIndex,index,frameUrl:frame.url()});
  }
 }
 return result;
}
function fingerprint(field){return JSON.stringify([field.frameUrl,field.index,field.id,field.name,field.label,field.accept,field.multiple,field.disabled]);}
function supportsPDF(accept){return !accept||accept.split(',').some(s=>['.pdf','application/pdf','application/*','*/*'].includes(s.trim().toLowerCase()));}
function createBrowserWorkflow(store,assets,{getPage,getApplicationId}){
 let ticket;
 let epoch=0;
 const application=()=>{const app=store.get('applications',getApplicationId());if(!app||app.status!=='draft')throw Error('请先从投递计划打开申请草稿');return app;};
 async function scanUploads(){
  const app=application(),started=epoch,page=await getPage(),url=page.url(),fields=await uploadFields(page);
  if(epoch!==started||application().id!==app.id||application().revision!==app.revision||page.url()!==url)throw Error('扫描期间页面或申请已变化，请重试');
  ticket={token:randomUUID(),applicationId:app.id,revision:app.revision,epoch:started,url,fields,expires:Date.now()+300000};
  return {token:ticket.token,fields:fields.map(({frameUrl,...field})=>field),asset:app.assetId?store.get('assets',app.assetId):null};
 }
 async function upload(input){
  const app=application(), started=epoch;let expectedRevision=app.revision;const assertContext=()=>{const latest=application();if(epoch!==started||latest.id!==app.id||latest.revision!==expectedRevision)throw Error('申请上下文已变化，请重新核验网页');};if(!app.assetId)throw Error('请先为本次申请绑定 PDF 简历');
  if(!ticket||ticket.token!==input.token||ticket.applicationId!==app.id||ticket.revision!==app.revision||ticket.epoch!==epoch||ticket.expires<Date.now())throw Error('附件页面已变化，请重新扫描');
  const page=await getPage();if(!ticket||ticket.epoch!==epoch)throw Error('页面已变化，请重新扫描');if(page.url()!==ticket.url)throw Error('页面已切换，请重新选择附件控件');
  const before=ticket.fields.find(f=>f.fieldId===input.fieldId),current=(await uploadFields(page)).find(f=>f.fieldId===input.fieldId);
  if(!before||!current||fingerprint(before)!==fingerprint(current))throw Error('附件控件已变化，请重新扫描');
  if(current.disabled||!supportsPDF(current.accept))throw Error('该控件不接受 PDF 或尚未启用，请选择正确用途');
  if(current.files.length && input.replaceConfirmed!==true)throw Error('网页已有附件，请明确确认是否更换');
  const asset=store.get('assets',app.assetId);if(!asset||asset.hash!==app.assetHash||asset.archived)throw Error('绑定文件版本不可用，请重新选择');
  const filename=assets.file(asset.id);
  if(input.siteMaxMB !== undefined && (!Number.isFinite(input.siteMaxMB)||input.siteMaxMB<=0||asset.size>input.siteMaxMB*1024*1024))throw Error('文件超过你填写的网站大小上限');
  const locator=page.frames()[current.frameIndex].locator('input[type=file]').nth(current.index);
  const name=asset.name.toLowerCase().endsWith('.pdf')?asset.name:asset.name+'.pdf';
  assertContext(); if(page.url()!==ticket.url)throw Error('页面已变化，请重新扫描');
  const uploadUrl=page.url(); ticket=null;
  const pending={assetId:asset.id,hash:asset.hash,name,size:asset.size,at:new Date().toISOString(),state:'pending_verification',note:'已尝试选择附件，请核验网站是否接收并结束解析'};
  expectedRevision=store.put('applications',{...app,upload:pending,readback:null},{expectedRevision:app.revision}).revision;
  await locator.setInputFiles({name,mimeType:'application/pdf',buffer:fs.readFileSync(filename)},{timeout:15000});
  const verified=await locator.evaluate(el=>[...el.files].map(f=>({name:f.name,size:f.size})));
  if(verified.length!==1||verified[0].name!==name||verified[0].size!==asset.size)throw Error('无法回读附件选择结果，请在网页中手工核验');
  assertContext();if(page.url()!==uploadUrl)throw Error('上传期间网页已跳转，请手工核验结果并重新扫描');
  const currentApp=store.get('applications',app.id);
  const upload={assetId:asset.id,hash:asset.hash,name,size:asset.size,at:new Date().toISOString(),state:'selected',note:'已核验控件选择，尚未核验网站服务器接收'};
  store.put('applications',{...currentApp,upload},{expectedRevision:currentApp.revision});
  return upload;
 }
 function acknowledgeUpload(input){const app=application();if(!app.upload||app.upload.assetId!==app.assetId||app.upload.hash!==app.assetHash||!['selected','pending_verification'].includes(app.upload.state)||input.confirmed!==true)throw Error('请先核对网页的上传接收与解析状态');return store.put('applications',{...app,upload:{...app.upload,state:'user_confirmed_received',confirmedAt:new Date().toISOString(),note:'用户核验网站已接收并结束简历解析'}},{expectedRevision:app.revision});}
 async function captureReadback(){
  const app=application(),started=epoch,page=await getPage(),url=page.url(),fields=[];
  for(const frame of page.frames()){
   const entries=await frame.locator('input:not([type=password]):not([type=hidden]):not([type=file]),textarea,select').evaluateAll(elements=>elements.slice(0,300).filter(el=>el.getClientRects().length&&!(/验证码|密码|动态码|otp|one-time-code|password|token|secret|captcha|verification.?code/i.test([el.name,el.id,el.autocomplete,el.getAttribute('aria-label'),el.placeholder,...[...el.labels||[]].map(label=>label.textContent)].join(' ')))).map(el=>({label:el.labels?.[0]?.textContent?.trim().slice(0,200)||el.getAttribute('aria-label')||el.name||'',type:el.type||el.tagName.toLowerCase(),value:el.type==='checkbox'||el.type==='radio'?String(el.checked):el.value||''})).filter(item=>!(/验证码|密码|动态码|otp|password|token|secret/i.test(item.label))));
   fields.push(...entries);
  }
  const latest=application();if(epoch!==started||latest.id!==app.id||latest.revision!==app.revision||page.url()!==url)throw Error('回读期间申请或网页已变化，请重新核验');
  const readback={at:new Date().toISOString(),url:safeUrl(page.url()),fields:fields.slice(0,500),scope:'当前可见表单回读，非服务器保存或提交证明'};
  const current=store.get('applications',app.id);store.put('applications',{...current,readback},{expectedRevision:current.revision});
  return readback;
 }
 function reset(){ticket=null;epoch++;}
 return {scanUploads,upload,acknowledgeUpload,captureReadback,reset};
}
module.exports={createBrowserWorkflow,uploadFields,supportsPDF};
