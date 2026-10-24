const {sectionFrom,normalize}=require('./rules.cjs');
const {executeControl}=require('./control-dispatcher.cjs');
const identityLabel={education:'学校名称',projects:'项目名称',internship:'单位名称',awards:'奖项',skills:'技能名称'};
async function savedFields(form){return form.evaluate(f=>Object.fromEntries(Array.from(f.querySelectorAll('.form_container li')).map(li=>{const label=li.querySelector(':scope > label');if(!label)return [];const clone=li.cloneNode(true);clone.querySelector('label')?.remove();return [label.textContent.replace(/[：:*\s]/g,''),clone.textContent.trim()];}).filter(x=>x.length)));}
function recordName(group,record){return record.school||record.company||(group==='awards'?record.fullName:record.name)||record.name;}
function identityMatches(group,record,fields){return normalize(fields[identityLabel[group]])===normalize(recordName(group,record))&&(group!=='education'||normalize(fields['学历'])===normalize(record.level));}
async function fillRecord(page,profile,group,index){
 const {scanPage,valueForControl,confirmedRecordValue}=require('./engine.cjs');
 const record={...profile.values[group][index]};
 if(group==='awards')record.name=record.fullName||record.name;
 if(group==='projects'){
  record.achievement=record.description?.split('测试成果：')[1]?.trim();
  record.responsibilities=record.description?.split('技术实现：')[1]?.split('测试成果：')[0]?.trim()||record.responsibilities;
  record.tools=['Vivado','Verilog','FPGA','示波器'].filter(x=>record.description?.toLowerCase().includes(x.toLowerCase())).join('、');
 }
 for(const checkbox of await page.locator('input.selNowDate:visible').all())if(record.endTime&&record.endTime!=='至今'&&await checkbox.isChecked())await checkbox.uncheck();
 let scan=await scanPage(page,profile,{[group]:index});const results=[];
 for(const item of scan.items.filter(i=>i.match?.groupId===group)){
  let raw=confirmedRecordValue(record,item.match.key,new URL(page.url()).origin).value;if(!raw)continue;
  const target=item.datePart?{value:item.datePart==='year'?String(raw).slice(0,4):String(Number(String(raw).slice(5,7)))}:valueForControl(raw,item.match.spec,item);
  if(!target.value)continue;
  const locator=item.frame.locator(item.selector);
  if(item.readonly&&!item.legacyRegion&&!item.legacyDate){if(await locator.inputValue()===target.value)continue;throw Error(item.label+'只读且尚未匹配');}
  const result=await executeControl(item.frame,locator,{...item,...target,allowOverwrite:true});
  if(!['filled','existing'].includes(result.status))throw Error(item.label+'未通过控件回读');
  results.push({label:item.label,status:result.status,value:target.value,actual:item.tag==='select'&&!item.datePart?await locator.evaluate(e=>e.selectedOptions[0]?.textContent.trim()):result.value,datePart:item.datePart,key:item.match.key});
 }
 const identityKey={education:'school',projects:'name',internship:'company',awards:'name',skills:'name'}[group];
 if(!scan.items.some(i=>i.match?.groupId===group&&i.match.key===identityKey))throw Error('记录名称未识别，停止保存');
 const save=page.locator('a[name=btnSave]:visible');if(await save.count()!==1)throw Error('保存记录入口不唯一');
 await save.click();await save.waitFor({state:'hidden',timeout:8000});
 const section=page.locator('.mainContainer').filter({has:page.locator('.dl_menutit').filter({hasText:new RegExp(group==='education'?'教育背景':group==='projects'?'项目经验':group==='internship'?'实习经验':group==='awards'?'获奖情况':'技能')})});
 let persisted;for(const form of await section.locator('form:visible').all())if(await form.locator('a[name=editItem]').count()){const fields=await savedFields(form);if(identityMatches(group,record,fields))persisted=fields;}
 if(!persisted)throw Error('保存后记录名称未回读到');
 for(const field of results){
  if(field.datePart){const dates=(persisted['时间']||persisted['实习时间']||'').match(/\d{4}\/\d{1,2}/g)||[];const actual=dates[field.key==='endTime'?1:0]?.split('/').map(Number);if(!actual||String(actual[field.datePart==='year'?0:1])!==field.value)throw Error(field.label+'保存后日期回读不一致');}
  else{const actual=persisted[field.label.replace(/[：:*\s]/g,'')];const same=normalize(actual)===normalize(field.actual);const dateEqual=field.key==='date'&&actual?.match(/\d+/g)?.map(Number).join('-')===field.actual?.match(/\d+/g)?.map(Number).join('-');if(!same&&!dateEqual)throw Error(field.label+'保存后回读不一致');}
 }
 return results;
}
async function completeLegacyRecords(page,profile,cancelled=()=>false){
 const results=[];
 const sections=page.locator('.mainContainer');
 if(!await sections.count())return results;
 for(const section of await sections.all()){
  const title=section.locator(':scope > .dl_greyline_bg .dl_menutit');if(!await title.count())continue;
  const group=sectionFrom((await title.innerText()).replace(/^\*/,''));
  if(!['education','projects','internship','awards','skills'].includes(group))continue;
  const records=(profile.values[group]||[]).map((record,index)=>({record,index})).filter(({record})=>group!=='projects'||profile.autoProjectNames?.includes(record.name)).filter(({record})=>group!=='skills'||!!record.level||!!record.portalOverrides?.some(a=>a.key==='level'));
  const used=new Set();
  for(const {record,index} of records){
   if(cancelled())return results;
   let forms=section.locator('form:visible');
   let selected;
   for(const form of await forms.all()){
    const id=await form.getAttribute('id');if(used.has(id)||!await form.locator('a[name=editItem]').count())continue;
    if(identityMatches(group,record,await savedFields(form))){if(selected)throw Error(group+'已有经历身份不唯一');selected=form;}
   }
   if(selected){
    used.add(await selected.getAttribute('id'));await selected.locator('a[name=editItem]').click();
   }else{
    const add=section.locator('a[name=addItem]');if(await add.count()!==1)throw Error('新增记录入口不唯一');await add.click();
   }
   await section.locator('a[name=btnSave]:visible').waitFor({timeout:6000});
   const form=section.locator('form').filter({has:page.locator('a[name=btnSave]:visible')});
   used.add(await form.getAttribute('id'));
   results.push({group,index,fields:await fillRecord(page,profile,group,index)});
  }
 }
 return results;
}
module.exports={completeLegacyRecords,fillRecord,savedFields,identityMatches};
