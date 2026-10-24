const {normalize}=require('./rules.cjs');
function projectMatches(record,name){
 const base=s=>normalize(String(s||'').split(/[｜|]/)[0]);
 const value=base(name);if(!value)return false;
 return [record.name,...(record.aliases||[])].some(n=>base(n)===value);
}
module.exports={projectMatches};
