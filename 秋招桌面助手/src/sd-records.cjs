const {sectionFrom,normalize}=require('./rules.cjs');
// Identify repeated records by their own title field, never by global order.
async function ensureSDRecords(page,profile,cancelled=()=>false){
 const added=[];
 for(const section of await page.locator('[data-nav-id]').all()){
  const heading=section.locator('[class*="blockTitle-"] [class*="text-"]').first();
  if(!await heading.count())continue;
  const group=sectionFrom(await heading.innerText());
  if(!['awards','campus','family'].includes(group))continue;
  if(group!=='awards'){
   const label=group==='campus'?'项目名称':'姓名';
   const rows=section.locator('[class*="apply-fields-"]');
   const titleInput=row=>row.locator('[class*="apply-field-"]').filter({has:page.locator(':scope > [class*="title-"]').filter({hasText:new RegExp('^'+label+'$')})}).locator('input');
   for(const record of profile.values[group]||[]){
    if(cancelled())break;
    const current=await Promise.all((await rows.all()).map(row=>titleInput(row).inputValue()));
    if(current.some(n=>normalize(n)===normalize(record.name)))continue;
    let empty=current.map((n,i)=>({n,i})).filter(x=>!x.n);
    if(empty.length>1)throw new Error('多个空白记录，无法唯一定位');
    if(!empty.length){
     const add=section.locator('button').filter({hasText:/^添加$/});
     if(await add.count()!==1)throw new Error('新增记录入口不唯一');
     const count=await rows.count();await add.click();await rows.nth(count).waitFor({timeout:3000});empty=[{i:count}];
    }
    const input=titleInput(rows.nth(empty[0].i));await input.fill(record.name);await input.press('Tab');
    if(await input.inputValue()!==record.name)throw new Error('记录身份回读失败');
    added.push(record.name);
   }
   continue;
  }
  const rows=section.locator('[class*="apply-fields-"]');
  const names=()=>rows.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('[class*="apply-field-"]')].find(f=>f.querySelector(':scope > [class*="title-"]')?.textContent.trim()==='奖项名称')?.querySelector('input')?.value||''));
  for(const record of profile.values.awards||[]){
   if(cancelled())break;
   let current=await names();
   if(current.some(n=>[record.name,...(record.aliases||[])].some(a=>normalize(a)===normalize(n))))continue;
   let empty=current.map((n,i)=>({n,i})).filter(x=>!x.n);
   if(empty.length>1)throw new Error('多个空白奖项，无法唯一定位');
   if(!empty.length){
    const add=section.locator('button').filter({hasText:/^添加$/});
    if(await add.count()!==1)throw new Error('新增奖项入口不唯一');
    const count=await rows.count();await add.click();
    await rows.nth(count).waitFor({timeout:3000});
    current=await names();empty=current.map((n,i)=>({n,i})).filter(x=>!x.n);
    if(empty.length!==1)throw new Error('新增奖项回读失败');
   }
   const input=rows.nth(empty[0].i).locator('[class*="apply-field-"]').filter({has:page.locator(':scope > [class*="title-"]').filter({hasText:/^奖项名称$/})}).locator('input');
   const value=record.fullName||record.name;await input.fill(value);await input.press('Tab');
   if(await input.inputValue()!==value)throw new Error('奖项名称回读失败');
   added.push(record.name);
  }
 }
 return added;
}
module.exports={ensureSDRecords};
