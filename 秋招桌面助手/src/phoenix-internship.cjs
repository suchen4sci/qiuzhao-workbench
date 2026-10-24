const {normalize}=require('./rules.cjs');
// Seed companies only within explicit work/internship records. Never reuse student work.
async function ensurePhoenixInternship(page,profile,cancelled=()=>false,allowEmpty=false){
 const gates=page.locator('.ux-standard-form').filter({has:page.locator('.form-item__title').filter({hasText:/^是否有实习\/工作经历$/})});
 if(await gates.count()&&(profile.values.internship||[]).length){
  if(await gates.count()!==1)throw Error('有多条条件式实习记录，须核对并合并空白重复项');
  const gate=gates.first().locator('.form-item').filter({has:page.locator('.form-item__title').filter({hasText:/^是否有实习\/工作经历$/})});
  if(!await gates.first().locator('.form-item__title').filter({hasText:/^(公司名称|实习单位|单位名称)$/}).count()){
   await gate.getByText('是',{exact:true}).click();
   await gates.first().locator('.form-item__title').filter({hasText:/^(公司名称|实习单位|单位名称)$/}).waitFor({timeout:2500});
  }
 }
 const title=page.locator('.form-item__title').filter({hasText:/^(公司名称|实习单位|单位名称)$/});
 let rows=page.locator('.ux-standard-form').filter({has:title});
 if(await page.getByText('添加实习经历',{exact:true}).count()&&await page.getByText('添加工作经历',{exact:true}).count()){const dedicated=rows.filter({has:page.locator('.form-item__title').filter({hasText:/^(实习内容|实习描述|实习工作职责)$/})});if(await dedicated.count())rows=dedicated;else throw Error('网站独立区分工作与实习，尚无唯一实习记录容器，未混填');}
 if(!await rows.count()&&!allowEmpty)return;
 const identity=row=>row.locator('.form-item').filter({has:title}).locator('input');
 const expected=profile.values.internship||[];
 for(const record of expected){
  if(cancelled())return;if(!record.company)continue;
  const names=await Promise.all((await rows.all()).map(r=>identity(r).inputValue()));
  if(names.filter(n=>normalize(n)===normalize(record.company)).length>1)throw Error('工作经历中实习公司重复，须核对记录');
  const existing=names.findIndex(n=>normalize(n)===normalize(record.company));
  if(existing>=0){
   if(/^\d{4}-\d{2}/.test(record.endTime||'')){
    const ongoing=rows.nth(existing).locator('.phoenix-checkbox').filter({hasText:/^至今$/});
    if(await ongoing.count()===1&&await ongoing.locator('.phoenix-checkbox__realInput--checked').count()){
     await ongoing.locator('.phoenix-checkbox__text').click();
     if(await ongoing.locator('.phoenix-checkbox__realInput--checked').count())throw Error('已结束实习的至今状态未清除');
    }
   }
   continue;
  }
  const unknown=names.filter(n=>n&&!expected.some(r=>normalize(r.company)===normalize(n)));
  if(unknown.length)throw Error('工作经历中存在未匹配公司，可能为简历解析误放学生经历；须核对后纠正，不能按序套用');
  const empty=[];
  for(let i=0;i<names.length;i++)if(!names[i]&&!await rows.nth(i).locator('input,textarea').evaluateAll(es=>es.some(e=>e.type!=='checkbox'&&e.value.trim())))empty.push(i);
  if(empty.length>1)throw Error('工作经历有多个空白记录，不能按序套用');
  if(names.some(n=>!n)&&!empty.length)throw Error('工作经历无公司名称但有其他内容，须核对记录归属');
  let index=empty[0];
  if(index===undefined){
   const add=page.getByText(/^(添加工作经历|添加实习经历|添加实习\/工作经历)$/,{exact:true}).filter({visible:true});
   if(await add.count()!==1)throw Error('实习工作经历新增入口不唯一');
   index=await require('./add-record-control.cjs').addRecord(add,rows,cancelled);
  }
  const input=identity(rows.nth(index));await input.fill(record.company);await input.press('Tab');
  if(await input.inputValue()!==record.company)throw Error('实习工作公司回读失败');
 }
}
module.exports={ensurePhoenixInternship};
