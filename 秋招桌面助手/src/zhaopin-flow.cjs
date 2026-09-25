const {executeControl}=require('./control-dispatcher.cjs');
const exact=t=>new RegExp('^\\s*'+String(t).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$');
function field(p,label){return p.locator('.el-form-item').filter({has:p.locator('input:visible,textarea:visible')}).filter({has:p.locator(':scope > label').filter({hasText:exact(label)})});}
async function set(p,label,value){if(value===undefined||value===null||value==='')return false;const f=field(p,label);if(await f.count()!==1)throw Error(label+'字段不唯一');let l=f.locator('input,textarea').filter({visible:true});if(await f.locator('.apply-form-date-now__ipt input').count())l=f.locator('.apply-form-date-now__ipt input');else if(await l.count()!==1)throw Error(label+'控件不唯一');
return executeControl(p,l,{value:String(value),allowOverwrite:true});}

async function save(p){await p.getByRole('button',{name:/^(保\s*存|添\s*加)$/}).click();await p.waitForTimeout(1200);if(await p.locator('.el-form-item input:visible,.el-form-item textarea:visible').count()){const err=await p.locator('.el-form-item__error').allTextContents();throw Error('保存未完成：'+err.join('；'));}}
async function nav(p,t){await p.locator('.resume-menu-item__title').filter({hasText:exact(t)}).click();await p.locator('.form-content--title').filter({hasText:t}).waitFor({timeout:5000});await p.waitForTimeout(250);if(await p.getByText('跳转提示',{exact:true}).filter({visible:true}).count())throw Error('当前栏目未保存，不继续跳转');}
module.exports={field,set,save,nav};
