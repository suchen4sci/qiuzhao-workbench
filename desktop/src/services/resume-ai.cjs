'use strict';
const {randomUUID}=require('node:crypto');
const {groups}=require('../rules.cjs');
const {modelJSON}=require('./ai-client.cjs');
function validateChanges(result,asset,profile){
 if(!Array.isArray(result?.changes)||result.changes.length>1000)throw Error('模型未返回有效资料草稿');
 const seen=new Set();
 return result.changes.map((change,index)=>{
  if(!change||!Object.hasOwn(groups,change.group)||!Object.hasOwn(groups[change.group].fields,change.key)||!Number.isInteger(change.index)||change.index<0||change.index>200||typeof change.value!=='string'||change.value.length>50000||typeof change.quote!=='string'||!change.quote.trim())throw Error('资料草稿包含无效字段，未采用');
  const page=asset.pages.find(p=>p.page===change.page);
  if(!page||!page.text.includes(change.quote)||!change.value.trim()||!change.quote.replace(/\s+/g,'').includes(change.value.replace(/\s+/g,'')))throw Error('资料草稿缺少可核验的原文依据，未采用');
  const identity=`${change.group}:${change.index}:${change.key}`;
  if(seen.has(identity))throw Error('资料草稿包含重复字段');seen.add(identity);
  const before=String(profile.values[change.group]?.[change.index]?.[change.key]??'');
  return {id:`change-${index}`,group:change.group,index:change.index,key:change.key,value:change.value,before,quote:change.quote,page:change.page,sourceLabel:page.sourceLabel||`第 ${page.page} 页`,manual:!!groups[change.group].fields[change.key].manual,label:`${groups[change.group].label} / ${groups[change.group].fields[change.key].label}`,state:before===change.value?'duplicate':before?'conflict':'new'};
 }).sort((a,b)=>a.group.localeCompare(b.group)||a.index-b.index);
}
function createResumeAI(store,facts,assets,settings,{invoke=modelJSON}={}){
 const controllers=new Map();
 async function run(input){
  if(input.confirmed!==true)throw Error('请先确认发送范围与供应商调用费用');
  if(!['structure','ocr'].includes(input.kind))throw Error('未知简历处理任务');
  const asset=store.get('assets',input.assetId);if(!asset)throw Error('文件不存在');
  assets.file(asset.id);
  const config=settings.read();if(!config.enabled)throw Error('请先配置模型服务');
  const captured=facts.read();
  const requestId=input.requestId||randomUUID();
  if(!/^[a-f0-9-]{36}$/.test(requestId))throw Error('任务标识无效');
  const previous=store.get('aiJobs',requestId);
  if(previous){if(previous.assetId!==asset.id||previous.kind!==`resume-${input.kind}`)throw Error('任务标识已用于不同请求');return previous;}
  let job=store.put('aiJobs',{id:requestId,kind:`resume-${input.kind}`,assetId:asset.id,status:'running',billing:'byok',scope:input.kind==='ocr'?'pdf-page-images':'resume-text-and-confirmed-profile'});
  const abort=new AbortController();controllers.set(job.id,abort);
  try{
   let output;
   if(input.kind==='ocr'){
    const pages=await assets.images(asset.id);
    output=await invoke(config,{instruction:'逐页转录图像可见文字，不猜测模糊内容、不补全日期。返回 {"pages":[{"page":1,"text":"原文"}]}，页号须与输入一致。',input:{pages:pages.map(p=>p.page)},images:pages,signal:abort.signal});
    if(!Array.isArray(output.pages)||output.pages.length!==pages.length||new Set(output.pages.map(p=>p.page)).size!==pages.length||output.pages.some(p=>!pages.some(x=>x.page===p.page)||typeof p.text!=='string'))throw Error('OCR 结果页码不完整或重复');
    if(abort.signal.aborted)throw Error('任务已取消');
    assets.recordOCR(asset.id,output.pages);output={pages:output.pages.length};
   }else{
    if(!asset.text?.trim())throw Error('请先提取可读正文或执行 OCR');
    if(asset.text.length>80000)throw Error('简历正文过长，请拆分后整理');
    const catalog=Object.fromEntries(Object.entries(groups).map(([group,spec])=>[group,Object.fromEntries(Object.entries(spec.fields).map(([key,f])=>[key,f.label]))]));
    const result=await invoke(config,{instruction:'从简历原文整理个人资料草稿。仅提取有证据的事实，不补造日期、学历、经历或证书。保留原文详细描述，不摘要。索引复用 confirmed 中同一经历；新增经历按分组数组长度连续追加。不要删除未提及的已有信息。只返回 {"changes":[{"group":"basic","index":0,"key":"name","value":"值","page":1,"quote":"输入对应页完整原文子串"}]}。每个字段须有原文来源编号和直接引文，value必须是quote中的原文片段，不自行改写日期或简称；DOCX来源编号是段落而非真实页码。索引从0开始。',input:{catalog,confirmed:captured.profile.values,pages:asset.pages},signal:abort.signal});
    output={changes:validateChanges(result,asset,captured.profile),profileHash:captured.hash};
   }
   if(abort.signal.aborted)throw Error('任务已取消');
   job=store.get('aiJobs',job.id);
   return store.put('aiJobs',{...job,status:'ready',output},{expectedRevision:job.revision});
  }catch(error){job=store.get('aiJobs',job.id);store.put('aiJobs',{...job,status:abort.signal.aborted?'cancelled':'failed',error:abort.signal.aborted?'任务已取消':error.message},{expectedRevision:job.revision});throw error;}
  finally{controllers.delete(job.id);}
 }
 function adopt(input){
  const job=store.get('aiJobs',input.jobId);
  if(!job||job.kind!=='resume-structure'||job.status!=='ready')throw Error('资料草稿不存在或不可采用');
  if(!Array.isArray(input.ids)||!input.ids.length||new Set(input.ids).size!==input.ids.length)throw Error('请选择要采用的字段');
  const changes=input.ids.map(id=>{const change=job.output.changes.find(c=>c.id===id);if(!change)throw Error('未知草稿字段');return change;});
  // New records can be selectively adopted without inventing empty intervening records.
  const current=facts.read();if(current.hash!==job.output.profileHash)throw Error('个人资料已变化，请重新整理草稿');
  const indexMap=new Map(),next=Object.fromEntries(Object.entries(current.profile.values).map(([g,records])=>[g,records.length]));
  const selected=changes.map(c=>{
   const oldLength=current.profile.values[c.group]?.length||0;
   if(c.index<oldLength)return c;
   const identity=`${c.group}:${c.index}`;
   if(!indexMap.has(identity)){indexMap.set(identity,next[c.group]??oldLength);next[c.group]=(next[c.group]??oldLength)+1;}
   return {...c,index:indexMap.get(identity),before:''};
  });
  const saved=facts.merge(selected,job.output.profileHash);
  store.put('aiJobs',{...job,status:'adopted',adoptedIds:input.ids},{expectedRevision:job.revision});
  return saved;
 }
 function cancel(id){const controller=controllers.get(id);if(controller){controller.abort();return true;}return false;}
 // Interrupted tasks are not silently retried against the provider on startup.
 for(const job of store.list('aiJobs').filter(j=>j.kind?.startsWith('resume-')&&j.status==='running'))store.put('aiJobs',{...job,status:'interrupted',error:'应用中断；原件已保留，外部供应商可能已计费'},{expectedRevision:job.revision});
 function close(){for(const controller of controllers.values())controller.abort();}
 return {run,adopt,cancel,close};
}
module.exports={createResumeAI,validateChanges};
