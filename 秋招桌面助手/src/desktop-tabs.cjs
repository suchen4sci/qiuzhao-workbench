const fs=require('fs'),path=require('path');
const {alive}=require('./browser-lifecycle.cjs');
const {ApplicationTabRegistry,restoreUrl}=require('./application-tab-registry.cjs');
class DesktopTabs{
 constructor({window,initialView,createView,onActivate,onState,onMailApplication,storage,demoUrl}){
  this.window=window;this.createView=createView;this.onActivate=onActivate;this.onState=onState;this.onMailApplication=onMailApplication;this.storage=storage;this.demoUrl=demoUrl;this.views=new Map();this.reports=new Map();this.visible=true;
  this.restoration=require('./tab-session-store.cjs').loadSession(storage);
  this.registry=new ApplicationTabRegistry(this.restoration.snapshot);
  let active=this.registry.tabs.find(t=>t.id===this.registry.activeId);
  if(!active){active=this.registry.add('https://new-tab.invalid/',{title:'新标签页'});this.registry.get(active.id).url=demoUrl;}
  this.views.set(active.id,initialView);this.bind(active.id,initialView);
  this.persistQueue=Promise.resolve();this.lastSaved=null;this.displayedId=active.id;
  this.registry.on('change',()=>{this.schedulePersist();this.emit();});
 }
 emit(){const state=this.registry.view();this.onState({...state,tabs:state.tabs.filter(t=>t.status!=='已关闭')});}
 schedulePersist(){if(this.persistTimer)return;this.persistTimer=setTimeout(()=>{this.persistTimer=null;this.persist().catch(error=>this.window.webContents.send('state',{type:'error',data:'标签历史保存失败：'+error.message}));},250);}
 persist(){
  clearTimeout(this.persistTimer);this.persistTimer=null;
  const data=JSON.stringify({version:1,nextId:this.registry.nextId,activeId:this.registry.activeId,tabs:this.registry.tabs.filter(t=>/^https?:/.test(t.url)&&t.status!=='已关闭').map(t=>({...t,url:restoreUrl(t.url)}))},null,2);
  const write=async()=>{
   if(data===this.lastSaved)return;
   const io=fs.promises;await io.mkdir(path.dirname(this.storage),{recursive:true});
   let previous;try{previous=await io.readFile(this.storage,'utf8');require('./tab-session-store.cjs').parseSession(previous);}catch{previous=null;}
   if(previous!==null)await io.writeFile(this.storage+'.bak',previous);
   await io.writeFile(this.storage+'.tmp',data);await io.rename(this.storage+'.tmp',this.storage);this.lastSaved=data;
  };
  this.persistQueue=this.persistQueue.catch(()=>{}).then(write);return this.persistQueue;
 }
 bind(id,view){
  this.configureNavigation(id,view);
  const wc=view.webContents;
  const update=()=>{if(wc.isDestroyed())return;const url=wc.getURL();const tab=this.registry.get(id);const nextUrl=url&&url!=='about:blank'?url:tab.url,title=wc.getTitle()||tab.company||tab.title;if(tab.url===nextUrl&&tab.title===title)return;tab.url=nextUrl;tab.title=title;this.schedulePersist();this.emit();};
  for(const event of ['did-stop-loading','did-navigate','did-navigate-in-page','page-title-updated'])wc.on(event,update);
  wc.on('dom-ready',()=>wc.executeJavaScript('Object.defineProperty(window,"__qiuzhaoTabId",{value:'+JSON.stringify(id)+',writable:false,configurable:false})').catch(()=>{}));
 }
 async start(){const current=this.registry.get(this.registry.activeId);this.emit();await require('./page-navigation.cjs').loadDocument(this.views.get(current.id).webContents,current.url).catch(()=>{});}
 async open(url,metadata={}){
  if(arguments.length===1)metadata=require('./ui/company-groups.js').openedMetadata(this.registry.tabs,this.registry.activeId,url,metadata);
  const tab=this.registry.add(url,metadata),view=this.createView();this.views.set(tab.id,view);this.bind(tab.id,view);this.activate(tab.id);
  view.webContents.loadURL(tab.url).catch(error=>{if(error.code!=='ERR_ABORTED')this.registry.update(tab.id,{status:'待确认',issues:[{field:'打开网站',reason:'网页加载失败，请重试'}]});});
  return tab;
 }
 async openFrom(parentId,url){return this.open(url,require('./ui/company-groups.js').openedMetadata(this.registry.tabs,parentId,url,{independent:true}));}
 configureNavigation(id,view){
  const wc=view.webContents;
  wc.setWindowOpenHandler(({url})=>{
   if(/^mailto:/i.test(url)){this.onMailApplication?.(url,wc);return {action:'deny'};}
   try{require('./application-tab-registry.cjs').validateUrl(url);}catch{return {action:'deny'};}
   // Beisen attachment downloads are files, not navigable application tabs.
   // Opening them as a view leaves an empty URL after Chromium starts download.
   if(require('./attachment-navigation.cjs').isAttachmentDownload(url)){
    require('./attachment-navigation.cjs').openAttachment(wc,url).catch(e=>this.window.webContents.send('state',{type:'error',data:'附件打开失败：'+e.message}));
    return {action:'deny'};
   }
   const address=new URL(url),businessAuth=address.hostname==='www.iguopin.com'&&address.pathname==='/auth/c';
   if(!businessAuth&&require('./browser-lifecycle.cjs').authPopup(url))return {action:'allow',overrideBrowserWindowOptions:{width:900,height:760,parent:this.window,webPreferences:{session:wc.session,contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}}};
   this.window.webContents.executeJavaScript('Boolean(busy||window.__aiReaderState?.active)').then(blocked=>{if(blocked)throw Error('当前任务正在填写，请先停止任务');return this.openFrom(id,url);}).catch(e=>this.window.webContents.send('state',{type:'error',data:e.message}));return {action:'deny'};
  });
 }
 activate(id){const previous=this.views.get(this.displayedId);let view=this.views.get(id);const tab=this.registry.get(id);if(tab.status==='已关闭')throw Error('网站标签已关闭');if(!alive(view)){view=this.createView();this.views.set(id,view);this.bind(id,view);view.webContents.loadURL(tab.url).catch(()=>{});}
  if(previous!==view&&alive(previous)){previous.setVisible(false);previous.webContents.setBackgroundThrottling(true);this.window.contentView.removeChildView(previous);}
  // Disabling throttling on even the foreground view disables it for its host
  // window too. Visible pages render normally with throttling enabled.
  // setVisible(false) alone still lets hidden WebContentsView pages animate.
  // Detach their native views, retaining WebContents, form values and history.
  if(this.visible)this.window.contentView.addChildView(view);else this.window.contentView.removeChildView(view);
  view.setVisible(this.visible);view.webContents.setBackgroundThrottling(true);this.displayedId=id;
  this.registry.activate(id);this.onActivate(view,this.reports.get(id));return tab;
 }
 async close(id){if(this.registry.tabs.filter(t=>t.status!=='已关闭').length===1)throw Error('请保留至少一个标签页');this.registry.close(id);const view=this.views.get(id);this.views.delete(id);this.reports.delete(id);if(view){this.window.contentView.removeChildView(view);if(alive(view))view.webContents.close();}this.activate(this.registry.activeId);}
 setVisible(value){this.visible=!!value;const view=this.activeView();if(alive(view)){if(this.visible)this.window.contentView.addChildView(view);else this.window.contentView.removeChildView(view);view.setVisible(this.visible);view.webContents.setBackgroundThrottling(true);}}
 layout(bounds){this.bounds=bounds;const view=this.views.get(this.displayedId);if(alive(view)){const current=view.getBounds();if(['x','y','width','height'].some(key=>current[key]!==bounds[key]))view.setBounds(bounds);}}
 replaceActive(view){this.views.set(this.registry.activeId,view);this.bind(this.registry.activeId,view);this.layout(view.getBounds());}
 record(report){const id=this.registry.activeId;if(!id)return;this.reports.set(id,report);const fields=report.fields||[];const issues=fields.filter(f=>['pending','failed'].includes(f.status)).map(f=>({field:f.label,reason:f.reason}));if(!issues.length&&!fields.length)issues.push({field:'页面识别',reason:'当前没有读取到简历字段，请进入申请表'});if(!issues.length&&report.completionVerified!==true)issues.push({field:'整站复核',reason:'当前字段执行结束，仍需确认全部栏目、保存及翻页结果'});this.registry.update(id,{status:issues.length?'待确认':'填写完成',issues});}
 activeView(){return this.views.get(this.registry.activeId);}
 async context(){const view=this.activeView();if(!alive(view))throw Error('当前网站已关闭');const wc=view.webContents;let targetId;
  const attached=wc.debugger.isAttached();try{if(!attached)wc.debugger.attach('1.3');const info=await wc.debugger.sendCommand('Target.getTargetInfo');targetId=info.targetInfo.targetId;}finally{if(!attached&&wc.debugger.isAttached())wc.debugger.detach();}
  return {tabId:this.registry.activeId,url:wc.getURL(),targetId,webContentsId:wc.id};
 }
 destroy(){clearTimeout(this.persistTimer);for(const view of this.views.values())if(alive(view))view.webContents.close();}
}
module.exports={DesktopTabs};
