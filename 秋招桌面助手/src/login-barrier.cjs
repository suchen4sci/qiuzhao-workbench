async function loginBarrier(page){
 const modals=page.locator('[class*="sd-Modal-container-"],[role="dialog"]').filter({visible:true});
 for(const modal of await modals.all()){
  if(await modal.locator('input[placeholder*="验证码"]').count()&&/登录/.test(await modal.innerText()))return true;
 }
 return false;
}
module.exports={loginBarrier};
