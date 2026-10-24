// Private, page-scoped exclusions never remove records from the global profile.
function scopedProfile(profile, url) {
  let target;try{target=new URL(url);}catch{return profile;}
  const ignored=new Set();
  const additions=[];
  const exclusions=[];
  for(const rule of profile.workflow?.section_policies||[]){
    if(rule.status!=='user-confirmed'||rule.origin!==target.origin||!rule.path||rule.path!==target.pathname+target.hash)continue;
    if(Object.entries(rule.query||{}).some(([key,value])=>target.searchParams.get(key)!==value))continue;
    for(const group of rule.skip_groups||[])if(Object.hasOwn(profile.values||{},group))ignored.add(group);
    for(const addition of rule.additional_records||[])if(Object.hasOwn(profile.values||{},addition.group)&&addition.record)additions.push(addition);
    for(const exclusion of rule.exclude_records||[])if(exclusion.group&&exclusion.identity&&Object.keys(exclusion.identity).length)exclusions.push(exclusion);
  }
  if(!ignored.size&&!additions.length&&!exclusions.length)return profile;
  const values={...profile.values};for(const group of ignored)values[group]=[];
  for(const {group,record,prepend} of additions){
    if(ignored.has(group))continue;
    const key=group==='internship'?'company':'name';
    if(!record[key])continue;
    if(!(values[group]||[]).some(r=>r[key]===record[key]))values[group]=prepend?[{...record},...(values[group]||[])]:[...(values[group]||[]),{...record}];
  }
  // Apply exclusions after additions so a newer exclusion wins over old sales rules.
  for(const {group,identity} of exclusions)if(Array.isArray(values[group]))values[group]=values[group].filter(record=>!Object.entries(identity).every(([key,value])=>record[key]===value));
  return {...profile,values,ignoredSections:[...ignored]};
}
module.exports={scopedProfile};
