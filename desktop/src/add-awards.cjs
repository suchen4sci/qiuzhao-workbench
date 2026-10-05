const { normalize }=require('./rules.cjs');
async function ensureAwards(page,profile,cancelled=()=>false){
  const result={added:[],pending:[]};
  await require('./repair-awards.cjs').repairAwards(page,profile,cancelled);
  const url=page.url();
  const title=page.locator('.form-item__title').filter({hasText:/^(获奖项|奖项)$/});
  const forms=page.locator('.ux-standard-form').filter({has:title});
  if(!await forms.count())return result;
  const names=()=>forms.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('.form-item')].find(f=>/^(获奖项|奖项)$/.test(f.querySelector('.form-item__title')?.textContent.trim()||''))?.querySelector('input')?.value||''));
  const initial=await names();
  const identities=initial.filter(n=>n.trim()).map(n=>profile.values.awards.filter(a=>[a.name,...(a.aliases||[])].some(v=>normalize(v)===normalize(n))));
  if(identities.some(a=>a.length!==1)||new Set(identities.map(a=>a[0]?.name)).size!==identities.length){result.pending.push('已有奖项含混合名称或重复记录，先核对拆分，暂停自动新增');return result;}
  for(const name of (profile.autoAwardNames||[])){
    if(cancelled()||page.url()!==url)break;
    if(!profile.values.awards.some(p=>p.name===name))continue;
    let current=await names();
    const record=profile.values.awards.find(a=>a.name===name);if(current.some(n=>[name,...(record.aliases||[])].some(a=>normalize(n)===normalize(a))))continue;
    let empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
    if(empty.length>1){result.pending.push('多个空白奖项无法唯一定位');break;}
    if(empty.length===0){
      const add=page.getByText(/^(添加获奖情况)$/,{exact:true}).filter({visible:true});
      if(await add.count()!==1){result.pending.push('未找到唯一添加入口');break;}
      const before=await forms.count();
      await require('./add-record-control.cjs').addRecord(add,forms,cancelled);
      await page.waitForFunction(count=>[...document.querySelectorAll('.ux-standard-form')].filter(e=>[...e.querySelectorAll('.form-item__title')].some(t=>/^(获奖项|奖项)$/.test(t.textContent.trim()))).length===count+1,before,{timeout:2000});
      current=await names();empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
      if(empty.length!==1)throw new Error('新增奖项定位不唯一');
      result.added.push(name);
    }
    const form=forms.nth(empty[0].i);
    if(await form.evaluate(e=>[...e.querySelectorAll('input,textarea')].some(x=>x.type!=='checkbox'&&x.value.trim()))){result.pending.push('无名称奖项已有内容，请先核对');break;}
    if(cancelled()||page.url()!==url)break;
    const input=form.locator('.form-item').filter({has:title}).locator('input');
    await input.fill(name,{timeout:1500});await input.press('Tab');
    if(await input.inputValue()!==name)throw new Error('奖项名称回读失败');
  }
  return result;
}
module.exports={ensureAwards};
