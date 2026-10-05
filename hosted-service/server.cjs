'use strict';
const fs=require('node:fs'),path=require('node:path');
const {validateSettings}=require('../desktop/src/ai-settings.cjs');
const {openDatabase}=require('./store.cjs'),{createAccounts}=require('./accounts.cjs'),{createJobs}=require('./jobs.cjs'),{createPayments}=require('./payments.cjs'),{createHTTP}=require('./http.cjs'),{validatePayload,validateResult,createProcessor}=require('./processors.cjs');
function lock(directory){fs.mkdirSync(directory,{recursive:true,mode:0o700});const filename=path.join(directory,'service.lock');if(fs.existsSync(filename)){const pid=Number(fs.readFileSync(filename,'utf8'));if(!Number.isInteger(pid)||pid<1)throw Error('服务锁损坏，请确认没有运行实例后清理');try{process.kill(pid,0);throw Error('此数据库已有运行实例');}catch(e){if(e.code!=='ESRCH')throw e;}fs.unlinkSync(filename);}const fd=fs.openSync(filename,'wx',0o600);fs.writeFileSync(fd,String(process.pid));fs.closeSync(fd);return()=>{if(fs.readFileSync(filename,'utf8')===String(process.pid))fs.unlinkSync(filename);};}
function startService(options={}){
 const directory=options.directory||path.join(__dirname,'.runtime'),unlock=lock(directory);let db;
 try{
  if(options.payments?.live&&options.liveAccepted!==true)throw Error('真实支付需运营方明确完成上线验收');
  const model=validateSettings(options.model||{});if(options.payments?.live&&(!model.enabled||!options.model?.apiKey))throw Error('真实支付需要已配置的模型服务');
  db=openDatabase(directory);const prices=options.prices||{};for(const[k,v]of Object.entries(prices))if(!['briefing','field-suggestions','field-mapping','field-correction','mail-parse'].includes(k)||!Number.isSafeInteger(v)||v<1||v>100000)throw Error('服务定价配置无效');
  const accounts=createAccounts(db,{invite:options.invite}),jobs=createJobs(db,{prices,validatePayload,validateResult,processJob:options.processJob||createProcessor(options.model||{})}),payments=createPayments(db,options.payments||{});
  if(payments.catalog().enabled&&!Object.keys(prices).length)throw Error('开放支付前必须配置可交付服务与额度价格');
  const monitoring=require('./monitoring.cjs').createMonitoring(db,{...options.monitoring,enabled:options.monitoringEnabled===true});
  const server=createHTTP({accounts,jobs,payments,db,prices,monitoring});let closing;
  return{server,db,accounts,jobs,payments,monitoring,close(){if(!closing){jobs.close();monitoring.close();closing=new Promise(resolve=>{server.close(()=>{db.close();unlock();resolve();});server.closeIdleConnections();});}return closing;}};
 }catch(error){db?.close();unlock();throw error;}
}
if(require.main===module){
 try{
  const model={enabled:!!process.env.MODEL_BASE_URL,baseUrl:process.env.MODEL_BASE_URL||'',model:process.env.MODEL_NAME||'',apiKey:process.env.MODEL_API_KEY||''},prices=JSON.parse(process.env.SERVICE_PRICES||'{}');
  if(Object.keys(prices).length&&!model.enabled)throw Error('启用收费服务前请配置模型');
  const service=startService({monitoringEnabled:process.env.CLOUD_MONITORING_ENABLED==='true',liveAccepted:process.env.LIVE_LAUNCH_ACCEPTED==='true',directory:process.env.SERVICE_DATA,invite:process.env.REGISTRATION_INVITE,prices,model,payments:{secretKey:process.env.STRIPE_SECRET_KEY,webhookSecret:process.env.STRIPE_WEBHOOK_SECRET,packs:JSON.parse(process.env.CREDIT_PACKS||'[]'),successUrl:process.env.PAYMENT_SUCCESS_URL,cancelUrl:process.env.PAYMENT_CANCEL_URL,live:process.env.PAYMENTS_LIVE==='true'}});
  service.server.listen(Number(process.env.PORT||4318),process.env.HOST||'127.0.0.1',()=>console.log('招聘工作台服务已启动；支付模式：'+service.payments.catalog().mode));
  for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{service.close().then(()=>process.exit(0));});
 }catch(error){console.error(error.message);process.exitCode=1;}
}
module.exports={startService};
