const { normalize }=require('./rules.cjs');
async function ensureProjects(page,profile,cancelled=()=>false){
  const result={added:[],pending:[]};
  const explicitProjects=page.locator('.form-item__title').filter({hasText:/^项目名称$/});

  const url=page.url();
  const title=page.locator('.form-item__title').filter({hasText:/^(实践名称|项目名称)$/});
  const forms=page.locator('.ux-standard-form').filter({has:title});
  if(!await forms.count())return result;
  const names=()=>forms.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('.form-item')].find(f=>/^(实践名称|项目名称)$/.test(f.querySelector('.form-item__title')?.textContent.trim()||''))?.querySelector('input')?.value||''));
  for(const name of (profile.autoProjectNames||[]).slice(0,5)){
    if(cancelled()||page.url()!==url)break;
    if(!profile.values.projects.some(p=>p.name===name))continue;
    let current=await names();
    if(current.some(n=>normalize(n)===normalize(name)))continue;
    let empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
    if(empty.length>1){result.pending.push('多个空白项目无法唯一定位');break;}
    if(empty.length===0){
      const add=page.getByText(/^(添加在校实践|添加项目经历)$/,{exact:true}).filter({visible:true});
      if(await add.count()!==1){result.pending.push('未找到唯一添加入口');break;}
      const before=await forms.count();
      await require('./add-record-control.cjs').addRecord(add,forms,cancelled);
      await page.waitForFunction(count=>[...document.querySelectorAll('.ux-standard-form')].filter(e=>[...e.querySelectorAll('.form-item__title')].some(t=>/^(实践名称|项目名称)$/.test(t.textContent.trim()))).length===count+1,before,{timeout:2000});
      current=await names();empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
      if(empty.length!==1)throw new Error('新增项目定位不唯一');
      result.added.push(name);
    }
    const form=forms.nth(empty[0].i);
    if(await form.evaluate(e=>[...e.querySelectorAll('input,textarea')].some(x=>x.type!=='checkbox'&&x.value.trim()))){result.pending.push('无名称项目已有内容，请先核对');break;}
    if(cancelled()||page.url()!==url)break;
    const input=form.locator('.form-item').filter({has:title}).locator('input');
    await input.fill(name,{timeout:1500});await input.press('Tab');
    if(await input.inputValue()!==name)throw new Error('项目名称回读失败');
  }
  return result;
}
module.exports={ensureProjects};
