const {safeUrl}=require('./dashboard-import.cjs');
const VENDOR=/^(?:Moka|北森|Beisen|智联招聘|前程无忧|猎聘|问卷星|腾讯招聘|招聘官网|校园招聘|人才招聘|个人中心|首页)$/i;
function clean(value){return String(value||'').replace(/^[\s©®|丨\-–—]+|[\s|丨\-–—]+$/g,'').trim();}
function validCompany(value){return value.length>=2&&value.length<=120&&!VENDOR.test(value)&&!/[<>\n]/.test(value)&&!/^202\d(?:年|届)?(?:校园|校招)/.test(value);}
function parseContext({title='',text='',headings=[],url,organizations=[],siteNames=[],brands=[],companyIntroduction=false}){
 const candidates=[];const add=(name,source,score)=>{name=clean(name);if(validCompany(name))candidates.push({name,source,score});};
 for(const org of organizations)if(org?.name)add(org.name,org.source||'页面结构化公司信息',org.hiring?110:90);
 for(const rawLine of text.split('\n')){const line=rawLine.trim();
  const copyright=line.match(/(?:©|Copyright\s*(?:©|\(c\))?)\s*(?:\d{4}(?:\s*[-–]\s*\d{4})?)?\s*([^©\n]{2,150})/i);
  if(copyright){let name=copyright[1].split(/\s*(?:京ICP备|[\u4e00-\u9fff]ICP备|京公网|版权所有|All\s+Rights|招聘网站)/i)[0].trim();const full=name.match(/^(.{2,100}?(?:股份有限公司|有限责任公司|有限公司|研究院|研究所|实验室|大学))/);if(full)name=full[1];add(name,'当前页面版权页脚',100);}
  const named=line.match(/^(?:公司名称|企业名称|招聘单位|用人单位)\s*[:：]\s*(.{2,120})$/);if(named)add(named[1],'页面明确标注公司名称',105);
  const intro=line.match(/^([\u4e00-\u9fff][\u4e00-\u9fffA-Za-z（）()·\s]{1,80}?(?:股份有限公司|有限责任公司|有限公司|研究院|研究所|实验室))(?=[，,（(\s]|成立|创立|是|总部|专注|致力|$)/);if(intro&&companyIntroduction)add(intro[1],'公司介绍正文中的企业全称',95);
 }
 const companyTitle=title.match(/^(.{2,100}?)(?:[\s|丨\-–—]*202\d(?:年|届)?)?[\s|丨\-–—]*(?:校园招聘|人才招聘|招聘门户|招聘系统|招聘官网|招聘)$/);
 if(companyTitle)add(companyTitle[1],'招聘页标题',80);
 for(const name of brands)add(name,'页眉或标识文字',85);
 for(const name of siteNames)add(name.replace(/[\s|丨\-–—]*(?:校园招聘|招聘官网|人才招聘)$/,''),'页面站点元信息',70);
 const sorted=candidates.sort((a,b)=>b.score-a.score),best=sorted[0];
 const tied=best?sorted.filter(c=>c.score===best.score):[];
 const ambiguous=new Set(tied.map(c=>c.name)).size>1;
 const company=ambiguous?'':best?.name||'';
 let role='';const explicit=text.match(/(?:你正在投递职位|正在申请职位|申请职位|应聘职位|投递岗位)\s*[:：]\s*([^\n]{2,100})/);if(explicit)role=explicit[1].trim();
 const roles=[...new Set(headings.map(s=>s.trim()).filter(s=>/工程师|研究员|实习生|经理|博士后/.test(s)&&s.length<100))];
 if(!role&&roles.length===1&&!/全部职位|搜索职位/.test(text))role=roles[0];
 return {company,companySource:company?best.source:undefined,companyReason:ambiguous?'页面包含多个不同的公司名称，需要核对':company?'':'当前页未显示可识别的公司名称',role,title,url:safeUrl(url),origin:new URL(url).origin};
}
function snapshot(){
 const visible=e=>!!e.getClientRects().length;
 const organizations=[];
 function visit(value){if(Array.isArray(value)){value.forEach(visit);return;}if(!value||typeof value!=='object')return;
  if(value.hiringOrganization){for(const o of [].concat(value.hiringOrganization))if(o?.name)organizations.push({name:o.name,hiring:true,source:'JobPosting招聘单位'});}
  if([].concat(value['@type']||[]).some(t=>['Organization','Corporation','EducationalOrganization'].includes(t))&&value.name)organizations.push({name:value.name});
  if(value['@graph'])visit(value['@graph']);
 }
 for(const el of document.querySelectorAll('script[type="application/ld+json"]'))try{visit(JSON.parse(el.textContent));}catch{}
 return {title:document.title,text:document.body?.innerText||'',headings:[...document.querySelectorAll('h1,h2,h3,[class*="job-info-"] > [class*="title-"]')].filter(visible).map(e=>e.textContent),url:location.href,organizations,
 siteNames:[...document.querySelectorAll('meta[property="og:site_name"],meta[name="application-name"]')].map(e=>e.content),
 brands:[...document.querySelectorAll('header img,[class*=logo] img,[id*=logo] img,[class*=company-name],[class*=companyName]')].filter(visible).flatMap(e=>e.tagName==='IMG'?[e.alt,e.title]:[e.textContent.trim()]).filter(Boolean),
 infoLinks:[...document.querySelectorAll('a[href]')].filter(visible).filter(e=>/^(?:公司介绍|关于我们|关于公司|公司官网|企业官网|官网)$/.test(e.textContent.trim())).map(e=>({text:e.textContent.trim(),url:e.href})),
 hasCompanyIntro:[...document.querySelectorAll('a,button,[role="button"]')].filter(visible).some(e=>/^(?:公司介绍|关于我们|关于公司)$/.test(e.textContent.trim()))};
}
// Cache keys include ATS tenant path. Shared Moka domains host many different employers.
function tenantKey(raw){const u=new URL(raw);const m=u.pathname.match(/^\/(?:campus-recruitment|social-recruitment)\/[^/]+\/[^/]+/);const tenant=['keyName','companyId','tenantId','orgId','cid'].map(k=>u.searchParams.has(k)?k+'='+u.searchParams.get(k):'').filter(Boolean).join('&');return u.origin+(m?m[0]:'')+(tenant?'?'+tenant:'');}
const recent=new Map();
async function readContext(page){
 let info=await page.evaluate(snapshot),draft=parseContext(info);const key=tenantKey(page.url()),prior=recent.get(key);
 if(draft.companyReason?.includes('多个'))return draft;
 if(!draft.company&&!prior?.company){
  try{
   const linked=info.infoLinks.find(link=>{const u=new URL(link.url);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&(u.origin===draft.origin||/^(公司官网|企业官网|官网)$/.test(link.text));});
   if(linked||info.hasCompanyIntro){const next=await require('./company-reader.cjs').readBackground({url:linked?.url||page.url(),clickIntro:!linked});if(next?.company){draft.company=next.company;draft.companySource='同站公司介绍：'+next.companySource;}}
  }catch{draft.companyReason='当前页与同站公司介绍暂未读取到可靠名称';}
 }
 if(!draft.company&&prior?.company){draft.company=prior.company;draft.companySource='同一招聘站点已核验公司名称';}
 const roleUrl=new URL(page.url()),roleKey=roleUrl.pathname+roleUrl.hash+['jId','jid','jobId','jobAdId'].map(k=>roleUrl.searchParams.get(k)||'').join('|');
 if(!draft.role&&prior?.role&&prior.roleKey===roleKey){draft.role=prior.role;draft.roleSource='当前站点最近一次明确显示的岗位，请核对';}
 if(draft.company)draft.companyReason=undefined;
 if(draft.company||draft.role)recent.set(key,{...prior,...draft,roleKey});
 return draft;
}
module.exports={parseContext,readContext,snapshot,tenantKey};

