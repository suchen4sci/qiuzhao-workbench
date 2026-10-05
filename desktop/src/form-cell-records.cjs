const {executeControl}=require('./control-dispatcher.cjs');
const {sectionFrom,normalize,groups}=require('./rules.cjs');
const defs={family:{identity:'name'},internship:{identity:'company'},projects:{identity:'name'}};
async function ensureFormCellRecords(page,profile,cancelled=()=>false){
 const result={added:[],pending:[]};const url=page.url();
 const sections=page.locator('.form-cell').filter({visible:true});
 for(let i=0;i<await sections.count();i++){
  const section=sections.nth(i);const title=await section.locator(':scope > .tit-wrap .tit > p').textContent().catch(()=>null);
  const group=sectionFrom(title),def=defs[group];if(!def)continue;
  const identityLabels=groups[group].fields[def.identity].aliases.map(normalize);
  let records=profile.values[group]||[];
  if(group==='projects')records=records.filter(r=>profile.autoProjectNames?.includes(r.name));
  const rows=section.locator('.form-cell-inner').filter({visible:true});
  const findIdentity=async row=>{
   const fields=row.locator('.ant-form-item').filter({visible:true});
   const indexes=await fields.evaluateAll((nodes,labels)=>nodes.map((item,index)=>{
    const label=item.querySelector('.ant-form-item-label')?.cloneNode(true);if(!label)return -1;
    label.querySelectorAll('.remarkShow,.labelRequired,svg,button').forEach(n=>n.remove());
    const text=label.textContent.toLowerCase().replace(/[\s*＊:：()（）\[\]【】\-_/]/g,'');return labels.includes(text)?index:-1;
   }).filter(i=>i>=0),identityLabels);
   return indexes.length===1?fields.nth(indexes[0]).locator('input:not([type="hidden"])').filter({visible:true}):null;
  };
  for(const record of records.slice(0,8)){
   if(cancelled()||page.url()!==url)return result;
   const name=record[def.identity];if(!name)continue;
   const values=[];for(let n=0;n<await rows.count();n++){const input=await findIdentity(rows.nth(n));values.push(input&&await input.count()===1?await input.inputValue():null);}
   if(values.some(v=>v===null)){result.pending.push(title+'现有记录的身份控件未能唯一识别，未继续新增');break;}
   const matches=values.filter(v=>v!==null&&normalize(v)===normalize(name));
   if(matches.length===1)continue;
   if(matches.length>1){result.pending.push(title+'存在重复记录，未继续新增');break;}
   let empty=values.map((v,n)=>({v,n})).filter(x=>x.v==='');
   if(empty.length>1){result.pending.push(title+'存在多条无身份的空记录，未猜测归属');break;}
   if(!empty.length){
    const add=section.locator('.add-more-btn:visible').filter({hasText:/^添加新的/});
    if(await add.count()!==1){result.pending.push(title+'未找到唯一新增入口');break;}
    const before=await rows.count();await add.click({timeout:1500});await rows.nth(before).waitFor({state:'visible',timeout:2500});
    if(await rows.count()!==before+1){result.pending.push(title+'新增记录数量不明确，未猜测归属');break;}
    empty=[{n:before,v:''}];
   }
   const row=rows.nth(empty[0].n),input=await findIdentity(row);
   if(!input||await input.count()!==1){result.pending.push(title+'新增记录的名称控件未识别');break;}
   const populated=await row.locator('input,textarea,select,[contenteditable="true"],.ant-select-selection-selected-value,.ant-select-selection-item,.ant-radio-wrapper-checked,.ant-checkbox-checked').evaluateAll(es=>es.some(e=>{
    if(!e.getClientRects().length||getComputedStyle(e).visibility==='hidden'||getComputedStyle(e).display==='none'||e.type==='hidden')return false;
    if(['radio','checkbox'].includes(e.type))return e.checked;
    if(e.type==='file')return !!e.files?.length;
    if(e.tagName==='SELECT')return !!e.value&&!/^(请选择|请选择.*|select an option)$/i.test(e.selectedOptions[0]?.textContent.trim()||'');
    return !!String(e.value??e.textContent??'').trim();
   }));
   if(populated){result.pending.push(title+'无名称记录已有内容，先核对再匹配');break;}
   await executeControl(page,input,{value:name,cancelled});
   result.added.push({group,name});
  }
 }
 return result;
}
module.exports={ensureFormCellRecords};
