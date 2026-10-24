async function resolveActivePage(browser,ui){
 let context;try{context=await ui.evaluate(()=>window.desktop.call('application-tabs',{action:'context'}));}catch{}
 const pages=browser.contexts().flatMap(c=>c.pages()).filter(p=>p!==ui&&!p.url().startsWith('http://127.0.0.1:33210'));
 if(context){
  const candidates=pages.filter(p=>p.url()===context.url);if(candidates.length===1)return candidates[0];
  for(const p of candidates){const session=await p.context().newCDPSession(p);try{const info=await session.send('Target.getTargetInfo');if(info.targetInfo.targetId===context.targetId)return p;}finally{await session.detach();}}
  throw Error('当前标签尚未就绪：'+context.tabId);
 }
 if(pages.length!==1)throw Error('无法唯一识别当前招聘页');return pages[0];
}
module.exports={resolveActivePage};
