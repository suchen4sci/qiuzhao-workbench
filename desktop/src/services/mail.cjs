'use strict';
const fs=require('node:fs'),path=require('node:path'),{createHash}=require('node:crypto');
const {simpleParser}=require('mailparser'),{ImapFlow}=require('imapflow');
const {atomicWrite}=require('./profile-service.cjs'),{timestamp}=require('./workflow.cjs'),{proposeMail}=require('./mail-rules.cjs');
const {linkMail,automaticUpdate,associateApplication}=require('./mail-linkage.cjs');
const MAX_MESSAGE=2*1024*1024;
const hash=value=>createHash('sha256').update(value).digest('hex');
function createMail(store,workflow,{vault,clientFactory=options=>new ImapFlow(options),clock=()=>new Date()}={}){
 let closed=false;const active=new Map(),stopped=new Set();
 const update=(collection,old,patch)=>store.put(collection,{...old,...patch},{expectedRevision:old.revision});
 function get(id){const connection=store.get('connections',id);if(!connection||connection.kind!=='imap')throw Error('邮箱连接不存在');return connection;}
 function configure(input){
  const host=String(input.host||'').trim().toLowerCase(),address=String(input.address||'').trim().toLowerCase(),folder=String(input.folder||'INBOX').trim();
  if(!/^[a-z0-9](?:[a-z0-9.-]{0,251}[a-z0-9])?$/.test(host)||!host.includes('.')||!/^\S+@\S+\.\S+$/.test(address)||address.length>254||!folder||folder.length>200||/[\r\n\0]/.test(folder))throw Error('邮箱地址、服务器或文件夹无效');
  if(input.consent!==true)throw Error('请确认只读同步范围');
  const days=Number(input.lookbackDays??14);if(!Number.isInteger(days)||days<1||days>365)throw Error('首次回查范围为 1 至 365 天');
  const keywords=Array.isArray(input.keywords)?input.keywords:[];if(!keywords.length||keywords.length>30||keywords.some(k=>typeof k!=='string'||!k.trim()||k.length>50))throw Error('请填写 1 至 30 个标题关键词');
  const senders=(input.senderAddresses||[]).map(value=>String(value).trim().toLowerCase());if(senders.length>30||senders.some(value=>!/^\S+@\S+\.\S+$/.test(value)))throw Error('自动处理规则需要完整发件邮箱地址');if((input.autoCreate===true||input.autoUpdate===true)&&!senders.length)throw Error('自动处理前请明确填写匹配的发件邮箱地址');
  const id='mail-'+hash(address+'\0'+host+'\0'+folder).slice(0,32),old=store.get('connections',id);if(active.has(id))throw Error('同步中，请先停止');
  if(!vault)throw Error('系统密钥服务不可用');
  if(input.password)vault.set(id,input.password);else if(!vault.get(id))throw Error('请输入邮箱授权码');
  const same=old&&old.lookbackDays===days&&JSON.stringify(old.keywords)===JSON.stringify(keywords);
  const entry={...old,id,kind:'imap',provider:'imap',host,address,folder,port:993,secure:true,enabled:input.enabled===true,lookbackDays:days,keywords,consentAt:clock().toISOString(),status:'configured',credentialsMissing:false,autoCreate:input.autoCreate===true,autoUpdate:input.autoUpdate===true,senderAddresses:senders,sinceAt:same?old.sinceAt:new Date(clock().getTime()-days*86400000).toISOString(),cursor:same?old.cursor||0:0,uidValidity:same?old.uidValidity||'':''};
  return old?update('connections',old,entry):store.put('connections',entry);
 }
 async function ingest(source,metadata={}){
  if(closed)throw Error('邮箱服务已关闭');if(!Buffer.isBuffer(source)||source.length>MAX_MESSAGE)throw Error('邮件超过 2 MB，请在邮箱中核对');
  const parsed=await simpleParser(source,{skipHtmlToText:false,skipTextToHtml:true,skipImageLinks:true,maxHtmlLengthToParse:200000});if(closed)throw Error('邮箱服务已关闭');metadata.assertActive?.();
  const subject=String(parsed.subject||'无主题').slice(0,500),text=String(parsed.text||'').slice(0,200000),from=(parsed.from?.value||[]).map(a=>a.address||'').slice(0,10).join(',');
  const rawHash=hash(source),messageId=String(parsed.messageId||'').slice(0,1000),id='message-'+hash([metadata.address||'local',messageId||rawHash,subject,from,text,hash(String(parsed.html||'')),JSON.stringify((parsed.attachments||[]).map(a=>[a.filename,a.checksum,a.size]))].join('\0'));
  const old=store.get('messages',id);if(old)return {message:old,duplicate:true};
  const filename=path.join(store.directory,'messages',rawHash+'.eml');atomicWrite(filename,source);
  return store.transaction(()=>{
   const message=store.put('messages',{id,connectionId:metadata.connectionId||'',uid:metadata.uid||null,uidValidity:metadata.uidValidity||'',messageId,subject,text,from,sentAt:parsed.date&&Number.isFinite(parsed.date.getTime())?parsed.date.toISOString():'',receivedAt:metadata.receivedAt?timestamp(metadata.receivedAt):'',receivedAtSource:metadata.receivedAt?'mail_server':'unknown',importedAt:clock().toISOString(),rawHash,attachments:(parsed.attachments||[]).map(a=>({name:a.filename||'附件',type:a.contentType,size:a.size})),references:[...[parsed.inReplyTo||''],...(Array.isArray(parsed.references)?parsed.references:[])].filter(Boolean),status:'parsed',readAt:null,source:metadata.connectionId?'imap':'eml_import'});
   const proposal=proposeMail(message,store.list('organizations'));
   const association=associateApplication(message,proposal,store);proposal.applicationMatch=association;
   if(association.status==='matched'){proposal.applicationId=association.applicationId;proposal.planId=association.planId;}
   const associationSafe=['matched','unlinked'].includes(association.status);
   const linkage=linkMail(message,proposal,store);
   proposal.eventId=linkage.eventId;proposal.linkReason=linkage.reason;
   const confirmation=store.put('confirmations',{id:'confirm-'+id,kind:'mail_event',messageId:id,status:'pending',proposal});
   const connection=metadata.connectionId?get(metadata.connectionId):null;
   if(associationSafe&&connection?.autoCreate&&connection.senderAddresses?.includes(from.toLowerCase())&&proposal.confidence==='structured'&&proposal.action==='create'&&!linkage.eventId&&!(message.references||[]).length){
    const event=workflow.event({...proposal});
    update('events',event,{source:'mail_user_configured_rule',history:event.history.map((h,i,all)=>i===all.length-1?{...h,source:'mail_user_configured_rule',evidenceId:id}:h),messageIds:[id],sourceEvidence:message.subject});
    update('confirmations',confirmation,{status:'accepted',eventId:event.id,acceptedAt:clock().toISOString(),method:'user_configured_rule'});
   }
   if(associationSafe&&connection?.autoUpdate&&connection.senderAddresses?.includes(from.toLowerCase())&&proposal.structuredUpdate&&linkage.eventId){
    const target=store.get('events',linkage.eventId),reason=automaticUpdate(message,proposal,target,store);
    if(reason)update('confirmations',confirmation,{proposal:{...proposal,linkReason:reason}});
    else{
     if(proposal.action==='cancel'){
      const task=store.get('tasks','task-event-'+target.id);workflow.taskStatus({id:task.id,revision:task.revision,status:'cancelled'});
     }else{
      const patch={};for(const key of ['startsAt','deadline','offerReplyDeadline'])if(proposal[key])patch[key]=proposal[key];
      if(target.type==='offer')patch.deadline='';
      workflow.event({...target,...patch});
     }
     const current=store.get('events',target.id);
     update('events',current,{source:'mail_user_configured_rule',history:current.history.map((h,i,all)=>i===all.length-1?{...h,source:'mail_user_configured_rule',evidenceId:id}:h),messageIds:[...new Set([...(current.messageIds||[]),id])],sourceEvidence:message.subject});
     update('confirmations',confirmation,{status:'accepted',eventId:target.id,acceptedAt:clock().toISOString(),method:'user_configured_update'});
    }
   }
   return {message,duplicate:false};
  });
 }
 async function sync(id){
  if(closed)throw Error('邮箱服务已关闭');if(active.has(id))throw Error('邮箱正在同步');const connection=get(id);if(!connection.enabled)throw Error('请先开启只读同步');
  const password=vault?.get(id);if(!password)throw Error('授权码缺失，请重新连接');
  const client=clientFactory({host:connection.host,port:993,secure:true,auth:{user:connection.address,pass:password},logger:false,logRaw:false,disableAutoIdle:true,connectionTimeout:20000,greetingTimeout:15000,socketTimeout:30000,maxLiteralSize:MAX_MESSAGE+65536});
  client.on?.('error',()=>{});active.set(id,client);
  const run=store.put('syncRuns',{kind:'mail',connectionId:id,status:'running',startedAt:clock().toISOString(),checked:0,imported:0,skipped:0});let lock,checked=0,imported=0,skipped=0;
  const ensure=()=>{if(closed||stopped.has(id)||active.get(id)!==client)throw Error('邮箱同步已停止');};
  try{
   await client.connect();ensure();lock=await client.getMailboxLock(connection.folder,{readOnly:true});ensure();
   const validity=String(client.mailbox.uidValidity),cursor=validity===connection.uidValidity?connection.cursor||0:0;
   if(validity!==connection.uidValidity){const current=get(id);update('connections',current,{uidValidity:validity,cursor:0});}
   const found=await client.search({since:new Date(connection.sinceAt),uid:`${cursor+1}:*`},{uid:true});ensure();
   const uids=(found||[]).filter(uid=>Number.isSafeInteger(uid)&&uid>cursor).sort((a,b)=>a-b);if(uids.length>100000)throw Error('回查范围过大，请缩小范围');
   for(const uid of uids.slice(0,50)){
    const envelope=await client.fetchOne(uid,{envelope:true,size:true,internalDate:true},{uid:true});ensure();checked++;
    const subject=String(envelope?.envelope?.subject||'');
    if(envelope&&connection.keywords.some(word=>subject.toLowerCase().includes(word.toLowerCase()))){
     if(envelope.size>MAX_MESSAGE){skipped++;if(!store.get('confirmations',`oversize-${id}-${validity}-${uid}`))store.put('confirmations',{id:`oversize-${id}-${validity}-${uid}`,kind:'mail_oversize',status:'pending',subject,reason:'邮件超过 2 MB，未下载正文，请在邮箱核对'});}
     else{const fetched=await client.fetchOne(uid,{source:{maxLength:MAX_MESSAGE+1}},{uid:true});ensure();if(!fetched?.source)throw Error('邮件正文读取失败');const result=await ingest(fetched.source,{connectionId:id,address:connection.address,uid,uidValidity:validity,assertActive:ensure,receivedAt:envelope.internalDate?.toISOString()});ensure();if(!result.duplicate)imported++;}
    }else skipped++;
    const current=get(id);update('connections',current,{cursor:uid,uidValidity:validity});
   }
   const current=get(id);update('connections',current,{status:'connected',lastSuccessAt:clock().toISOString(),error:'',hasMore:uids.length>50,uidValidity:validity});
   update('syncRuns',run,{status:'completed',finishedAt:clock().toISOString(),checked,imported,skipped,hasMore:uids.length>50});return{checked,imported,skipped,hasMore:uids.length>50};
  }catch(error){if(!closed){const current=get(id);if(current.enabled)update('connections',current,{status:'error',error:'同步失败或已停止，请检查授权码、网络和服务器设置'});update('syncRuns',run,{status:'failed',finishedAt:clock().toISOString(),checked,imported,skipped});}throw Error('邮箱同步未完成，已保存的记录保留；请检查连接后重试');}
  finally{lock?.release();client.close();if(active.get(id)===client)active.delete(id);stopped.delete(id);}
 }
 function stop(id){const client=active.get(id);if(client)stopped.add(id);client?.close();return !!client;}
 function disconnect(id){stop(id);const current=get(id);vault?.remove(id);return update('connections',current,{enabled:false,status:'disconnected',credentialsMissing:true});}
 function message(id){const item=store.get('messages',id);if(!item)throw Error('邮件记录不存在');if(!item.readAt)return update('messages',item,{readAt:clock().toISOString()});return item;}
 function confirm(input){
  const item=store.get('confirmations',input.id);if(!item||item.kind!=='mail_event')throw Error('待确认记录无效');if(item.status!=='pending')return item;
  if(input.revision!==item.revision)throw Error('待确认内容已变化，请刷新');
  if(input.action==='create'&&input.eventId)throw Error('新建事件请清空既有事件选择');
  if(input.action==='reschedule'&&['cancelled','completed'].includes(store.get('events',input.eventId||'missing')?.status))throw Error('请先恢复既有事件，或另建新事件');
  if(!['ignore','create','reschedule','cancel'].includes(input.action))throw Error('请选择处理方式');
  if(['reschedule','cancel'].includes(input.action)){const existing=store.get('events',input.eventId||'missing');if(!existing||existing.revision!==input.eventRevision)throw Error('请选择并重新核对既有事件');}
  return store.transaction(()=>{
   if(input.action==='ignore')return update('confirmations',item,{status:'ignored'});
   const message=store.get('messages',item.messageId);let event;
   if(input.action==='cancel'){
    event=store.get('events',input.eventId);if(!event)throw Error('请选择要取消的既有事件');
    const task=store.get('tasks','task-event-'+event.id);if(task)workflow.taskStatus({id:task.id,revision:task.revision,status:'cancelled'});
   }else{
    const old=input.eventId?store.get('events',input.eventId):null;
    if(input.eventId&&!old)throw Error('原事件不存在');
    event=workflow.event({...old,...input.event,id:old?.id,revision:old?.revision});
   }
   const current=store.get('events',event.id);update('events',current,{source:'mail_user_confirmed',history:(current.history||[]).map((h,i,all)=>i===all.length-1?{...h,source:'mail_user_confirmed',evidenceId:message.id}:h),messageIds:[...new Set([...(current.messageIds||[]),message.id])],sourceEvidence:message.subject});
   return update('confirmations',item,{status:'accepted',eventId:event.id,acceptedAt:clock().toISOString()});
  });
 }
 function close(){closed=true;for(const client of active.values())client.close();active.clear();}
 return{configure,ingest,sync,stop,disconnect,message,confirm,close};
}
module.exports={createMail,MAX_MESSAGE};
