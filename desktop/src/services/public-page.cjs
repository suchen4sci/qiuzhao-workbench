'use strict';
const https=require('node:https'),dns=require('node:dns').promises,net=require('node:net');
function publicAddress(value){
  if(net.isIP(value)!==4)return false;
  const [a,b]=value.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&[0,168].includes(b)||a===100&&b>=64&&b<=127||a===198&&[18,19,51].includes(b)||a===203&&b===0);
}
function publicUrl(value){const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password||url.port&&url.port!=='443'||net.isIP(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.')||url.hostname.endsWith('.local'))throw Error('请输入公开网站的 HTTPS 链接');url.hash='';return url;}
function explicitWebLink(value){if(typeof value!=='string'||!value.trim()||value.length>8192)throw Error('请输入有效的网页链接');const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw Error('请输入不含账号密码的 HTTP 或 HTTPS 网页链接');return url.href;}
function publicLink(value){const url=explicitWebLink(value);publicUrl(url);return url;}
async function readPublicPage(value,{signal}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)controller.abort();
  try{
    let url=publicUrl(value);const origin=url.origin;
    for(let redirects=0;redirects<=3;redirects++){
      if(controller.signal.aborted)throw Error('读取已取消或超时');
      const records=await Promise.race([dns.lookup(url.hostname,{all:true,family:4}),new Promise((_,reject)=>controller.signal.addEventListener('abort',()=>reject(Error('读取已取消或超时')),{once:true}))]);
      if(!records.length||records.some(r=>!publicAddress(r.address)))throw Error('此链接未解析到允许读取的公网地址');
      const address=records[0].address;
      const result=await new Promise((resolve,reject)=>{
        const req=https.get(url,{signal:controller.signal,agent:false,lookup:(_host,options,cb)=>options.all?cb(null,[{address,family:4}]):cb(null,address,4),headers:{'User-Agent':'QiuzhaoWorkbench/0.1 (user-requested page preview)','Accept':'text/html,application/ld+json,application/json','Accept-Encoding':'identity'}},res=>{
          if([301,302,303,307,308].includes(res.statusCode)){res.resume();resolve({redirect:res.headers.location});return;}
          if(res.statusCode!==200){res.resume();reject(Error(`来源返回 HTTP ${res.statusCode}，请在浏览器中核验`));return;}
          if(!/^(text\/html|application\/(ld\+json|json|xhtml\+xml))(?:;|$)/i.test(res.headers['content-type']||'')){res.resume();reject(Error('来源不是受支持的网页或 JSON'));return;}
          if(res.headers['content-encoding']&&res.headers['content-encoding']!=='identity'){res.resume();reject(Error('来源返回了不支持的压缩格式'));return;}
          const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>1024*1024){res.destroy(Error('来源超过 1 MB，请手动摘录'));return;}chunks.push(chunk);});res.on('error',reject);res.on('end',()=>resolve({url:url.href,body:Buffer.concat(chunks).toString('utf8')}));
        });req.on('error',reject);
      });
      if(!('redirect' in result))return result;
      if(!result.redirect)throw Error('来源跳转缺少地址');
      url=publicUrl(new URL(result.redirect,url).href);if(url.origin!==origin)throw Error('来源跳转到另一个网站，请直接打开并核对目标链接');
    }
    throw Error('来源跳转次数过多');
  }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
module.exports={explicitWebLink,publicLink,publicAddress,publicUrl,readPublicPage};
