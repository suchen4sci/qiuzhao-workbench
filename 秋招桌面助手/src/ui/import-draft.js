(function(root){
 async function deadline(task,ms){let timer;try{return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('读取公司信息超时')),ms);})]);}finally{clearTimeout(timer);}}
 async function readImportDraft({hot,primary,url,timeout=8000,hotTimeout=1500}){
  if(hot)try{return await deadline(hot,hotTimeout);}catch{}
  try{return await deadline(primary,timeout);}catch(error){return {company:'',role:'',url,companyReason:'自动读取暂不可用，请核对公司与岗位。'+error.message};}
 }
 if(typeof module==='object')module.exports={readImportDraft};else root.readImportDraft=readImportDraft;
})(typeof window==='object'?window:globalThis);
