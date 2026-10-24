function equivalentMajor(actual,target){
 const clean=s=>String(s||'').replace(/\s/g,'').replace(/（/g,'(').replace(/）/g,')');
 const seen=clean(actual),wanted=clean(target);
 if(!wanted)return false;
 return seen===wanted||seen.replace(/\((?:工学类专业学位|电子信息类|电子信息科学类)\)$/,'')===wanted;
}
async function fillDictionaryMajor(frame,locator,target){
 await locator.click({timeout:1200});
 const panel=frame.locator('.school-wrap[role="dialog"]:visible');
 await panel.waitFor({state:'visible',timeout:1200});
 if(await panel.locator('.tit').innerText()!=='请选择专业：')throw Error('UNSUPPORTED');
 const search=panel.locator('input[placeholder="请输入专业名称"]');
 await search.fill(target,{timeout:1200});
 let match;
 for(let i=0;i<25;i++){
  const options=panel.locator('.school-item:visible');
  const names=await options.allTextContents();const found=names.map((name,index)=>({name,index})).filter(o=>equivalentMajor(o.name,target));
  if(found.length>1)throw Error('AMBIGUOUS');
  if(found.length===1){match=options.nth(found[0].index);break;}
  await new Promise(resolve=>setTimeout(resolve,80));
 }
 if(!match)throw Error('OPTION');
 await match.click({timeout:1200});
 const confirm=panel.getByRole('button',{name:'选择',exact:true});
 if(await confirm.count()===1&&await confirm.isVisible())await confirm.click({timeout:1200});
 await panel.waitFor({state:'hidden',timeout:1200});
 const actual=await locator.inputValue();if(!equivalentMajor(actual,target))throw Error('VERIFY');
 return actual;
}
module.exports={fillDictionaryMajor,equivalentMajor};
