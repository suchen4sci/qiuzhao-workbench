// Serialized into the shell by Playwright; must not depend on Node globals.
function installHotTransport({bridge,native}) {
  const pending=new Map();let id=0;
  window.__quickFillBridge=bridge;window.__quickFillHeartbeat=Date.now();
  window[bridge]=request=>new Promise((resolve,reject)=>{
    const requestId=++id,started=Date.now();
    const timer=setInterval(()=>{
      const lost=window.__quickFillBridge!==bridge||Date.now()-(window.__quickFillHeartbeat||0)>6000;
      if(!lost&&Date.now()-started<180000)return;
      clearInterval(timer);pending.delete(requestId);
      const lease=window.__hotRunLease;
      if(lost&&lease?.bridge===bridge){
        window.desktop.call('stop').catch(()=>{});
        window.desktop.call('sync-hot-report',{phase:'end',runId:lease.runId}).catch(()=>{});
        window.__hotRunLease=null;
      }
      reject(Error(lost?'填写连接已断开，已释放操作，请重新连接后再试':'填写请求超时，请停止并检查当前页面'));
    },1000);
    pending.set(requestId,{resolve,reject,timer});
    try { window[native](JSON.stringify({id:requestId,request})); }
    catch(error){clearInterval(timer);pending.delete(requestId);reject(error);}
  });
  window[bridge+'_settle']=message=>{
    const p=pending.get(message.id);if(!p)return;
    pending.delete(message.id);clearInterval(p.timer);
    message.error?p.reject(new Error(message.error)):p.resolve(message.result);
  };
}
module.exports={installHotTransport};
