(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OpportunityBrowser=api;})(typeof window==='object'?window:globalThis,()=>{
 'use strict';
 const dimensions=['route','direction','city','nature'];
 const normalize=v=>String(v??'').normalize('NFKC').trim().toLowerCase();
 const values=(o,key)=>Array.isArray(o[key])?o[key]:[];
 function browse(opportunities,{tier='all',filters={}}={}){
  const seen=new Set();const list=opportunities.filter(o=>{if(seen.has(o.id))return false;seen.add(o.id);if(tier==='excluded'?o.match?.included!==false:tier==='all'?o.match?.included===false:o.match?.tier!==tier)return false;return dimensions.every(key=>!filters[key]?.length||filters[key].some(v=>values(o,key).some(x=>normalize(x)===normalize(v))))&&(!filters.plan?.length||filters.plan.some(id=>o.match?.matchedPlans?.some(p=>p.id===id)));});
  const rank={recommended:0,explore:1,verify:2,excluded:3};list.sort((a,b)=>(rank[a.match?.tier]??2)-(rank[b.match?.tier]??2)||(a.deadline||'9999').localeCompare(b.deadline||'9999')||a.id.localeCompare(b.id));
  const byOrg=new Map();for(const o of list){if(!byOrg.has(o.organizationId))byOrg.set(o.organizationId,{organizationId:o.organizationId,opportunities:[]});byOrg.get(o.organizationId).opportunities.push(o);}
  const facets=Object.fromEntries(dimensions.map(key=>[key,[...new Set(opportunities.flatMap(o=>values(o,key)))].sort((a,b)=>a.localeCompare(b))]));
  return{list,groups:[...byOrg.values()],organizationCount:byOrg.size,opportunityCount:list.length,facets};
 }
 return{browse};
});
