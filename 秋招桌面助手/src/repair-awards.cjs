const {fillPhoenix}=require('./phoenix.cjs');
async function repairAwards(page,profile,cancelled=()=>false){
  const policy=profile.awardCorrections;
  if(!policy||new URL(page.url()).origin!==policy.origin)return;
  const title=page.locator('.form-item__title').filter({hasText:/^获奖项$/});
  const forms=page.locator('.ux-standard-form').filter({has:title});
  for(let i=0;i<await forms.count();i++){
    if(cancelled())return;
    const form=forms.nth(i);
    const before=await form.evaluate(e=>Object.fromEntries([...e.querySelectorAll('.form-item')].map(f=>[f.querySelector('.form-item__title')?.textContent,f.querySelector('input,textarea')?.value||''])));
    const rule=policy.rules.find(r=>Object.entries(r.before).every(([k,v])=>before[k]===v));
    if(!rule)continue;
    const record=profile.values.awards.find(a=>a.name===rule.target);if(!record)continue;
    const names=await forms.locator('input').evaluateAll(es=>es.map(e=>e.value));
    if(names.includes(record.name))continue;
    const field=label=>form.locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:new RegExp('^'+label+'$')})});
    // Only exact, user-confirmed erroneous snapshots are eligible for automatic repair.
    await field('获奖项').locator('.form-item__title').click();
    await fillPhoenix(page,field('获奖时间').locator('.phoenix-select'),{match:{groupId:'awards',key:'date',spec:{date:true}},value:record.date});
    await form.locator('textarea').fill(record.description);
    await field('获奖项').locator('input').fill(record.name);
    await field('获奖项').locator('input').press('Tab');
    if(await field('获奖项').locator('input').inputValue()!==record.name||await form.locator('textarea').inputValue()!==record.description)throw Error('获奖纠错回读失败');
  }
}
module.exports={repairAwards};
