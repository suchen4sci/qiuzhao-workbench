const { normalize }=require('./rules.cjs');
async function ensureProjects(page,profile,cancelled=()=>false){
  const result={added:[],pending:[]};
  const explicitProjects=page.locator('.form-item__title').filter({hasText:/^项目名称$/});
  const explicitAdd=page.getByText('添加项目经历',{exact:true}).filter({visible:true});
  // Some templates omit project name altogether. A real project section still
  // takes precedence over a separate campus-practice section.
  if(!await explicitProjects.count() && await explicitAdd.count()){
    const rows=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__title').filter({hasText:/^项目描述$/})});
    if(!await rows.count()){result.pending.push('项目栏目存在但缺少可识别记录');return result;}
    for(const name of profile.autoProjectNames||[]){
      if(cancelled())break;
      const record=profile.values.projects.find(r=>r.name===name);if(!record)continue;
      const current=await rows.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('.form-item')].find(f=>f.querySelector('.form-item__title')?.textContent.trim()==='项目描述')?.querySelector('textarea')?.value||''));
      if(current.some(v=>v.split('\n')[0]==='项目：'+name))continue;
      let empty=current.flatMap((v,i)=>!v.trim()?[i]:[]);
      if(empty.length>1){result.pending.push('多个无名称空项目，须核对');break;}
      if(!empty.length){await require('./add-record-control.cjs').addRecord(explicitAdd,rows,cancelled);empty=[await rows.count()-1];result.added.push(name);}
      const input=rows.nth(empty[0]).locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^项目描述$/})}).locator('textarea');
      await input.fill('项目：'+name+'\n'+record.description);await input.press('Tab');
    }
    return result;
  }

  const url=page.url();
  const title=page.locator('.form-item__title').filter({hasText:await explicitProjects.count()? /^项目名称$/ : /^实践名称$/});
  const forms=page.locator('.ux-standard-form').filter({has:title});
  if(!await forms.count())return result;
  const names=()=>forms.evaluateAll(es=>es.map(e=>[...e.querySelectorAll('.form-item')].find(f=>/^(实践名称|项目名称)$/.test(f.querySelector('.form-item__title')?.textContent.trim()||''))?.querySelector('input')?.value||''));
  for(const name of (profile.autoProjectNames||[]).slice(0,5)){
    if(cancelled()||page.url()!==url)break;
    if(!profile.values.projects.some(p=>p.name===name))continue;
    let current=await names();
    if(current.some(n=>require('./project-identity.cjs').projectMatches(profile.values.projects.find(r=>r.name===name),n)))continue;
    let empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
    if(empty.length>1){result.pending.push('多个空白项目无法唯一定位');break;}
    if(empty.length===0){
      const add=page.getByText(await explicitProjects.count()?'添加项目经历':'添加在校实践',{exact:true}).filter({visible:true});
      if(await add.count()!==1){result.pending.push('未找到唯一添加入口');break;}
      const before=await forms.count();
      await require('./add-record-control.cjs').addRecord(add,forms,cancelled);
      await page.waitForFunction(({count,label})=>[...document.querySelectorAll('.ux-standard-form')].filter(e=>[...e.querySelectorAll('.form-item__title')].some(t=>t.textContent.trim()===label)).length===count+1,{count:before,label:await explicitProjects.count()?'项目名称':'实践名称'},{timeout:2000});
      current=await names();empty=current.map((n,i)=>({n,i})).filter(x=>!x.n.trim());
      if(empty.length!==1)throw new Error('新增项目定位不唯一');
      result.added.push(name);
    }
    const form=forms.nth(empty[0].i);
    if(await form.evaluate((e,role)=>[...e.querySelectorAll('input,textarea')].some(x=>x.type!=='checkbox'&&x.value.trim()&&!(/^(职务|项目职务|担任职务)$/.test(x.closest('.form-item')?.querySelector('.form-item__title')?.textContent.trim()||'')&&x.value===role)),profile.values.projects.find(r=>r.name===name)?.role)){result.pending.push('无名称项目已有内容，请先核对');break;}
    if(cancelled()||page.url()!==url)break;
    const input=form.locator('.form-item').filter({has:title}).locator('input');
    await input.fill(name,{timeout:1500});await input.press('Tab');
    if(await input.inputValue()!==name)throw new Error('项目名称回读失败');
  }
  return result;
}
module.exports={ensureProjects};
