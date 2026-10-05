'use strict';
const { openStore } = require('./store.cjs');
const { createProfileService } = require('./profile-service.cjs');
const { createAssets } = require('./assets.cjs');
const { createWorkflow } = require('./workflow.cjs');
function createWorkbench(workspace, { aiSettings, notify, vault, mailClientFactory, sourceReader, briefingInvoke, mailAIInvoke } = {}) {
  const store=openStore(workspace), facts=createProfileService(workspace), workflow=createWorkflow(store,facts), assets=createAssets(store);
  const onboarding=require('./onboarding.cjs').createOnboarding(store,facts,assets);
  const legacy=require('./legacy.cjs').createLegacy(store,workflow);
  const opportunityActions=require('./opportunity-actions.cjs').createOpportunityActions(store,workflow);
  const hosted=require('./hosted.cjs').createHosted(store,facts,{vault});
  const search=require('./search.cjs').createSearch(store,{vault});
  const briefings=require('./briefings.cjs').createBriefings(store,facts,aiSettings,{reader:sourceReader,invoke:briefingInvoke});
  const sources=require('./sources.cjs').createSources(store,workflow,{reader:sourceReader});
  const mail=require('./mail.cjs').createMail(store,workflow,{vault,clientFactory:mailClientFactory});
  const mailAI=require('./mail-ai.cjs').createMailAI(store,aiSettings,{invoke:mailAIInvoke,hostedConfig:hosted.config});
  const backup=require('./backup.cjs').createBackup(workspace,store,assets);
  const interviewMaterials=require('./interview-materials.cjs').createInterviewMaterials(store,{profileHash:()=>facts.read().hash});
  const qualifications=require('./qualifications.cjs').createQualifications(store);
  const discoverySearch=require('./discovery-search.cjs').createDiscoverySearch(store,search);
  const discovery=require('./discovery.cjs').createDiscovery(store);
  const opportunityDigest=require('./opportunity-digest.cjs').createOpportunityDigest(store,workflow.recommendations);
  const reminders=require('./reminders.cjs').createReminders(store,{notify,opportunityDigest});
  const resumeAI=aiSettings?require('./resume-ai.cjs').createResumeAI(store,facts,assets,aiSettings):null;
  function snapshot() {
    let profile=null, profileError='';
    try { profile=facts.read(); } catch { profileError='个人资料无法读取，请从设置中的历史版本恢复'; }
    return {onboarding:onboarding.status(),discoverySearch:discoverySearch.preview(),search:search.config(),hosted:hosted.config(),reminderSettings:reminders.settings(),reminders:store.list('reminders'),scheduler:store.get('settings','scheduler'),schemaVersion:store.schemaVersion,profile,profileError,profileStatus:facts.status(),history:facts.history(),
      organizations:store.list('organizations'),opportunities:profile?workflow.recommendations():store.list('opportunities'),
      plans:store.list('plans'),applications:store.list('applications'),events:store.list('events'),tasks:store.list('tasks'),
      activities:store.list('activities'),assets:store.list('assets'),aiJobs:store.list('aiJobs').filter(j=>j.kind?.startsWith('resume-')||j.kind==='interview-briefing'||j.kind==='hosted-briefing'),notes:store.list('notes'),briefings:store.list('briefings'),
      watches:store.list('watches'),preferences:store.get('preferences','main')||{plans:[],global:{},excluded:{},notification:{enabled:reminders.settings().digest,hour:reminders.settings().digestHour}},
      messages:store.list('messages').map(({text,...message})=>message),confirmations:store.list('confirmations'),sources:store.list('sources'),sourceScheduler:store.get('settings','source-scheduler'),discoveryRuns:store.list('discoveryRuns'),syncRuns:store.list('syncRuns'),
      settings:store.get('settings','main')||{timezone:'Asia/Shanghai'},
      connections:store.list('connections').map(({secret,...safe})=>safe)};
  }
  function command(request) {
    if(!request || typeof request.action!=='string')throw Error('操作无效');
    const data=request.data||{};
    switch(request.action){
      case 'onboarding-action':return onboarding.act(data);
      case 'organization-list-preview':return opportunityActions.preview(data);
      case 'organization-list-adopt':return opportunityActions.adopt(data);
      case 'plans-bulk':return opportunityActions.bulkPlan(data);
      case 'legacy-record':return legacy.record(data.id);
      case 'legacy-acknowledge':return legacy.acknowledge(data);
      case 'discovery-search-preview':return discoverySearch.preview();
      case 'discovery-search-configure':return discoverySearch.configure(data);
      case 'discovery-search-check':return discoverySearch.tick();
      case 'discovery-search-results':return discoverySearch.results();
      case 'discovery-search-cancel':return discoverySearch.cancel();
      case 'search-configure':return search.configure(data);
      case 'search-run':return search.run(data);
      case 'search-cancel':return search.cancel();
      case 'cloud-monitoring':return hosted.monitoring(data.action,data);
      case 'hosted-configure':return hosted.configure(data);
      case 'hosted-login':return hosted.login(data);
      case 'hosted-logout':return hosted.logout();
      case 'hosted-account':return hosted.account();
      case 'hosted-quote-briefing':return hosted.quoteBriefing(data);
      case 'hosted-start':return hosted.start(data);
      case 'hosted-refresh':return hosted.refresh(data.id);
      case 'hosted-cancel':return hosted.cancel(data.id);
      case 'hosted-checkout':return hosted.checkout(data);
      case 'briefing-generate':return briefings.run(data);
      case 'briefing-cancel':return briefings.cancel(data.id);
      case 'source-configure':return sources.configure(data);
      case 'source-check':return sources.tick();
      case 'source-preview':return sources.preview(data);
      case 'source-review':return sources.review(data);
      case 'source-confirm':return sources.confirm(data);
      case 'source-evidence':return sources.evidence(data.id);
      case 'mail-ai-hosted-config':return hosted.mailConfig();
      case 'mail-ai-hosted-quote':return hosted.quoteMail(data);
      case 'mail-ai-hosted-list':return hosted.mailJobs(data.id);
      case 'mail-ai-hosted-result':return hosted.mailResult(data.id);
      case 'mail-ai-hosted-start':hosted.mailJob(data.id);return hosted.start(data);
      case 'mail-ai-hosted-refresh':hosted.mailJob(data.id);return hosted.refresh(data.id);
      case 'mail-ai-hosted-cancel':hosted.mailJob(data.id);return hosted.cancel(data.id);
      case 'mail-ai-config':return mailAI.config();
      case 'mail-ai-list':return mailAI.list(data.id);
      case 'mail-ai-run':return mailAI.run(data);
      case 'mail-ai-adopt':return mailAI.adopt(data);
      case 'mail-ai-cancel':return mailAI.cancel(data.id);
      case 'mail-configure':return mail.configure(data);
      case 'mail-sync':return mail.sync(data.id);
      case 'mail-stop':return mail.stop(data.id);
      case 'mail-disconnect':return mail.disconnect(data.id);
      case 'mail-message':return mail.message(data.id);
      case 'mail-confirm':return mail.confirm(data);
      case 'reminder-settings':return reminders.configure(data);
      case 'reminder-read':return reminders.read(data.id);
      case 'reminder-check':return reminders.tick();
      case 'snapshot':return snapshot();
      case 'profile-save':return facts.save(data.profile,data.hash);
      case 'profile-merge':return facts.merge(data.changes,data.hash);
      case 'profile-restore':return facts.restore(data.revisionHash,data.hash);
      case 'resume-ai':if(!resumeAI)throw Error('模型未配置');return resumeAI.run(data);
      case 'resume-cancel':return resumeAI?.cancel(data.id)||false;
      case 'resume-adopt':if(!resumeAI)throw Error('模型未配置');return resumeAI.adopt(data);
      case 'asset-update':return assets.update(data);
      case 'asset-retry':return assets.parse(data.id);
      case 'qualifications-save':return qualifications.save(data);
      case 'preferences-preview':return workflow.previewPreferences(data);
      case 'preferences':return workflow.preferences(data);
      case 'organization':return workflow.organization(data);
      case 'opportunity':return workflow.opportunity(data);
      case 'watch':return workflow.watch(data);
      case 'opportunities-presented':return opportunityDigest.presented(data.items);
      case 'opportunity-digest-detail':return opportunityDigest.detail(data.id);
      case 'opportunity-feedback':return discovery.feedback(data);
      case 'opportunity-change-read':return discovery.acknowledge(data.id,data.revision);
      case 'collect':return workflow.collect(data.id,data.state);
      case 'plan':return workflow.plan(data);
      case 'application-start':return workflow.startApplication(data.planId);
      case 'application-reference':return workflow.applicationReference(data);
      case 'application-confirm':return workflow.confirmSubmission(data);
      case 'application-asset':return workflow.bindAsset(data);
      case 'event':return workflow.event(data);
      case 'task':return workflow.task(data);
      case 'task-complete':return workflow.completeTask(data);
      case 'task-status':return workflow.taskStatus(data);
      case 'calendar':return workflow.calendar(data.month,data.timezone,data.mode);
      case 'note':return workflow.note(data);
      default:throw Error('不支持的操作');
    }
  }
  return {store,facts,workflow,assets,interviewMaterials,reminders,backup,legacy,mail,mailAI,sources,briefings,hosted,search,discoverySearch,snapshot,command,close:()=>{opportunityActions.close();discoverySearch.close();search.close();hosted.close();briefings.close();sources.close();mailAI.close();mail.close();reminders.close();resumeAI?.close();store.close();}};
}
module.exports={createWorkbench};
