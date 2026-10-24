const fs=require('node:fs'),path=require('node:path');
function atomic(file,data){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file+'.tmp',data);fs.renameSync(file+'.tmp',file);}
class SessionRetention{
 constructor({session,safeStorage,file}){this.session=session;this.crypto=safeStorage;this.file=file;this.state={version:1,cookies:[],tabs:{}};this.timer=null;this.writes=Promise.resolve();this.restoreOnce=new Set();}
 async start(){
  if(!this.crypto.isEncryptionAvailable())throw Error('系统凭据加密不可用，不能保存临时登录会话');
  if(fs.existsSync(this.file)){try{this.state=JSON.parse(this.crypto.decryptString(fs.readFileSync(this.file)));}catch{throw Error('登录会话备份无法解密，保留原文件');}}
  for(const [id,tab] of Object.entries(this.state.tabs||{}))for(const origin of Object.keys(tab.origins||{}))this.restoreOnce.add(id+'|'+origin);
  for(const c of this.state.cookies||[]){
   if(c.expirationDate&&c.expirationDate<=Date.now()/1000)continue;
   const details={url:(c.secure?'https':'http')+'://'+c.domain.replace(/^\./,'')+(c.path||'/'),name:c.name,value:c.value,path:c.path,secure:c.secure,httpOnly:c.httpOnly,sameSite:c.sameSite};
   if(!c.hostOnly)details.domain=c.domain;if(c.expirationDate)details.expirationDate=c.expirationDate;
   await this.session.cookies.set(details).catch(()=>{});
  }
  this.changed=()=>{clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),350);};
  this.session.cookies.on('changed',this.changed);
 }
 get(tabId,origin){const key=tabId+'|'+origin;if(!this.restoreOnce.delete(key))return null;return this.state.tabs?.[tabId]?.origins?.[origin]||null;}
 restoreTabUrls(registry){
  const {restoreUrl}=require('./application-tab-registry.cjs'),{authPopup}=require('./browser-lifecycle.cjs');
  for(const tab of registry.tabs){const raw=this.state.tabs?.[tab.id]?.url;if(!raw||authPopup(raw))continue;try{if(restoreUrl(raw)===tab.url)tab.url=raw;}catch{}}
 }
 capture(tabId,url,entries){
  const origin=new URL(url).origin;if(!/^https?:/.test(url)||!tabId||origin==='null')return;
  const tab=this.state.tabs[tabId]||{origins:{}};
  if(tab.url===url&&JSON.stringify(tab.origins[origin])===JSON.stringify(entries))return;
  tab.url=url;tab.origins[origin]=entries;this.state.tabs[tabId]=tab;
  this.changed?.();
 }
 async flush(){
  this.writes=this.writes.catch(()=>{}).then(async()=>{
   this.state.cookies=await this.session.cookies.get({});
   atomic(this.file,this.crypto.encryptString(JSON.stringify(this.state)));
   await this.session.cookies.flushStore();this.session.flushStorageData();
  });return this.writes;
 }
 async checkpoint(tabs){
  for(const [id,view] of tabs.views){try{const wc=view.webContents;if(wc.isDestroyed())continue;const data=await wc.executeJavaScript('({url:location.href,entries:Object.fromEntries(Object.entries(sessionStorage))})');this.capture(id,data.url,data.entries);}catch{}}
  const open=new Set(tabs.registry.tabs.filter(t=>t.status!=='已关闭').map(t=>t.id));for(const id of Object.keys(this.state.tabs))if(!open.has(id))delete this.state.tabs[id];
  clearTimeout(this.timer);await this.flush();
 }
}
module.exports={SessionRetention,atomic};
