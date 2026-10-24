const{normalize}=require('./rules.cjs');
const exact=s=>new RegExp('^'+String(s).replace(/[.*+?^$(){ }|[\]\\]/g,'\\$&')+'$');
const err=(code,message)=>Object.assign(new Error(message||code),{code});
function dateText(s){const m=String(s||'').match(/(\d{4})[年\/-](\d{1,2})(?:[月\/-](\d{1,2}))?/);return m?m[1]+'-'+m[2].padStart(2,'0')+(m[3]?'-'+m[3].padStart(2,'0'):''):String(s||'').trim();}
async function fillDefinitionSelect(locator,value,spec={}){
 const opts=await locator.locator(':scope > ul > li').evaluateAll(es=>es.map(e=>({label:e.textContent.trim(),value:e.dataset.code||e.textContent.trim(),disabled:e.classList.contains('disabled')})));
 let chosen=opts.filter(o=>o.value===String(value)).length===1?opts.find(o=>o.value===String(value)):require('./engine.cjs').selectOption(opts,String(value),spec);
 if(!chosen&&spec.salaryRange&&/^\d+$/.test(String(value))){const wanted=Number(value);const found=opts.filter(o=>{const m=o.label.match(/(\d+)(?:[-~—](\d+))?/);if(!m)return false;const low=/以下/.test(o.label)?0:Number(m[1]),high=m[2]?Number(m[2]):/以上/.test(o.label)?Infinity:Number(m[1]);return wanted>=low&&wanted<=high;});if(found.length===1)chosen=found[0];}
 if(!chosen)throw err('OPTION');
 await locator.locator(':scope > span').evaluate(e=>e.scrollIntoView({block:'center'}));await locator.locator(':scope > span').click({timeout:1500});
 const candidates=locator.locator(':scope > ul > li').filter({hasText:exact(chosen.label)});if(await candidates.count()!==1)throw err('AMBIGUOUS');await candidates.click({timeout:1500});
 const actual=(await locator.locator(':scope > span').textContent()).trim();if(actual!==chosen.label)throw err('VERIFY');return actual;
}
async function fillDefinitionDate(locator,value){
 if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))throw err('DATE_PRECISION');
 const [year,month,day]=value.split('-').map(Number);await locator.locator(':scope > span').click({timeout:1500});const yp=locator.locator('.slideConYear:visible');await yp.waitFor({state:'visible',timeout:1200});
 for(let i=0;i<20;i++){const years=(await yp.locator('li').allTextContents()).map(Number);if(years.includes(year))break;await yp.locator(year<Math.min(...years)?'.lf':'.rg').click({timeout:1500});}
 const targetYear=yp.locator('li').filter({hasText:exact(year)});if(await targetYear.count()!==1)throw err('OPTION');await targetYear.click({timeout:1500});
 const mp=locator.locator('.slideConMon:visible');await mp.locator('li').filter({hasText:exact(month)}).click({timeout:1500});
 const dp=locator.locator('.slideConDay:visible');if(await dp.count()){if(!day)throw err('DATE_PRECISION');await dp.locator('li').filter({hasText:exact(day)}).click({timeout:1500});}
 const actual=dateText(await locator.locator(':scope > span').textContent());if(actual!==value&&actual!==value.slice(0,7))throw err('VERIFY');return actual;
}
async function fillDefinitionRegion(locator,value,path){
 let parts=(Array.isArray(path)?path:[]).filter(Boolean);if(parts.length===2&&/^(北京市|上海市|天津市|重庆市)$/.test(parts[0]))parts=[parts[0],parts[0],parts[1]];
 if(!parts.length)throw err('REGION_PRECISION','地区选择需要已确认的省、市、区县路径');
 const panel=locator.locator('..').locator('.citySlide');await locator.click({timeout:1500});await panel.waitFor({state:'visible',timeout:1200});
 for(const part of parts){let opts=panel.locator('a[data-code]:visible');let names=await opts.allTextContents();let indexes=names.map((n,i)=>({n:n.trim(),i})).filter(x=>x.n===part);if(!indexes.length)indexes=names.map((n,i)=>({n:n.trim(),i})).filter(x=>normalize(x.n.replace(/市$/,''))===normalize(part.replace(/市$/,'')));if(indexes.length!==1)throw err(indexes.length?'AMBIGUOUS':'OPTION');await opts.nth(indexes[0].i).click({timeout:1500});}
 await panel.locator('a.save').click({timeout:1500});if(await panel.isVisible()){const reason=(await panel.locator('.choosefail').textContent()).trim();throw err('REGION_PRECISION',reason||'地区信息精度不足，未猜选区县');}
 const actual=await locator.inputValue();const want=parts.map(p=>p.replace(/市$/,'')).join('');if(normalize(actual.replace(/市/g,''))!==normalize(want))throw err('VERIFY');return actual;
}
module.exports={fillDefinitionSelect,fillDefinitionDate,fillDefinitionRegion,dateText};
