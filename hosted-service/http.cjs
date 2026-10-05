'use strict';
const http=require('node:http');
function createHTTP({accounts,jobs,payments,db,prices,monitoring,clock=Date.now}){
 const limits=new Map();
 function rate(key,max,window=60000){const now=clock();let item=limits.get(key);if(!item||now-item.at>window){item={at:now,n:0};limits.set(key,item);}if(++item.n>max)throw Error('请求过于频繁，请稍后重试');if(limits.size>10000)for(const[k,v]of limits)if(now-v.at>60000)limits.delete(k);if(limits.size>10000)throw Error('服务繁忙');}
 const server=http.createServer(async(req,res)=>{
  res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const send=(code,value)=>{res.statusCode=code;res.end(JSON.stringify(value));};
  try{
   const url=new URL(req.url,'http://service.invalid'),ip=req.socket.remoteAddress||'unknown';rate(ip,120);
   if(req.method==='GET'&&url.pathname==='/health')return send(200,{ok:true});
   if(req.headers.origin)throw Error('此接口仅接受原生客户端请求');
   let raw=Buffer.alloc(0);if(['POST','PUT'].includes(req.method)){if(Number(req.headers['content-length'])>1048576)throw Error('请求正文过大');for await(const chunk of req){if(raw.length+chunk.length>1048576)throw Error('请求正文过大');raw=Buffer.concat([raw,chunk]);}}
   if(req.method==='POST'&&url.pathname==='/webhooks/stripe')return send(200,payments.webhook(raw,req.headers['stripe-signature']));
   let data={};if(raw.length){if(!String(req.headers['content-type']).startsWith('application/json'))throw Error('需要 JSON 请求');data=JSON.parse(raw.toString('utf8'));}
   if(req.method==='POST'&&['/auth/register','/auth/login'].includes(url.pathname)){rate('auth:'+ip,10);return send(200,await(url.pathname.endsWith('register')?accounts.register(data):accounts.login(data)));}
   const token=/^Bearer ([A-Za-z0-9_-]+)$/.exec(req.headers.authorization||'')?.[1],accountId=accounts.authenticate(token);rate(accountId,100);
   if(req.method==='POST'&&url.pathname==='/auth/logout')return send(200,accounts.logout(token));
   if(req.method==='GET'&&url.pathname==='/account')return send(200,{account:accounts.account(accountId),catalog:payments.catalog(),prices,ledger:db.all('SELECT kind,reference,balance_delta,reserved_delta,created_at FROM ledger WHERE account_id=? ORDER BY rowid DESC LIMIT 200',accountId),jobs:db.all('SELECT id,request_id,kind,units,status,error,created_at,updated_at FROM jobs WHERE account_id=? ORDER BY rowid DESC LIMIT 100',accountId)});
   if(monitoring&&req.method==='GET'&&url.pathname==='/monitoring')return send(200,monitoring.list(accountId));
   if(monitoring&&req.method==='POST'&&['add','update','remove','read'].some(a=>url.pathname==='/monitoring/'+a))return send(200,monitoring[url.pathname.split('/')[2]](accountId,data));
   if(req.method==='POST'&&url.pathname==='/quotes')return send(200,jobs.quote(accountId,data));
   if(req.method==='POST'&&url.pathname==='/jobs')return send(202,jobs.start(accountId,data));
   const match=/^\/jobs\/([a-f0-9-]{36})(\/cancel)?$/.exec(url.pathname);
   if(match&&req.method==='GET'&&!match[2])return send(200,jobs.read(accountId,match[1]));
   if(match&&req.method==='POST'&&match[2])return send(200,jobs.cancel(accountId,match[1]));
   if(req.method==='POST'&&url.pathname==='/checkout')return send(200,await payments.checkout(accountId,data));
   send(404,{error:'接口不存在'});
  }catch(error){send(400,{error:/SQLITE|constraint|JSON|Unexpected|fetch|network|ENOTFOUND|ECONN|SyntaxError/i.test(error.message)?'请求无法处理，请检查输入或稍后重试':String(error.message).slice(0,300)});}
 });
 server.requestTimeout=30000;server.headersTimeout=15000;server.keepAliveTimeout=5000;return server;
}
module.exports={createHTTP};
