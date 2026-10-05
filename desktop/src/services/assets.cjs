'use strict';
const fs=require('node:fs'),path=require('node:path');
const {createHash,randomUUID}=require('node:crypto');
const {Worker}=require('node:worker_threads');
const {text}=require('./workflow.cjs');
const {atomicWrite}=require('./profile-service.cjs');
const MAX_FILE=30*1024*1024;
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
function runDocumentWorker(filename,extension,mode='text'){
 return new Promise((resolve,reject)=>{
  const worker=new Worker(path.join(__dirname,'document-worker.cjs'),{workerData:{filename,extension,mode},resourceLimits:{maxOldGenerationSizeMb:192}});
  let settled=false;
  const timer=setTimeout(()=>finish(Error('解析超时，原件已保留，可重试或手工填写')),45000);
  function finish(error,result){if(settled)return;settled=true;clearTimeout(timer);worker.terminate();error?reject(error):resolve(result);}
  worker.on('message',message=>message.error?finish(Error(message.error)):finish(null,message));
  worker.on('error',()=>finish(Error('解析进程失败，原件已保留')));
  worker.on('exit',code=>{if(!settled)finish(Error(`解析未完成（${code}），原件已保留`));});
 });
}
function createAssets(store){
 const directory=path.join(store.directory,'assets');fs.mkdirSync(directory,{recursive:true,mode:0o700});
 function get(id){const item=store.get('assets',id);if(!item)throw Error('文件不存在');return item;}
 function file(id){const asset=get(id);if(!/^[a-f0-9]{64}$/.test(asset.hash)||!['.pdf','.docx'].includes(asset.extension))throw Error('文件记录无效');const filename=path.join(directory,asset.hash+asset.extension);const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE||digest(fs.readFileSync(filename))!==asset.hash)throw Error('文件已变化或损坏，请重新导入原件');return filename;}
 async function parse(id){
  let current=get(id);const filename=file(id);
  current=store.put('assets',{...current,parseStatus:'processing',parseError:''},{expectedRevision:current.revision});
  try{
   const extracted=await runDocumentWorker(filename,current.extension);
   current=get(id);
   return store.put('assets',{...current,parseStatus:extracted.text.trim()?(current.extension==='.pdf'&&extracted.pages.some(p=>!p.text.trim())?'partial':'ready'):current.extension==='.pdf'?'needs_ocr':'empty',text:extracted.text,pages:extracted.pages,parseError:'',warnings:extracted.warnings},{expectedRevision:current.revision});
  }catch(error){current=get(id);return store.put('assets',{...current,parseStatus:'failed',parseError:error.message},{expectedRevision:current.revision});}
 }
 async function importFile(source){
  const stat=fs.lstatSync(source);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>MAX_FILE||!stat.size)throw Error('请选择不超过 30 MB 的 PDF 或 DOCX 文件');
  const extension=path.extname(source).toLowerCase();if(!['.pdf','.docx'].includes(extension))throw Error('仅支持 PDF 和 DOCX');
  const buffer=fs.readFileSync(source);
  if(extension==='.pdf'&&!buffer.subarray(0,1024).includes(Buffer.from('%PDF-')))throw Error('文件不是有效的 PDF');
  if(extension==='.docx'&&buffer.subarray(0,2).toString()!=='PK')throw Error('文件不是有效的 DOCX');
  const hash=digest(buffer),id=`asset-${hash}`,old=store.get('assets',id);
  if(old){
   try{file(old.id);}catch{
    const target=path.join(directory,hash+extension);
    if(fs.existsSync(target)||(()=>{try{return fs.lstatSync(target).isSymbolicLink();}catch{return false;}})())fs.renameSync(target,target+`.damaged-${randomUUID()}`);
    atomicWrite(target,buffer);
    return {...await parse(old.id),duplicate:true,repaired:true};
   }
   return {...old,duplicate:true};
  }
  const filename=path.join(directory,hash+extension);
  try{fs.writeFileSync(filename,buffer,{flag:'wx',mode:0o600});}catch(error){if(error.code!=='EEXIST')throw error;if(digest(fs.readFileSync(filename))!==hash)throw Error('已存原件校验失败');}
  store.put('assets',{id,hash,extension,name:path.basename(source),size:buffer.length,language:'',purpose:'简历',archived:false,default:false,parseStatus:'pending',text:'',pages:[]});
  return parse(id);
 }
 function update(input){
  const asset=get(input.id);if(asset.revision!==input.revision)throw Error('文件标签已更新，请刷新');
  if(input.default && (asset.extension!=='.pdf'||!['ready','partial','needs_ocr'].includes(asset.parseStatus)))throw Error('默认网申简历须为可读取的 PDF');
  if(input.default)file(asset.id);
  return store.transaction(()=>{
   if(input.default)for(const other of store.list('assets').filter(a=>a.default&&a.id!==asset.id))store.put('assets',{...other,default:false},{expectedRevision:other.revision});
   return store.put('assets',{...asset,name:text(input.name??asset.name,200,true),language:text(input.language??asset.language,30),purpose:text(input.purpose??asset.purpose,100),archived:input.archived??asset.archived,default:input.archived?false:(input.default??asset.default)},{expectedRevision:asset.revision});
  });
 }
 async function images(id){const asset=get(id);if(asset.extension!=='.pdf')throw Error('OCR 只用于 PDF');return (await runDocumentWorker(file(id),asset.extension,'images')).pages;}
 function recordOCR(id,pages){
  const asset=get(id);
  if(!Array.isArray(pages)||pages.length>80||pages.some(p=>!Number.isInteger(p.page)||typeof p.text!=='string'))throw Error('OCR 结果无效');
  const extracted=pages.map(p=>p.text).join('\n');if(extracted.length>1_000_000)throw Error('OCR 内容过大');
  return store.put('assets',{...asset,text:extracted,pages,parseStatus:extracted.trim()?'ready':'empty',parseMethod:'vision',parseError:''},{expectedRevision:asset.revision});
 }
 return {importFile,parse,update,file,images,recordOCR};
}
module.exports={createAssets,runDocumentWorker,MAX_FILE};
