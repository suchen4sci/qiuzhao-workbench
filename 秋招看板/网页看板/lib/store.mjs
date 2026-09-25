import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const dashboardDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const workbookPath=path.join(process.env.QIUZHAO_WORKSPACE||path.resolve(dashboardDir,'../../.local-workspace'),'投递记录.json');
export const headers=['公司类型','公司名称','投递岗位','当前状态','地区','官方节点时间','准备DDL','下一步行动','投递链接','内推链接','内推码','简历附件','招聘信息','进度查询入口','状态核验日期','备注','更新时间','记录ID','面试方式','会议平台','会议链接','准备要求','邮件依据','岗位JD','公司背调','业务技术方向','面试亮点','可提问题','背调来源','准备日期','投递日期'];
let queue=Promise.resolve();
const fail=(code,message)=>{const e=new Error(message);e.code=code;throw e};
const version=r=>crypto.createHash('sha256').update(JSON.stringify(r)).digest('hex');
const visible=r=>({...r,__version:version(r)});
async function read(){try{return JSON.parse(await fs.readFile(workbookPath,'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
async function write(rows){await fs.mkdir(path.dirname(workbookPath),{recursive:true});const temp=workbookPath+'.tmp';await fs.writeFile(temp,JSON.stringify(rows,null,2));await fs.rename(temp,workbookPath);}
function transaction(fn){const next=queue.then(fn);queue=next.catch(()=>{});return next;}
function clean(input){return Object.fromEntries(headers.filter(k=>Object.hasOwn(input,k)).map(k=>[k,String(input[k]??'').trim()]));}
export async function listJobs(){await queue;return (await read()).map(visible);}
export function addJob(input){return transaction(async()=>{const r=clean(input);if(!r['公司名称']||!r['投递岗位'])fail('INVALID','公司和岗位不能为空');const rows=await read();if(rows.some(x=>x['公司名称']===r['公司名称']&&x['投递岗位']===r['投递岗位']))fail('DUPLICATE','公司与岗位已经存在');r['记录ID']=crypto.randomUUID();r['当前状态']||='待投递';r['更新时间']=new Date().toISOString();rows.push(r);await write(rows);return visible(r);});}
export function updateJob(id,input,expectedVersion){return transaction(async()=>{const rows=await read(),i=rows.findIndex(r=>r['记录ID']===id);if(i<0)fail('NOT_FOUND','记录不存在');if(expectedVersion&&expectedVersion!==version(rows[i]))fail('CONFLICT','记录已更新，请刷新后重试');const patch=clean(input);delete patch['记录ID'];rows[i]={...rows[i],...patch,'更新时间':new Date().toISOString()};await write(rows);return visible(rows[i]);});}
