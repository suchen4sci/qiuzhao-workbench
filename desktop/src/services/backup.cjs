'use strict';
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib'),{createHash,randomUUID}=require('node:crypto');
const {openStore}=require('./store.cjs'),{validateProfile,atomicWrite}=require('./profile-service.cjs');
const MAX=256*1024*1024,MAX_FILES=10000;
const digest=data=>createHash('sha256').update(data).digest('hex');
function allowed(name){return typeof name==='string'&&!name.includes('\\')&&!/[<>:"|?*\x00-\x1f]/.test(name)&&!name.split('/').some(p=>!p||p==='.'||p==='..')&&(name.startsWith('知识库/')||name==='投递记录.json'||/^\.workbench\/assets\/[a-f0-9]{64}\.(pdf|docx)$/.test(name)||/^\.workbench\/messages\/[a-f0-9]{64}\.eml$/.test(name)||/^\.workbench\/profile-history\/[a-f0-9]{64}\.(json|corrupt)$/.test(name));}
function readBounded(filename,max=MAX){const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>max)throw Error('备份文件无效、为链接或超过大小限制');return fs.readFileSync(filename);}
function disconnected(entry){return {...Object.fromEntries(['id','revision','createdAt','updatedAt','kind','provider','name','address','host','port','secure','folder','lastSuccessAt'].filter(key=>Object.hasOwn(entry,key)).map(key=>[key,entry[key]])),status:'disconnected',credentialsMissing:true};}
function createBackup(workspace,store,assets){
 function exportFile(destination){
  validateProfile(JSON.parse(readBounded(path.join(workspace,'知识库/profile.json')).toString('utf8').replace(/^\uFEFF/,'')));
  const database=store.exportData(),files=[],included=new Set();let size=Buffer.byteLength(JSON.stringify(database));
  function noLinks(relative){let current=workspace;for(const part of relative.split('/')){current=path.join(current,part);if(fs.lstatSync(current).isSymbolicLink())throw Error('备份路径包含链接，请先整理原文件');}}
  function add(relative){if(included.has(relative))return;included.add(relative);noLinks(relative);if(!allowed(relative))throw Error('文件不在备份范围');const buffer=readBounded(path.join(workspace,relative));size+=buffer.length;if(size>MAX||files.length>=MAX_FILES)throw Error('备份超过 256 MB 或文件数量限制');files.push({path:relative,sha256:digest(buffer),data:buffer.toString('base64')});}
  function walk(relative){const folder=path.join(workspace,relative);if(!fs.existsSync(folder))return;if(fs.lstatSync(folder).isSymbolicLink())throw Error('备份目录包含链接，请先整理原文件');for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const name=relative+'/'+entry.name;if(entry.isSymbolicLink())throw Error('备份目录包含链接，请先整理原文件');if(entry.isDirectory())walk(name);else if(allowed(name))add(name);}}
  walk('知识库');walk('.workbench/profile-history');
  if(fs.existsSync(path.join(workspace,'投递记录.json')))add('投递记录.json');
  for(const asset of database.collections.assets){noLinks('.workbench/assets/'+asset.hash+asset.extension);assets.file(asset.id);add('.workbench/assets/'+asset.hash+asset.extension);}
  for(const message of database.collections.messages)if(message.rawHash)add('.workbench/messages/'+message.rawHash+'.eml');
  // Connection credentials belong to the OS-protected credential store, which is intentionally outside this archive.
  database.collections.connections=database.collections.connections.map(disconnected);
  const payload=JSON.stringify({format:'qiuzhao-workbench-backup',version:1,createdAt:new Date().toISOString(),database,files});
  if(Buffer.byteLength(payload)>MAX)throw Error('编码后备份超过 256 MB，请分批归档原文件');
  const bytes=zlib.gzipSync(payload);atomicWrite(destination,bytes);
  return {filename:destination,files:files.length,bytes:bytes.length,sha256:digest(bytes)};
 }
 function inspect(filename){
  const bytes=readBounded(filename);let data;try{data=JSON.parse(zlib.gunzipSync(bytes,{maxOutputLength:MAX}).toString('utf8'));}catch{throw Error('无法读取备份或解压后超过 256 MB');}
  if(data?.format!=='qiuzhao-workbench-backup'||data.version!==1||!Array.isArray(data.files)||data.files.length>MAX_FILES)throw Error('备份格式不受支持');
  store.validateBackup(data.database);const files=new Map();
  for(const entry of data.files){
   if(!allowed(entry.path)||files.has(entry.path)||typeof entry.data!=='string'||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.data))throw Error('备份文件路径重复、越界或编码无效');
   const buffer=Buffer.from(entry.data,'base64');if(digest(buffer)!==entry.sha256)throw Error('备份内容校验失败，未恢复');files.set(entry.path,buffer);
  }
  if(!files.has('知识库/profile.json'))throw Error('备份缺少当前个人资料');
  try{validateProfile(JSON.parse(files.get('知识库/profile.json').toString('utf8').replace(/^\uFEFF/,'')));}catch{throw Error('备份中的当前资料损坏，未恢复');}
  for(const asset of data.database.collections.assets){const file=files.get('.workbench/assets/'+asset.hash+asset.extension);if(!file||digest(file)!==asset.hash||file.length!==asset.size)throw Error('备份简历原件缺失或与记录不一致');}
  for(const message of data.database.collections.messages)if(message.rawHash){const file=files.get('.workbench/messages/'+message.rawHash+'.eml');if(!file||digest(file)!==message.rawHash)throw Error('备份邮件原文缺失或校验失败');}
  return {data,files,sha256:digest(bytes)};
 }
 function preview(filename){const {data,files,sha256}=inspect(filename);return {createdAt:data.createdAt,files:files.size,assets:data.database.collections.assets.length,applications:data.database.collections.applications.length,sha256};}
 function restore(filename,parent,expectedHash){
  const {data,files,sha256}=inspect(filename);if(sha256!==expectedHash)throw Error('备份文件已变化，请重新预览');const root=path.join(fs.realpathSync(parent),'招聘工作台-恢复-'+randomUUID().slice(0,8));
  fs.mkdirSync(root,{mode:0o700});let destination;
  try{
   for(const [relative,buffer]of files){const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true,mode:0o700});fs.writeFileSync(target,buffer,{flag:'wx',mode:0o600});}
   data.database.collections.connections=data.database.collections.connections.map(disconnected);
   for(const item of data.database.collections.assets)if(item.parseStatus==='processing'){item.parseStatus='failed';item.parseError='备份时解析尚未完成，请重新解析';}
   for(const job of data.database.collections.aiJobs)if(['running','queued'].includes(job.status)){job.status='interrupted';job.error='备份恢复后需用户重新确认，不自动重试或扣费';}
   destination=openStore(root);destination.restoreData(data.database);destination.close();destination=null;
   return {workspace:root,files:files.size,mode:'new_workspace'};
  }catch(error){destination?.close();fs.rmSync(root,{recursive:true,force:true});throw error;}
 }
 return {exportFile,preview,restore};
}
module.exports={createBackup,allowed};
