'use strict';
const {meetingUrl}=require('./event-context.cjs');
const {summary}=require('../ui/interview-preparation.js');
const clean=value=>String(value??'').replace(/\r/g,'');
function createInterviewMaterials(store,{profileHash=()=>undefined}={}){
 function sourceUrl(input){const b=store.get('briefings',input.briefingId);if(!b||b.status!=='ready')throw Error('简报不存在');const source=b.sources?.find(s=>s.id===input.sourceId);if(!source)throw Error('来源不存在');return meetingUrl(source.url);}
 function exportMarkdown(eventId){const e=store.get('events',eventId);if(!e||e.type!=='interview')throw Error('面试不存在');const state=Object.fromEntries(['briefings','aiJobs','opportunities','applications','plans'].map(c=>[c,store.list(c)]));try{state.profileHash=profileHash();}catch{state.profileUnavailable=true;}const info=summary(e,state),b=info.briefing,org=store.get('organizations',e.organizationId),notes=store.list('notes').filter(n=>n.eventId===eventId);
 const sections=[`# ${clean(org?.name||'单位待核实')} · ${clean(e.title)}`,`面试时间：${clean(e.startsAt||'待定')}\n\n关联岗位：${clean(info.opportunity?.title||'未关联')}\n\n材料状态：${info.label}`];
 if(info.opportunity)sections.push('## 岗位记录\n\n'+clean(info.opportunity.description||'岗位说明未填写'));
 if(b){sections.push(`生成于：${clean(b.createdAt)}\n\n以下为当时生成的材料；推断与建议仍须自行核对。`);
 if(b.facts?.length)sections.push('## 公司与产品：有来源事实\n\n'+b.facts.map(f=>`[${clean(f.sourceId)}] ${clean(f.quote)}`).join('\n\n'));else sections.push('## 已保存简报\n\n'+clean(b.body));
 if(b.hypotheses?.length)sections.push('## 岗位理解与待核实推断\n\n'+b.hypotheses.map(x=>'- '+clean(x)).join('\n'));
 if(b.personalEvidence?.length)sections.push('## 个人经历依据\n\n'+b.personalEvidence.map(p=>`${clean(p.group)} / 第 ${p.index+1} 条 / ${clean(p.field)}：${clean(p.quote)}\n\n待核实关联：${clean(p.relevance)}`).join('\n\n'));
 if(b.questions?.length)sections.push('## 体验任务与交流问题\n\n'+b.questions.map(x=>'- '+clean(x)).join('\n'));
 sections.push('## 来源与读取时间\n\n'+(b.sources||[]).map(s=>`[${clean(s.id)}] ${clean(s.url)}\n\n读取于：${clean(s.capturedAt||'未记录')}`).join('\n\n'));
 }else sections.push('## 简报\n\n尚无已生成简报。');
 sections.push('## 我的笔记与复盘\n\n'+(notes.map(n=>`### ${clean(n.title||'笔记')}\n\n${clean(n.body)}\n\n记录于：${clean(n.createdAt)}`).join('\n\n')||'尚无笔记。'));
 return {filename:'面试准备与笔记.md',content:sections.join('\n\n')+'\n',eventRevision:e.revision,briefingId:b?.id||''};
 }
 return {sourceUrl,exportMarkdown};
}
module.exports={createInterviewMaterials};
