function parseMailApplication(raw){
 const u=new URL(raw);
 if(u.protocol!=='mailto:')throw Error('仅支持招聘邮件链接');
 const recipients=decodeURIComponent(u.pathname);
 if(!recipients||/[\r\n\x00]/.test(recipients)||!recipients.split(',').every(s=>/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(s)))throw Error('招聘邮箱地址无效');
 const subject=u.searchParams.get('subject')||'',body=u.searchParams.get('body')||'';
 if(/[\r\n\x00]/.test(subject))throw Error('邮件主题格式无效');
 return {href:u.href,recipients,subject,body};
}
module.exports={parseMailApplication};
