'use strict';
const {createHash}=require('node:crypto');
const {publicUrl}=require('./public-page.cjs');
const PROVIDER='Brave Search',ENDPOINT='https://api.search.brave.com/res/v1/web/search';
function createSearch(store,{vault,fetchImpl=fetch,clock=Date.now}={}){
 let closed=false,epoch=0,active=null;const cache=new Map();
 const put=item=>store.put('discoveryRuns',item,{expectedRevision:store.get('discoveryRuns',item.id)?.revision||0});
 for(const run of store.list('discoveryRuns').filter(r=>r.kind==='web_search'&&r.status==='running'))put({...run,status:'interrupted',error:'上次搜索中断，供应商可能已计费；再次搜索需要新确认'});
 function config(){const s=store.get('settings','search');let hasKey=false;try{hasKey=!!vault?.get('search-key');}catch{}return{provider:PROVIDER,enabled:s?.enabled===true,hasKey};}
 function configure(input){if(closed)throw Error('工作区已关闭');if(typeof input.enabled!=='boolean')throw Error('请选择搜索连接状态');if(input.enabled&&input.confirmed!==true)throw Error('请确认搜索服务与供应商费用');if(input.apiKey){if(typeof input.apiKey!=='string'||input.apiKey.length>4096||/[\r\n]/.test(input.apiKey))throw Error('搜索密钥格式无效');if(!vault)throw Error('系统密钥存储不可用');vault.set('search-key',input.apiKey);}if(input.enabled&&!config().hasKey)throw Error('请先保存搜索 API Key');epoch++;active?.abort();if(input.clearKey===true){vault?.remove('search-key');input={...input,enabled:false};}store.put('settings',{id:'search',enabled:input.enabled,provider:'brave'},{expectedRevision:store.get('settings','search')?.revision||0});return config();}
 async function run(input,{signal}={}){
  if(signal?.aborted)throw Error('搜索已取消');
  if(closed)throw Error('工作区已关闭');if(input.confirmed!==true)throw Error('请确认发送关键词与供应商费用');const query=typeof input.query==='string'?input.query.trim():'';if(!query||query.length>200||query.split(/\s+/).length>50||/[\r\n\x00-\x1f]/.test(query))throw Error('请输入不超过 200 字符的单行关键词');if(typeof input.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(input.requestId))throw Error('搜索请求标识无效');
  const id=`search-${input.requestId}`,requestHash=createHash('sha256').update(query).digest('hex'),old=store.get('discoveryRuns',id);if(old){if(old.requestHash!==requestHash||old.kind!=='web_search')throw Error('搜索标识已用于其他关键词');if(cache.has(id))return cache.get(id);throw Error('此请求已执行或结果不明；再次搜索须重新确认，可能再次计费');}
  const settings=config();if(!settings.enabled||!settings.hasKey)throw Error('请先配置并开启搜索连接');if(active)throw Error('已有搜索正在执行');const recent=store.list('discoveryRuns').filter(r=>r.kind==='web_search'&&r.startedAt>clock()-86400000);if(recent.length>=20)throw Error('当前工作区已达到 24 小时 20 次搜索上限');
  const controller=new AbortController(),captured=epoch;active=controller;const onAbort=()=>controller.abort();signal?.addEventListener('abort',onAbort,{once:true});put({id,kind:'web_search',provider:'brave',requestHash,status:'running',startedAt:clock(),coverage:'one_query_first_page'});
  try{const url=new URL(ENDPOINT);url.searchParams.set('q',query);url.searchParams.set('count','10');url.searchParams.set('text_decorations','false');url.searchParams.set('safesearch','moderate');const response=await fetchImpl(url.href,{headers:{Accept:'application/json','X-Subscription-Token':vault.get('search-key')},redirect:'error',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});if(!response.ok)throw Error('搜索服务返回错误，请核对密钥、额度或稍后重试');let size=0;const chunks=[];for await(const chunk of response.body){size+=chunk.length;if(size>1024*1024)throw Error('搜索响应过大');chunks.push(Buffer.from(chunk));}if(closed||captured!==epoch||controller.signal.aborted)throw Error('搜索已取消');const data=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(data.web?.results!==undefined&&!Array.isArray(data.web.results))throw Error('搜索响应结构无效');
   const results=[],seen=new Set();for(const item of (data.web?.results||[]).slice(0,10)){if(!item||typeof item.title!=='string'||typeof item.url!=='string')continue;let url;try{url=publicUrl(item.url).href;}catch{continue;}if(url.length>2000||seen.has(url))continue;seen.add(url);results.push({title:item.title.slice(0,300),url,description:typeof item.description==='string'?item.description.slice(0,1000):''});}
   const result={id,provider:PROVIDER,query,capturedAt:new Date(clock()).toISOString(),results,coverage:'one_query_first_page'};cache.set(id,result);while(cache.size>30)cache.delete(cache.keys().next().value);put({...store.get('discoveryRuns',id),status:'ready',completedAt:clock(),resultCount:results.length});return result;
  }catch(error){if(!closed)put({...store.get('discoveryRuns',id),status:controller.signal.aborted?'cancelled':'failed',completedAt:clock(),error:'搜索未完成，供应商可能已计费；请检查连接后重新确认'});throw Error(controller.signal.aborted?'搜索已取消；供应商可能已计费':'搜索未完成，请检查连接；供应商可能已计费');}finally{signal?.removeEventListener('abort',onAbort);if(active===controller)active=null;}
 }
 function cancel(){active?.abort();return{cancelled:!!active};}
 function close(){closed=true;epoch++;active?.abort();cache.clear();}
 return{config,configure,run,cancel,close};
}
module.exports={createSearch};
