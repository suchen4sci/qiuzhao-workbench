(function(root,factory){const value=factory();if(typeof module==='object'&&module.exports)module.exports=value;else root.companyGroups=value;})(globalThis,()=>{
 const normalize=value=>String(value||'').trim().replace(/\s+/g,' ');
 function tenant(raw){try{const u=new URL(raw),host=u.hostname.toLowerCase();let m;if(/(^|\.)mokahr\.com$/.test(host)){m=u.pathname.match(/\/(?:campus-recruitment|social-recruitment)\/([^/]+)\/(\d+)/);return m?'moka:'+m[1]+':'+m[2]:null;}if(/(^|\.)hotjob\.cn$/.test(host)){m=u.pathname.match(/\/(SU[a-z0-9]+)(?:\/|$)/i)||u.pathname.match(/\/wt\/([^/]+)\//);return m?'dayee:'+m[1].toLowerCase():null;}if(/\.zhiye\.com$/.test(host))return 'beisen:'+host;return null;}catch{return null;}}
 function openedMetadata(tabs,parentId,url,explicit={}){
  const parent=tabs.find(t=>t.id===parentId);if(!parent||explicit.company)return {...explicit};
  const a=tenant(parent.url),b=tenant(url);if(a&&b&&a!==b)return {...explicit};
  return {...explicit,parentId:parent.id,companyId:parent.companyId||parent.id,company:parent.company||'',role:explicit.role||parent.role||'',companySource:'opener'};
 }
 function legacyKey(raw){const key=tenant(raw);if(key)return key;try{const u=new URL(raw);if(/(^|\.)(iguopin\.com|mokahr\.com|hotjob\.cn|zhiye\.com|51job\.com|zhaopin\.com)$/.test(u.hostname)||/\/(auth|login|signin)(?:\/|$)/i.test(u.pathname))return null;return u.origin;}catch{return null;}}
 function migrate(tabs){
  const known=tabs.filter(t=>normalize(t.company));const byName=new Map();for(const t of known){if(!t.companyId)t.companyId=byName.get(normalize(t.company))||t.id;if(!byName.has(normalize(t.company)))byName.set(normalize(t.company),t.companyId);}
  for(const t of tabs){if(t.companyId&&(t.companyId!==t.id||normalize(t.company)))continue;const parent=tabs.find(p=>p.id===t.parentId);if(parent){Object.assign(t,openedMetadata(tabs,parent.id,t.url));continue;}const key=legacyKey(t.url);const matches=key?known.filter(p=>legacyKey(p.url)===key):[];const names=new Set(matches.map(p=>normalize(p.company)));if(names.size===1){const p=matches[0];t.company=p.company;t.companyId=p.companyId;t.parentId=p.id;t.companySource='same-tenant';}else t.companyId=t.id;}
  return tabs;
 }
 function groups(tabs){const open=tabs.filter(t=>t.status!=='已关闭'),map=new Map();for(const t of open){const id=t.companyId||t.id;let g=map.get(id);if(!g){g={id,company:t.company||t.title||'招聘网站',tabs:[]};map.set(id,g);}if(t.id===id&&t.company)g.company=t.company;g.tabs.push(t);}return [...map.values()];}
 function preferred(group,activeId){return group.tabs.find(t=>t.id===activeId)||[...group.tabs].reverse().find(t=>/resume|apply|form|简历/.test(t.url+' '+t.title)&&!/(?:\/auth|\/login)/.test(t.url))||group.tabs.find(t=>t.id===group.id)||group.tabs[0];}
 async function closeCompany(api,id){
  const state=await api({action:'list'}),group=groups(state.tabs).find(g=>g.id===id);
  if(!group)return [];
  const ids=group.tabs.map(t=>t.id);
  // Keep a neutral page when closing the last company, as the host requires a tab.
  if(state.tabs.filter(t=>t.status!=='已关闭').length===ids.length)
   await api({action:'open',url:'http://127.0.0.1:33210',title:'秋招看板',company:'秋招看板'});
  for(const tabId of ids)await api({action:'close',id:tabId});
  return ids;
 }
 return {tenant,openedMetadata,migrate,groups,preferred,closeCompany};
});
