'use strict';
// Server-host shell access is required. No unauthenticated public grant/refund endpoint.
const {openDatabase}=require('./store.cjs'),{createJobs}=require('./jobs.cjs');
const path=require('node:path');
const [action,email,value,reference]=process.argv.slice(2);
if(!['grant','refund'].includes(action)||!email||!value||(action==='grant'&&!reference)){console.error('用法：node admin.cjs grant 邮箱 整数额度 唯一操作编号 | refund 邮箱 任务ID');process.exitCode=1;}else{
 const db=openDatabase(process.env.SERVICE_DATA||path.join(__dirname,'.runtime'));
 try{const account=db.get('SELECT id FROM accounts WHERE email=?',email.trim().toLowerCase());if(!account)throw Error('账号不存在');const jobs=createJobs(db,{recover:false});if(action==='grant')jobs.grant(account.id,Number(value),reference);else jobs.refund(account.id,value);console.log('操作已记录，重复相同编号不会重复入账');}catch(e){console.error(e.message);process.exitCode=1;}finally{db.close();}
}
