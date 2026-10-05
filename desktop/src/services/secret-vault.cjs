'use strict';
const fs=require('node:fs'),path=require('node:path');
const {atomicWrite}=require('./profile-service.cjs');
function createSecretVault(directory,storage){
 const file=path.join(directory,'connection-secrets.json');
 function read(){return fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{};}
 function get(id){const value=read()[id];if(!value)return '';try{return storage.decryptString(Buffer.from(value,'base64'));}catch{throw Error('连接密钥无法解密，请重新保存授权码');}}
 function set(id,value){if(typeof value!=='string'||value.length>4096||/[\r\n]/.test(value))throw Error('授权码格式无效');if(!storage.isEncryptionAvailable()||storage.getSelectedStorageBackend?.()==='basic_text')throw Error('系统钥匙串不可用，未保存授权码');const data=read();data[id]=storage.encryptString(value).toString('base64');atomicWrite(file,JSON.stringify(data));}
 function remove(id){const data=read();delete data[id];atomicWrite(file,JSON.stringify(data));}
 return{get,set,remove};
}
module.exports={createSecretVault};
