const fs=require('node:fs');
const {ApplicationTabRegistry}=require('./application-tab-registry.cjs');
function parseSession(raw){
 const saved=JSON.parse(raw.replace(/^\uFEFF/,''));
 if(!saved||!Array.isArray(saved.tabs)||!Number.isInteger(saved.nextId))throw Error('标签历史结构无效');
 const ids=new Set();
 for(const tab of saved.tabs){if(!/^A\d+$/.test(tab.id)||ids.has(tab.id))throw Error('标签编号无效或重复');ids.add(tab.id);}
 new ApplicationTabRegistry(saved);
 return saved;
}
function loadSession(file){
 const errors=[];
 for(const candidate of [file,file+'.bak']){
  try{return {snapshot:parseSession(fs.readFileSync(candidate,'utf8')),source:candidate,recovered:errors.length>0};}
  catch(error){if(error.code!=='ENOENT')errors.push({file:candidate,reason:error.code||error.message});}
 }
 if(errors.length)throw Error('无法恢复标签历史，原文件已保留，未创建空会话：'+errors.map(e=>e.file+' ('+e.reason+')').join('；'));
 return {snapshot:{},source:null,recovered:false};
}
module.exports={loadSession,parseSession};
