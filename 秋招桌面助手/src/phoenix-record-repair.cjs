const {normalize}=require('./rules.cjs');
function scopeMatches(rule,url){const u=new URL(url);return rule.status==='user-confirmed'&&((rule.origin===u.origin&&rule.path===u.pathname)||(rule.structure==='phoenix-work-records'&&/(^|\.)zhiye\.com$/.test(u.hostname)&&u.pathname==='/form'));}
function fingerprintMatches(expected,actual){
 const canonical=obj=>Object.fromEntries(Object.entries(obj||{}).map(([k,v])=>[/^(公司名称|单位名称|实习单位)$/.test(k)?'公司名称':k,v]));
 expected=canonical(expected);actual=canonical(actual);
 const keys=Object.keys(expected);return keys.length>=3&&keys.every(k=>Object.hasOwn(actual,k)&&normalize(expected[k])===normalize(actual[k]));
}
function overwriteConfirmed(profile,url,group,key){return (profile.recordRepairs||[]).some(r=>scopeMatches(r,url)&&(r.overwrite?.[group]||[]).includes(key));}
async function repairPhoenixRecords(page,profile,cancelled=()=>false){
 const applied=[];
 for(const rule of (profile.recordRepairs||[]).filter(r=>scopeMatches(r,page.url()))){
  for(const correction of rule.remove||[]){
   if(cancelled())return applied;
   const title=correction.group==='internship'?'公司名称|实习单位|单位名称':correction.group==='projects'?'项目名称':null;
   if(!title)throw Error('不支持的已确认记录纠错栏目');
   const rows=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__title').filter({hasText:new RegExp('^('+title+')$')})});
   const found=[];
   for(let i=0;i<await rows.count();i++){
    const actual=await rows.nth(i).evaluate(r=>Object.fromEntries([...r.querySelectorAll('.form-item')].map(f=>[f.querySelector('.form-item__title')?.textContent.trim(),f.querySelector('input:not([type=file]),textarea')?.value]).filter(([k,v])=>k&&v!==undefined)));
    if(fingerprintMatches(correction.fingerprint,actual))found.push(i);
   }
   if(!found.length)continue;
   if(found.length!==1)throw Error('已确认错误记录出现多条相同副本，须核对，未删除');
   const before=await rows.count(),container=rows.nth(found[0]).locator('xpath=../..');
   if(await container.locator('.ux-standard-form').count()!==1)throw Error('错误记录删除容器不唯一');
   const del=container.getByText('删除',{exact:true}).filter({visible:true});
   if(!await del.count()&&correction.reuseAs==='internship'&&before===1&&(profile.values.internship||[]).length===1){
    const record=profile.values.internship[0];
    for(const [label,key] of [['公司名称|实习单位|单位名称','company'],['职位名称','position'],['工作职责','description']]){
     const input=rows.nth(found[0]).locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:new RegExp('^('+label+')$')})}).locator('input,textarea');
     if(await input.count()!==1||!record[key])throw Error('错误工作记录复用字段无法核验');
     await input.fill(record[key]);await input.press('Tab');
     if(await input.inputValue()!==record[key])throw Error('错误工作记录复用回读失败');
    }
    applied.push({group:correction.group,reason:correction.reason});continue;
   }
   if(await del.count()!==1)throw Error('错误记录删除入口不唯一');
   await del.click();
   const popup=page.locator('.phoenix-popconfirm').filter({hasText:'是否要删除该组信息？'}).filter({visible:true});
   await popup.waitFor({state:'visible',timeout:1000}).catch(()=>{});
   const yes=await popup.count()===1?popup.getByText('是',{exact:true}):page.getByText('是',{exact:true}).filter({visible:true});
   await yes.waitFor({state:'visible',timeout:3000});
   if(await yes.count()!==1)throw Error('错误记录删除确认不唯一');
   await yes.click();
   await page.waitForFunction(({title,count})=>[...document.querySelectorAll('.ux-standard-form')].filter(r=>[...r.querySelectorAll('.form-item__title')].some(e=>new RegExp('^('+title+')$').test(e.textContent.trim()))).length===count,{title,count:before-1},{timeout:3000});
   applied.push({group:correction.group,reason:correction.reason});
  }
 }
 return applied;
}
module.exports={scopeMatches,fingerprintMatches,overwriteConfirmed,repairPhoenixRecords};
