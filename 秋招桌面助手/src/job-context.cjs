const {safeUrl}=require('./dashboard-import.cjs');
function parseContext({title='',text='',headings=[],url}){
  let company='';
  const footer=text.match(/©\s*\d{4}\s*([^\n©]{2,100}?)招聘网站/);
  if(footer)company=footer[1].trim();
  if(!company){const m=title.match(/^(.{2,80}?)(?:202\d届)?(?:校园招聘|人才招聘|招聘门户|招聘系统|招聘官网|招聘)$/);if(m&&!/^(校招职位|个人简历|职位详情|首页)$/.test(m[1]))company=m[1].trim();}
  let role='';const explicit=text.match(/(?:你正在投递职位|正在申请职位|应聘职位|投递岗位)\s*[:：]\s*([^\n]{2,100})/);if(explicit)role=explicit[1].trim();
  const candidates=[...new Set(headings.map(s=>s.trim()).filter(s=>/工程师|研究员|实习生|经理|博士后/.test(s)&&s.length<100))];
  if(!role&&candidates.length===1&&!/全部职位|搜索职位/.test(text))role=candidates[0];
  return {company,role,title,url:safeUrl(url),origin:new URL(url).origin};
}
const recent=new Map();
async function readContext(page){const draft=parseContext(await page.evaluate(()=>({title:document.title,text:document.body.innerText,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent),url:location.href})));const prior=recent.get(draft.origin);if(draft.role)recent.set(draft.origin,draft);else if(prior){draft.role=prior.role;draft.roleSource='当前站点最近一次明确显示的岗位，请核对';}return draft;}
module.exports={parseContext,readContext};
