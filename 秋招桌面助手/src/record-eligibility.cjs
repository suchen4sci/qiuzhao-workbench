function restrict(profile,sections){
 const values={...profile.values},ignored=new Set(profile.ignoredSections||[]);let changed=false;
 const award=sections.filter(s=>s.title==='获奖经历');
 if(award.length===1&&/如有以下获奖请填写/.test(award[0].text)&&/创新创业/.test(award[0].text)&&/省部级以上/.test(award[0].text)){
  values.awards=(values.awards||[]).filter(r=>/国家(?:励志)?奖学金|挑战杯|创新创业|科技进步|科学技术奖/.test(r.name));changed=true;
 }
 const campus=sections.filter(s=>s.title==='校园经历');
 if(campus.length===1&&/校学生会、研究生会主席、副主席/.test(campus[0].text)&&/不曾担任上述职务则不需要填写/.test(campus[0].text)){
  values.campus=(values.campus||[]).filter(r=>/学生会|研究生会/.test(r.name+' '+(r.position||''))&&/主席/.test(r.name+' '+(r.position||'')));if(!values.campus.length)ignored.add('campus');changed=true;
 }
 if(profile.noPublications&&sections.some(s=>s.title==='论文发表')){values.research=[];ignored.add('research');changed=true;}
 return changed?{...profile,values,autoAwardNames:values.awards?.map(a=>a.name)||[],ignoredSections:[...ignored]}:profile;
}
async function scopeRequirements(page,profile){const sections=await page.locator('[data-nav-id]').evaluateAll(es=>es.map(e=>({title:e.querySelector('[class*="blockTitle-"] [class*="text-"]')?.textContent.trim(),text:e.innerText})));return restrict(profile,sections);}
module.exports={restrict,scopeRequirements};
