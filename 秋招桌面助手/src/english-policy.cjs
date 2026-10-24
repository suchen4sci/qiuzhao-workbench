function acceptsScore(control,score){
 if(!control)return true;
 if(/整数/.test((control.placeholder||'')+(control.validationMessage||''))&&!Number.isInteger(Number(score)))return false;
 if(control.pattern){try{if(!new RegExp('^(?:'+control.pattern+')$').test(score))return false;}catch{}}
 if(control.type==='number'){
  const step=control.step||'1';if(step!=='any'){const n=Number(step),base=Number(control.min||0);if(n>0&&Math.abs((Number(score)-base)/n-Math.round((Number(score)-base)/n))>1e-8)return false;}
 }
 return true;
}
function chooseEnglishPair(level,score,policy){
 const options=(level?.options||[]).filter(o=>!o.disabled),preferred=policy.preferred,fallback=policy.fallback;
 const ieltsOptions=options.filter(o=>/雅思|ielts/i.test(o.label));
 const bands=ieltsOptions.filter(o=>/\d/.test(o.label));
 const compatible=bands.filter(o=>{const s=o.label,n=Number(preferred.score),range=s.match(/(\d+(?:\.\d+)?)\s*[-～~至]\s*(\d+(?:\.\d+)?)/),bound=s.match(/(\d+(?:\.\d+)?)\s*分?\s*(以上|以下)/);return range?n>=Number(range[1])&&n<=Number(range[2]):bound?bound[2]==='以上'?n>Number(bound[1]):n<Number(bound[1]):false;});
 const ielts=bands.length?compatible.length===1?compatible[0]:null:ieltsOptions[0];
 const mustFallback=(options.length>0&&!ielts)||!acceptsScore(score,preferred.score);
 const selected=mustFallback?fallback:preferred;
 const option=mustFallback?options.find(o=>/^(大学英语)?[六6]级(?:[（(]CET.?6[)）])?$/i.test(o.label)):ielts;
 return {level:option?.label||selected.level,score:selected.score,fallback:mustFallback};
}
function bestProficiencyOption(options){
 const levels=['精通','专家','非常熟练','熟练','优秀','良好','掌握','一般','了解'];
 for(const label of levels){const found=(options||[]).filter(o=>!o.disabled&&o.label.trim()===label);if(found.length===1)return label==='一般'?{reason:'网站最高可选等级为一般，与本人要求冲突，未选择'}:{value:label};}
 return null;
}
module.exports={chooseEnglishPair,acceptsScore,bestProficiencyOption};
