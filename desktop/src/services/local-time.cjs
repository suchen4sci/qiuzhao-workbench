'use strict';
function dateAtHour(day,hour,zone){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day)||!Number.isInteger(hour)||hour<0||hour>23)throw Error('本地日期或小时无效');
 const [year,month,date]=day.split('-').map(Number),base=Date.UTC(year,month-1,date,hour);
 if(new Date(base).toISOString().slice(0,10)!==day)throw Error('日期无效');
 const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
 const parts=value=>Object.fromEntries(formatter.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 const local=value=>{const p=parts(value);return Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);};
 const offsets=new Set([-36,-24,0,24,36].map(h=>{const sample=base+h*3600000;return local(sample)-sample;}));
 const candidates=[...offsets].map(offset=>base-offset).filter(value=>local(value)===base).sort((a,b)=>a-b);
 if(candidates.length)return {at:new Date(candidates[0]).toISOString(),adjusted:false};
 // A nonexistent clock hour is moved forward to the next valid local minute, never to the previous day.
 for(let minutes=1;minutes<=180;minutes++){const desired=base+minutes*60000;for(const offset of offsets){const value=desired-offset;if(local(value)===desired)return {at:new Date(value).toISOString(),adjusted:true};}}
 throw Error('该时区的计划日期不存在，请调整安排');
}
module.exports={dateAtHour};
