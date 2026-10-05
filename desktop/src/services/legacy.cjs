'use strict';
const fs=require('node:fs'),{createHash}=require('node:crypto');
const {safeUrl}=require('../dashboard-import.cjs');
const digest=value=>createHash('sha256').update(value).digest('hex');
function createLegacy(store,workflow){
 function read(filename){
  const stat=fs.lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>5*1024*1024)throw Error('请选择不超过 5 MB 的旧版 JSON 文件');
  const fd=fs.openSync(filename,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));let raw;try{const current=fs.fstatSync(fd);if(!current.isFile()||current.size>5*1024*1024)throw Error('文件已变化');raw=fs.readFileSync(fd);}finally{fs.closeSync(fd);}if(raw.length>5*1024*1024)throw Error('文件过大');let rows;try{rows=JSON.parse(raw.toString('utf8'));}catch{throw Error('旧版 JSON 无法读取');}
  if(!Array.isArray(rows)||rows.length>1000)throw Error('旧版文件应为最多 1000 条记录的数组');
  const ids=new Set();const entries=rows.map((r,index)=>{
   if(!r||typeof r!=='object'||Array.isArray(r)||Object.keys(r).length>100||Object.values(r).some(v=>typeof v!=='string'||v.length>100000)||Buffer.byteLength(JSON.stringify(r))>200000)throw Error(`第 ${index+1} 条不是受支持的旧版记录`);
   const company=(r['公司名称']||'').trim(),title=(r['投递岗位']||'').trim();if(!company||company.length>150||!title||title.length>200)throw Error(`第 ${index+1} 条公司或岗位缺失或过长`);
   const stable=r['记录ID']||digest(JSON.stringify(r)),id='legacy-'+digest(stable);if(ids.has(id))throw Error('旧版文件有重复记录 ID，请先核对');ids.add(id);
   const rowHash=digest(JSON.stringify(r)),old=store.get('evidence',id);let url='';try{url=safeUrl(r['投递链接']||'');}catch{}
   return{id,rowHash,original:r,company,title,url,status:r['当前状态']||'未知',state:old?(old.rowHash===rowHash?'imported':'changed'):'new'};
  });
  return{hash:digest(raw),entries};
 }
 function preview(filename){const result=read(filename);return{hash:result.hash,rows:result.entries.map(({original,...r})=>r),warning:'只迁入机会和待核对的旧记录。旧状态、时间、附件路径与笔记完整保留为证据；不推断已提交事实、面试轮次或时间，不自动创建提醒。'};}
 function migrate(filename,input){
  if(input.confirmed!==true)throw Error('请确认迁移范围');const result=read(filename);if(result.hash!==input.hash)throw Error('旧文件已变化，请重新预览');
  if(!Array.isArray(input.ids)||!input.ids.length||new Set(input.ids).size!==input.ids.length)throw Error('请选择记录');
  const entries=input.ids.map(id=>{const e=result.entries.find(r=>r.id===id);if(!e)throw Error('所选记录不在预览中');if(e.state==='changed')throw Error('已迁移记录发生变化，请手工核对，不覆盖已有内容');return e;});
  return store.transaction(()=>{
   let imported=0,skipped=0;
   for(const entry of entries){if(store.get('evidence',entry.id)){skipped++;continue;}
    const orgId=`org-legacy-${digest(entry.company).slice(0,40)}`;
    // Reuse known organizations without changing their website, type or revisions.
    const org=store.list('organizations').find(o=>o.name===entry.company)||workflow.organization({id:orgId,name:entry.company});
    const opportunityId='opp-'+entry.id;
    const opp=workflow.opportunity({id:opportunityId,organizationId:org.id,title:entry.title,url:entry.url,description:entry.original['岗位JD']||entry.original['招聘信息']||'',openStatus:'unknown',evidence:'旧版记录迁移，开放状态与申请进度待核对',evidenceSource:'legacy'});
    store.put('evidence',{id:entry.id,kind:'legacy-record',rowHash:entry.rowHash,fileHash:result.hash,original:entry.original,organizationId:org.id,opportunityId:opp.id,importedAt:new Date().toISOString()});
    store.put('notes',{id:'note-'+entry.id,opportunityId:opp.id,organizationId:org.id,title:'旧版记录 · 待核对',body:Object.entries(entry.original).map(([k,v])=>`${k}：${v}`).join('\n'),source:'legacy'});
    workflow.collect(opp.id,'saved');
    store.put('confirmations',{id:'review-'+entry.id,kind:'legacy-record',status:'pending',opportunityId:opp.id,organizationId:org.id,evidenceId:entry.id,title:`核对旧记录：${entry.company} · ${entry.title}`,legacyStatus:entry.status});imported++;
   }
   return{imported,skipped};
  });
 }
 function record(id){const item=store.get('evidence',id);if(!item||item.kind!=='legacy-record')throw Error('旧版记录不存在');return item;}
 function acknowledge(input){if(input.confirmed!==true)throw Error('请确认已核对');const c=store.get('confirmations',input.id);if(!c||c.kind!=='legacy-record')throw Error('旧记录确认项不存在');if(c.revision!==input.revision)throw Error('确认项已更新');return store.put('confirmations',{...c,status:'reviewed',reviewedAt:new Date().toISOString()},{expectedRevision:c.revision});}
 return{preview,migrate,record,acknowledge};
}
module.exports={createLegacy};
