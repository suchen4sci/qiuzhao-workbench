async function triggerAI(ui,{checkOnly=false}={}){
 await ui.waitForFunction(()=>typeof window.aiReaderCommand==='function'&&Date.now()-(window.__aiReaderHeartbeat||0)<5000,{},{timeout:20000});
 if(checkOnly)return {status:'connected'};
 if(await ui.evaluate(()=>document.getElementById('ai').textContent.includes('停止')))return {status:'already-running'};
 await ui.evaluate(()=>window.aiReaderCommand({action:'start'}));
 return {status:'request-sent'};
}
module.exports={triggerAI};
