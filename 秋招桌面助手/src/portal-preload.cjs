const {ipcRenderer}=require('electron');
// Restore this tab's encrypted, origin-scoped session before page scripts run.
if(window.top===window&&/^https?:$/.test(location.protocol)){
 try{const saved=ipcRenderer.sendSync('portal-session-restore',location.origin);if(saved)for(const [key,value] of Object.entries(saved))sessionStorage.setItem(key,String(value));}catch{}
 const checkpoint=()=>{try{ipcRenderer.send('portal-session-checkpoint',{url:location.href,entries:Object.fromEntries(Object.entries(sessionStorage))});}catch{}};
 window.addEventListener('pagehide',checkpoint);setInterval(checkpoint,30000);
}
// Mail links are application actions, not HTTP navigation. Keep the portal open.
window.addEventListener('click',event=>{
 const a=event.target?.closest?.('a[href]');
 if(!a||!event.isTrusted||event.button!==0||!/^mailto:/i.test(a.href))return;
 event.preventDefault();event.stopImmediatePropagation();
 ipcRenderer.send('portal-mail-application',a.href);
},true);
