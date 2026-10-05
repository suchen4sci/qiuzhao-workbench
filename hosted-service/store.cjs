'use strict';
const {DatabaseSync}=require('node:sqlite');
const fs=require('node:fs'),path=require('node:path');
function openDatabase(directory){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});const db=new DatabaseSync(path.join(directory,'service.sqlite'));db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
 db.exec(`CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,salt TEXT NOT NULL,frozen INTEGER NOT NULL DEFAULT 0 CHECK(frozen IN (0,1)),balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0),reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved>=0 AND reserved<=balance),created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,units INTEGER NOT NULL CHECK(units>0),payload_hash TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),request_id TEXT NOT NULL,quote_id TEXT NOT NULL REFERENCES quotes(id),kind TEXT NOT NULL,units INTEGER NOT NULL,status TEXT NOT NULL,payload_hash TEXT NOT NULL,result TEXT,error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(account_id,request_id));
 CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),kind TEXT NOT NULL,reference TEXT NOT NULL,balance_delta INTEGER NOT NULL,reserved_delta INTEGER NOT NULL,created_at TEXT NOT NULL,UNIQUE(account_id,kind,reference));
 CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,account_id TEXT NOT NULL REFERENCES accounts(id),request_id TEXT NOT NULL,pack_id TEXT NOT NULL,units INTEGER NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,session_id TEXT,payment_intent TEXT,url TEXT,created_at TEXT NOT NULL,UNIQUE(account_id,request_id));`);
 for(const [table,column,definition]of [['accounts','frozen','INTEGER NOT NULL DEFAULT 0'],['orders','payment_intent','TEXT']])if(!db.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===column))db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
 db.exec(`CREATE TABLE IF NOT EXISTS payment_alerts(id TEXT PRIMARY KEY,event_type TEXT NOT NULL,account_id TEXT,order_id TEXT,payment_intent TEXT,status TEXT NOT NULL,created_at TEXT NOT NULL);`);
 if(!db.prepare('PRAGMA table_info(payment_alerts)').all().some(c=>c.name==='payment_intent'))db.exec('ALTER TABLE payment_alerts ADD COLUMN payment_intent TEXT');
 const get=(sql,...args)=>db.prepare(sql).get(...args),all=(sql,...args)=>db.prepare(sql).all(...args),run=(sql,...args)=>db.prepare(sql).run(...args);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const result=fn();if(result?.then)throw Error('事务不接受异步操作');db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}};
 return{db,get,all,run,transaction,close:()=>db.close()};
}
module.exports={openDatabase};
