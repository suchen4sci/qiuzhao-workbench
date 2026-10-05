'use strict';
const {randomUUID,randomBytes,createHash,scrypt,timingSafeEqual}=require('node:crypto');
const {promisify}=require('node:util');const derive=promisify(scrypt);
const hash=value=>createHash('sha256').update(value).digest('hex');
function email(value){if(typeof value!=='string'||value.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(value.trim()))throw Error('邮箱格式无效');return value.trim().toLowerCase();}
function password(value){if(typeof value!=='string'||value.length<12||value.length>256)throw Error('密码需为 12 至 256 字符');return value;}
function equal(a,b){return typeof a==='string'&&typeof b==='string'&&timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)));}
function createAccounts(db,{invite,clock=Date.now,sessionDays=7}={}){
 async function register(input){if(!invite||!equal(input.invite,invite))throw Error('注册邀请码无效');const address=email(input.email),pass=password(input.password),salt=randomBytes(16).toString('hex'),derived=await derive(pass,salt,64);
  const id=randomUUID();try{db.run('INSERT INTO accounts(id,email,password,salt,created_at) VALUES(?,?,?,?,?)',id,address,derived.toString('hex'),salt,new Date(clock()).toISOString());}catch{throw Error('无法创建账号，请核对邮箱或联系运营方');}return{id,email:address};}
 async function login(input){const address=email(input.email),pass=password(input.password),account=db.get('SELECT * FROM accounts WHERE email=?',address);const derived=await derive(pass,account?.salt||'dummy-login-salt',64);if(!account||!timingSafeEqual(derived,Buffer.from(account.password,'hex')))throw Error('邮箱或密码不正确');const token=randomBytes(32).toString('base64url');db.run('INSERT INTO sessions(hash,account_id,expires) VALUES(?,?,?)',hash(token),account.id,clock()+sessionDays*86400000);return{token,expiresAt:clock()+sessionDays*86400000,account:{id:account.id,email:account.email}};}
 function authenticate(token){if(typeof token!=='string'||token.length>200)throw Error('请登录');const session=db.get('SELECT * FROM sessions WHERE hash=? AND expires>?',hash(token),clock());if(!session)throw Error('登录已过期，请重新登录');return session.account_id;}
 function logout(token){db.run('DELETE FROM sessions WHERE hash=?',hash(token));return{ok:true};}
 function account(id){const row=db.get('SELECT id,email,balance,reserved,frozen FROM accounts WHERE id=?',id);if(!row)throw Error('账号不存在');return{...row,available:row.balance-row.reserved};}
 return{register,login,authenticate,logout,account};
}
module.exports={createAccounts,hash,equal};
