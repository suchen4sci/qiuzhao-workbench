const {executeControl}=require('./control-dispatcher.cjs');
// Question labels identify records; visible controls are operated through normal UI events.
function isWjx(page){return /(^|\.)wjx\.cn$/.test(new URL(page.url()).hostname);}
async function questions(page){return page.locator('.field[topic]:visible').evaluateAll(es=>es.map(e=>({id:e.id,label:e.querySelector('.topichtml')?.textContent.replace(/【.*?】/g,'').trim(),required:e.getAttribute('req')==='1',type:e.getAttribute('type')})));}
function result(fields,started){return {fields,elapsedMs:Date.now()-started,counts:Object.fromEntries(['filled','ready','pending','existing','failed','notApplicable'].map(s=>[s,fields.filter(f=>f.status===s).length]))};}
async function select2(page,field,value){return executeControl(page,field.locator('.select2-selection'),{value});}
async function month(page,input,value){
  if(!/^\d{4}-\d{2}(?:-\d{2})?$/.test(value))throw Error('缺少确认日期');
  await input.click();const popup=page.locator('.layui-laydate:visible');await popup.waitFor();
  if(!await popup.locator('.laydate-month-list:visible').count())throw Error('尚未验证此日历模式');
  const y=Number(value.slice(0,4));for(let n=0;n<100;n++){const actual=parseInt(await popup.locator('[lay-type="year"]').textContent());if(actual===y)break;await popup.locator(actual>y?'.laydate-prev-y':'.laydate-next-y').click();}
  if(parseInt(await popup.locator('[lay-type="year"]').textContent())!==y)throw Error('日历年份未到达');
  await popup.locator('.laydate-month-list li[lay-ym="'+(Number(value.slice(5,7))-1)+'"]').click();
  if(await popup.isVisible())await popup.locator('.laydate-btns-confirm').click({timeout:1500});if(await input.inputValue()!==value.slice(0,7))throw Error('月份回读不一致');
}
async function fillWjx(page,profile,cancelled=()=>false,inspect=false){
  const started=Date.now(),fields=[];const policy=profile.wjx;
  if(!policy||new URL(page.url()).pathname!==policy.path||await page.title()!==policy.title)return result([{label:'问卷星',status:'pending',reason:'新问卷需确认题目与资料映射'}],started);
  for(let step=0;step<10;step++){
    const qs=await questions(page);let blocked=false;
    for(const q of qs){
      if(cancelled())return result(fields,started);
      const f={...q,group:'问卷星',status:'pending',reason:''};fields.push(f);
      const rule=policy.fields[q.label],field=page.locator('#'+q.id);
      if(!rule){f.reason='此题尚无确认答案或控件适配';if(q.required)blocked=true;continue;}
      let value=rule.path?rule.path.split('.').reduce((o,k)=>o?.[k],profile.values):rule.value;
      if(value===undefined||value===null||value===''){f.reason='知识库缺少答案';if(q.required)blocked=true;continue;}
      if(inspect){f.status='ready';continue;}
      try{
        if(rule.kind==='select'){const current=await field.locator('select option:checked').textContent();if(current===value){f.status='existing';continue;}if(current!=='请选择')throw Error('已有答案与知识库不一致');const executed=await select2(page,field,value);f.controlType=executed.controlType;f.attempts=executed.attempts;}
        else if(rule.kind==='checkbox'){
          for(const label of value){const choice=field.locator('.ui-checkbox').filter({has:page.locator('.label').filter({hasText:new RegExp('^'+label+'$')})});if(!await choice.locator('input[type=checkbox]').isChecked())await choice.locator('.label').click();if(!await choice.locator('input[type=checkbox]').isChecked())throw Error('多选回读失败');}
        }
        else if(rule.kind==='otherAwards'){
          const choice=field.locator('.ui-checkbox').filter({has:page.locator('.label').filter({hasText:/^其他$/})});
          if(!await choice.locator('input[type=checkbox]').isChecked())await choice.locator('.label').click();
          const text=profile.values.awards.map(a=>a.name+'（'+a.date+'）：'+a.description.replace(/\n/g,'；')).join('；');
          await choice.locator('input.OtherText').fill(text);if(!await choice.locator('input[type=checkbox]').isChecked()||await choice.locator('input.OtherText').inputValue()!==text)throw Error('其他奖励回读失败');
        } else {
          const input=field.locator('input:not([type=hidden]),textarea').first();const current=await input.inputValue();const expected=rule.kind==='month'?value.slice(0,7):String(value);
          if(q.label==='出生日期' && current.replace(/\D/g,'')===expected.replace(/\D/g,'')){f.status='existing';continue;}
          if(current===expected){f.status='existing';continue;}if(current)throw Error('已有答案与知识库不一致');
          if(rule.kind==='school'){await input.click();await page.getByText(value,{exact:true}).filter({visible:true}).click();}
          else if(rule.kind==='month')await month(page,input,value);
          else if(!await input.getAttribute('readonly')){const executed=await executeControl(page,input,{value:String(value),cancelled});f.controlType=executed.controlType;f.attempts=executed.attempts;}else throw Error('只读控件尚未适配');
          if(await input.inputValue()!==expected)throw Error('填写后回读不一致');
        }
        f.status='filled';f.reason='已回读，未提交';
      }catch(e){f.status='pending';f.reason=e.message;blocked=blocked||q.required;}
    }
    if(inspect||blocked||cancelled())break;
    const next=page.getByText('下一页',{exact:true}).filter({visible:true});if(await next.count()!==1)break;
    await next.click();try{await page.waitForFunction(ids=>{const now=[...document.querySelectorAll('.field[topic]')].filter(e=>e.getClientRects().length).map(e=>e.id).join(',');return now!==ids;},qs.map(q=>q.id).join(','),{timeout:2500});}catch{fields.push({label:'下一页',status:'pending',reason:'页面未切换，请检查网站校验提示'});break;}
  }
  return result(fields,started);
}
module.exports={isWjx,fillWjx,questions,month,select2};
