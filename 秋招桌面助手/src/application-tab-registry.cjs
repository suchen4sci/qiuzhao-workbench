const {EventEmitter}=require('node:events');

const STATES=new Set(['待登录','待填写','填写中','待确认','填写完成','已投递','已关闭']);
function validateUrl(raw){
  const url=new URL(String(raw||'').trim());
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('请输入HTTP或HTTPS招聘网址');
  return url.href;
}
function restoreUrl(raw){
  const url=new URL(validateUrl(raw));
  for(const key of [...url.searchParams.keys()])if(/^(code|sid|token|access_token|refresh_token|bc_sign|bc_nonce|quark_s)$/i.test(key))url.searchParams.delete(key);
  return url.href;
}

// Owns tab identity and queue state only. It never stores form values or cookies.
class ApplicationTabRegistry extends EventEmitter{
  constructor(snapshot={}){
    super();this.tabs=(snapshot.tabs||[]).map(t=>({...t,url:validateUrl(t.url),status:t.status==='填写中'?'待填写':t.status,issues:t.issues||[]}));
    require('./ui/company-groups.js').migrate(this.tabs);
    this.nextId=Math.max(snapshot.nextId||1,...this.tabs.map(t=>Number(t.id.slice(1))+1),1);
    this.activeId=this.tabs.some(t=>t.id===snapshot.activeId&&t.status!=='已关闭')?snapshot.activeId:this.tabs.find(t=>t.status!=='已关闭')?.id||null;
    this.queue=[];this.runningId=null;this.paused=false;this.cancelRequested=false;
  }
  get(id){const tab=this.tabs.find(t=>t.id===id);if(!tab)throw Error('网站编号不存在：'+id);return tab;}
  emitState(){this.emit('change',this.view());}
  view(){return {activeId:this.activeId,runningId:this.runningId,queue:[...this.queue],paused:this.paused,tabs:this.tabs.map(t=>({...t,issues:t.issues.map(i=>({...i}))}))};}
  add(raw,metadata={}){
    const url=validateUrl(raw),id='A'+String(this.nextId++).padStart(2,'0');
    const existing=metadata.company&&this.tabs.find(t=>t.company===metadata.company);
    const tab={id,url,company:metadata.company||'',companyId:metadata.companyId||existing?.companyId||existing?.id||id,parentId:metadata.parentId||null,companySource:metadata.companySource||'explicit',role:metadata.role||'',title:metadata.title||new URL(url).hostname,status:'待登录',issues:[],dirty:false};
    this.tabs.push(tab);this.activeId=id;this.emitState();return {...tab};
  }
  activate(id){const tab=this.get(id);if(tab.status==='已关闭')throw Error('网站标签已关闭');this.activeId=id;this.emitState();return tab;}
  update(id,patch){
    const tab=this.get(id);if(patch.status&&!STATES.has(patch.status))throw Error('未知填写状态');
    for(const key of ['company','role','title','status','dirty'])if(Object.hasOwn(patch,key))tab[key]=patch[key];
    if(Object.hasOwn(patch,'url'))tab.url=validateUrl(patch.url);
    if(Object.hasOwn(patch,'issues'))tab.issues=patch.issues.map((issue,index)=>({id:id+'-Q'+String(index+1).padStart(2,'0'),field:String(issue.field||''),reason:String(issue.reason||''),kind:issue.kind||'待确认'}));
    this.emitState();return tab;
  }
  close(id){if(this.runningId===id)throw Error('请先停止此网站的填写');const tab=this.get(id);tab.status='已关闭';this.queue=this.queue.filter(t=>t!==id);if(this.activeId===id)this.activeId=this.tabs.find(t=>t.status!=='已关闭')?.id||null;this.emitState();}
  enqueue(ids){
    for(const id of ids){const tab=this.get(id);if(tab.status==='已关闭')throw Error('不能填写已关闭标签');if(id!==this.runningId&&!this.queue.includes(id))this.queue.push(id);}
    this.paused=false;this.cancelRequested=false;this.emitState();
  }
  pause(){this.paused=true;this.cancelRequested=true;this.emitState();}
  async drain(worker){
    if(this.runningId)throw Error('已有批量任务运行');
    while(this.queue.length&&!this.paused){
      const id=this.queue.shift(),tab=this.get(id);this.runningId=id;this.cancelRequested=false;this.update(id,{status:'填写中'});
      try{
        const report=await worker({...tab},()=>this.cancelRequested);
        if(this.cancelRequested){this.update(id,{status:'待填写'});this.queue.unshift(id);break;}
        const issues=(report.fields||[]).filter(f=>['pending','failed'].includes(f.status)).map(f=>({field:f.label,reason:f.reason,kind:f.status==='failed'?'技术失败':'待确认'}));
        if(!issues.length&&report.completionVerified!==true)issues.push({field:'整站复核',reason:'当前字段执行结束，仍需确认全部栏目、保存及翻页结果',kind:'待确认'});
        this.update(id,{status:issues.length?'待确认':'填写完成',issues});
      }catch(error){this.update(id,{status:'待确认',issues:[{field:'网站连接或填写',reason:error.message,kind:'技术失败'}]});}
      finally{this.runningId=null;this.emitState();}
    }
    return this.view();
  }
  snapshot(){return {version:1,nextId:this.nextId,activeId:this.activeId,tabs:this.tabs.map(t=>({...t,url:restoreUrl(t.url),status:t.status==='填写中'?'待填写':t.status}))};}
}
module.exports={ApplicationTabRegistry,validateUrl,restoreUrl};
