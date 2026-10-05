'use strict';
const ID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v?v:'';
const text=(v,max=10000)=>typeof v==='string'?v.trim().slice(0,max):'';
function initialData(body){
 if(typeof body!=='string'||Buffer.byteLength(body)>1024*1024)throw Error('来源正文过大');
 const matches=[...body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].filter(m=>/window\.__INITIAL_DATA__\s*=/.test(m[1]));
 if(matches.length!==1)throw Error('百度页面结构已变化，请在官网人工核对');
 const source=matches[0][1],start=/window\.__INITIAL_DATA__\s*=\s*/.exec(source),tail=source.slice(start.index+start[0].length);
 // Parse only a bounded JSON-shaped object. Never evaluate the site's JavaScript.
 let depth=0,quoted=false,escaped=false,end=-1;
 if(tail[0]!=='{')throw Error('百度页面数据格式已变化');
 for(let i=0;i<tail.length;i++){const c=tail[i];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue;}if(c==='"'){quoted=true;continue;}if(c==='{')depth++;else if(c==='}'&&--depth===0){end=i+1;break;}}
 if(end<0)throw Error('百度页面数据不完整');
 if(/window\.__INITIAL_DATA__\s*=/.test(tail.slice(end)))throw Error('百度页面包含多个初始数据赋值，请人工核对');
 // The observed public SSR serializer emits bare undefined for absent values.
 // Replace that one token outside strings; JSON.parse rejects executable syntax.
 const json=tail.slice(0,end).replace(/"(?:\\.|[^"\\])*"|\bundefined\b/g,value=>value==='undefined'?'null':value);
 try{return JSON.parse(json);}catch{throw Error('百度页面数据不能安全解析，请人工核对');}
}
function extractBaidu(body,value){
 const url=new URL(value);if(url.protocol!=='https:'||url.hostname!=='talent.baidu.com'||url.port||url.username||url.password)return null;
 const detail=/^\/jobs\/detail\/(GRADUATE|INTERN)\/([a-f0-9-]{36})\/?$/i.exec(url.pathname),list=/^\/jobs\/list\/?$/.test(url.pathname);
 if(!detail&&!list)return null;
 const data=initialData(body);let posts,type,coverage;
 if(detail){const d=data.detailData;if(!d||!d.postInfo||typeof d.postInfo.postId!=='string'||d.postInfo.postId.toLowerCase()!==detail[2].toLowerCase()||d.recruitType!==detail[1].toUpperCase())throw Error('岗位编号或招聘类型与原文链接不一致，请人工核对');posts=[d.postInfo];type=d.recruitType;coverage={mode:'official_detail',pages:1,paginationComplete:false,validityReported:typeof d.isValid==='boolean'?d.isValid:null};}
 else {const d=data.listData;if(!d||!['GRADUATE','INTERN'].includes(d.recruitType)||!Array.isArray(d.listDetailData)||d.listDetailData.length>100||!Number.isInteger(d.pageNum)||d.pageNum<1||!Number.isInteger(d.pageSize)||d.pageSize<1||d.pageSize>100||!Number.isInteger(d.total)||d.total<0||d.listDetailData.length>d.pageSize||d.listDetailData.length>d.total)throw Error('百度列表结构或分页信息已变化，请人工核对');const requestedType=url.searchParams.get('recruitType');if(requestedType&&requestedType!==d.recruitType)throw Error('列表招聘类型与链接不一致，请人工核对');posts=d.listDetailData;type=d.recruitType;coverage={mode:'official_list_page',pages:1,page:d.pageNum,pageSize:d.pageSize,reportedTotal:d.total,paginationComplete:false};}
 const seen=new Set(),jobs=[];
 for(const p of posts){if(!p||typeof p.postId!=='string'||!ID.test(p.postId)||!text(p.name,200))throw Error('百度岗位缺少可靠编号或标题，请人工核对');if(seen.has(p.postId.toLowerCase()))throw Error('百度列表包含重复编号，请人工核对');seen.add(p.postId.toLowerCase());
  const sourcePublishedOn=date(p.publishDate),sourceUpdatedOn=date(p.updateDate),jobUrl=`https://talent.baidu.com/jobs/detail/${type}/${p.postId}`;
  const evidenceFacts={provider:'baidu-ssr-v1',recruitType:type,pageValidityReported:detail?coverage.validityReported:null,project:text(p.projectType,120),sourcePublishedOn,sourceUpdatedOn,qualificationText:text(p.serviceCondition),direction:text(p.postType,120),openStatus:'unknown',reason:'官网公开字段已读取；发布日期、更新时间和页面有效标记不等于已核验开放或资格'};
  jobs.push({title:text(p.name,200),company:'百度',externalId:p.postId.toLowerCase(),url:jobUrl,city:[...new Set(text(p.workPlace,5000).split(/[,，、]/).map(v=>v.trim()).filter(Boolean))].sort().slice(0,40),description:[text(p.workContent),text(p.serviceCondition)].filter(Boolean).join('\n\n').slice(0,20000),openedOn:'',deadline:'',employmentType:type==='INTERN'?'实习':'校园招聘',evidenceFacts});
 }
 return{adapter:'baidu-ssr-v1',jobs,coverage};
}
module.exports={initialData,extractBaidu};
