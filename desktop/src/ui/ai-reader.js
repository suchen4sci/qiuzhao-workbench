(() => {
  const button = $('ai');
  button.title = 'AI 只建议未知字段的对应关系，确认后由本地规则填写';
  let recognizing = false;
  async function settings() {
    const config = await call('ai-settings');
    await openPanel('AI 增强设置', '可选服务 · 默认关闭');
    $('panel-body').innerHTML = `<p class="notice">规则填写不需要订阅。启用后，“AI 识别字段”会向你配置的模型服务发送待识别字段的名称、栏目和控件类型，以及通用字段目录。字段文字可能含个人信息。程序不发送简历事实值、整页 HTML、Cookie 或代码。每次识别后，由你勾选确认对应关系，再点击快速填写。</p>
      <form id="ai-config" class="import-job-form">
      <label class="import-confirm"><input id="ai-enabled" type="checkbox" ${config.enabled ? 'checked' : ''}>启用 AI 增强，我已了解发送内容</label>
      <label>兼容 Chat Completions 的服务地址（包含 /v1 等服务前缀）<input id="ai-base" type="url" placeholder="https://你的服务地址/v1" value="${escapeHtml(config.baseUrl)}"></label>
      <label>模型名称<input id="ai-model" placeholder="填写服务商提供的模型 ID" value="${escapeHtml(config.model)}"></label>
      <label>API Key<input id="ai-key" type="password" autocomplete="off" placeholder="${config.hasKey ? '已保存，留空保持原密钥' : '本机免密模型可留空'}"></label>
      <label class="import-confirm"><input id="ai-clear-key" type="checkbox">清除已保存密钥</label>
      <p>密钥使用系统加密后保存在本机，不显示回已保存的密钥。API 费用由你配置的服务商收取。关闭 AI 后可继续使用规则填写。</p>
      ${config.keyUnavailable ? '<p>旧密钥无法解密，请重新填写并保存。</p>' : ''}
      <button class="button primary" type="submit">保存设置</button></form>`;
    $('panel-body').insertAdjacentHTML('beforeend','<p>托管服务请在设置 → 托管账号与额度中配置。已生成的字段建议可在下面查看。</p><button class="button" id="ai-hosted-history">托管字段任务</button>');
    $('ai-hosted-history').onclick=()=>attempt(hostedTasks);
    $('panel-body').insertAdjacentHTML('beforeend','<button class="button" id="correction-settings-history">托管纠错任务</button>');$('correction-settings-history').onclick=()=>window.openHostedCorrections();
    $('ai-config').onsubmit = event => {
      event.preventDefault();
      attempt(async () => {
        await call('ai-settings', { action: 'save', enabled: $('ai-enabled').checked, baseUrl: $('ai-base').value,
          model: $('ai-model').value, apiKey: $('ai-key').value, clearKey: $('ai-clear-key').checked });
        $('ai-key').value = ''; toast('AI 设置已保存'); await closePanel();
      });
    };
  }
  $('ai-settings').onclick = () => attempt(settings);
  button.onclick = () => attempt(async () => {
    const config = await call('ai-settings'),hosted=await call('ai-hosted',{action:'config'});
    if (!config.enabled&&!hosted.connected) return settings();
    if (busy || recognizing) throw Error('请先结束当前任务');
    await closePanel();
    const scope=await call('ai-scope');
    await openPanel('选择本次 AI 范围','先选择字段，再发送至所配置的模型');
    if(!scope.fields.length){$('panel-body').innerHTML='<p>没有适合智能识别的未知字段。已有内容与人工字段可直接在网页中处理。</p>';return;}
    $('panel-body').innerHTML=`<p class="notice">本次仅发送勾选字段下列名称、栏目和类型。字段文字可能含个人信息；请先核对。服务商可能计费；不发送资料值。最多选择 60 个字段。</p><form id="ai-scope-form"><label>本次服务<select id="ai-provider">${config.enabled?'<option value="byok">自带 Key · 由服务商计费</option>':''}${hosted.connected?`<option value="hosted">托管额度 · ${escapeHtml(hosted.baseUrl)} · 先报价</option>`:''}</select></label>${hosted.connected?'<button class="button" type="button" id="ai-hosted-tasks">查看托管字段任务</button>':''}${scope.fields.map(f=>`<label class="ai-proposal"><input type="checkbox" name="scope" value="${escapeHtml(f.id)}"><span>${escapeHtml(f.label)}<small>名称：${escapeHtml(f.labels.join(" / "))}<br>页面标题：${escapeHtml(f.headings.join(" / ")||"无")}<br>栏目：${escapeHtml(f.section)} · 控件：${escapeHtml(f.tag)} / ${escapeHtml(f.type)}</small></span></label>`).join('')}<button class="button primary" type="submit">确认范围并识别</button></form>`;
    if($('ai-hosted-tasks'))$('ai-hosted-tasks').onclick=()=>attempt(hostedTasks);
    $('ai-scope-form').onsubmit=event=>{event.preventDefault();attempt(async()=>{
    const ids=[...event.currentTarget.querySelectorAll('input:checked')].map(el=>el.value);
    if(!ids.length||ids.length>60)throw Error('请选择 1 至 60 个字段');
    if($('ai-provider').value==='hosted'){const q=await call('ai-hosted',{action:'quote',token:scope.token,ids,confirmed:true});return hostedQuote(q);}
    recognizing=true;await closePanel();setBusy(true);$('status').textContent='AI 正在识别所选字段 · 可随时停止';
    let result;
    try { result = await call('ai-suggest',{token:scope.token,ids,confirmed:true}); }
    finally { recognizing = false; setBusy(false); }
    await showProposals(result);
    });};
  });
  async function showProposals(result){
    await openPanel('确认 AI 字段建议', '只学习对应关系 · 不生成事实');
    if (!result.suggestions.length) {
      $('panel-body').innerHTML = `<p>${result.candidateCount ? 'AI 没有给出足够明确的建议。' : '当前没有适合 AI 识别的未知字段。'}</p><p>已有内容冲突、缺少资料、附件或控件执行失败，请查看填写结果并处理；快速填写仍可使用。</p>`;
      return;
    }
    $('panel-body').innerHTML = `<p class="notice">核对字段含义后逐项勾选。确认会保存当前页面的字段规则，不会立即填写；个人信息仍只从你的知识库读取。</p>
      <form id="ai-proposals">${result.suggestions.map(s => `<label class="ai-proposal"><input type="checkbox" name="mapping" value="${escapeHtml(s.id)}"><span><strong>${escapeHtml(s.label)}</strong> → ${escapeHtml(s.target)}<small>${escapeHtml(s.explanation)}</small></span></label>`).join('')}
      <button class="button primary" type="submit">保存勾选的对应关系</button></form>`;
    $('ai-proposals').onsubmit = event => {
      event.preventDefault();
      attempt(async () => {
        const ids = [...$('ai-proposals').querySelectorAll('input:checked')].map(input => input.value);
        const saved = await call('ai-confirm', { token: result.token, ids });
        await closePanel(); toast(`已保存 ${saved.saved} 个对应关系，点击“快速填写”使用`);
      });
    };
  }
  async function hostedQuote(q){
    await openPanel('确认托管字段识别报价','只识别所选字段，保存对应关系后仍需手动点击快速填写');
    $('panel-body').innerHTML=`<p>${escapeHtml(q.successDefinition)}</p><p>本次最多 ${q.units} 额度 · 有效至 ${escapeHtml(new Date(q.expiresAt).toLocaleString())}。失败、取消或没有足够明确的建议不结算。关闭窗口不会取消云端任务。</p><button class="button primary" id="ai-hosted-start">确认预留 ${q.units} 额度并识别</button><button class="button" id="ai-hosted-history">查看托管任务</button>`;
    $('ai-hosted-start').onclick=()=>attempt(async()=>{const control=$('ai-hosted-start');control.disabled=true;try{await call('ai-hosted',{action:'start',id:q.id,confirmed:true});await hostedTasks();}catch(e){await hostedTasks();throw e;}});
    $('ai-hosted-history').onclick=()=>attempt(hostedTasks);
  }
  async function hostedTasks(){
    const jobs=await call('ai-hosted',{action:'list'});await openPanel('托管字段任务','返回原申请表单后才能核对和保存建议；重试沿用原任务，不重复扣费');
    $('panel-body').innerHTML=jobs.map(j=>`<article class="ai-proposal"><span>${escapeHtml(j.status)} · ${escapeHtml(j.error||'')}<small>${j.quote.units} 额度</small><button class="button" data-host-action="refresh" data-id="${escapeHtml(j.id)}">刷新</button>${['quoted','pending_remote'].includes(j.status)?`<button class="button" data-host-action="quote" data-id="${escapeHtml(j.id)}">报价 / 同任务重试</button>`:''}${['queued','running','pending_remote'].includes(j.status)?`<button class="button" data-host-action="cancel" data-id="${escapeHtml(j.id)}">取消云端任务</button>`:''}${['ready','refunded'].includes(j.status)?`<button class="button primary" data-host-action="result" data-id="${escapeHtml(j.id)}">核对建议</button>`:''}</span></article>`).join('')||'<p>暂无托管字段任务</p>';
    $('panel-body').querySelectorAll('[data-host-action]').forEach(b=>b.onclick=()=>attempt(async()=>{const {hostAction:action,id}=b.dataset;if(action==='quote')return hostedQuote({...jobs.find(j=>j.id===id).quote,id});if(action==='result')return showProposals(await call('ai-hosted',{action,id}));await call('ai-hosted',{action,id});await hostedTasks();}));
  }
  $('workspace-settings').onclick = () => attempt(async () => {
    const info = await call('workspace-info');
    await openPanel('我的资料工作区', '资料保存在本机');
    $('panel-body').innerHTML = `<p class="notice">${info.demo ? '目前使用虚构演示资料。正式使用前，请新建个人资料或导入已有工作区。' : '使用你的个人资料。编辑 profile.json 后点击“刷新资料”生效。'}新建与导入会重启应用，请先保存网页中的草稿。</p>
      <p>当前目录：<code>${escapeHtml(info.path)}</code></p><div class="handoff-actions">
      <button class="button" data-workspace="folder">打开资料目录</button><button class="button" data-workspace="edit">编辑资料文件</button>
      <button class="button primary" data-workspace="new">新建空白个人资料</button><button class="button" data-workspace="import">导入已有工作区</button></div>
      <p>目前资料以 JSON 文件维护。知识库目录中的历史材料用于溯源，运行时唯一数据源为 profile.json。未知资料留空。</p>`;
    $('panel-body').querySelectorAll('[data-workspace]').forEach(control => {
      control.onclick = () => attempt(() => call('workspace-action', control.dataset.workspace));
    });
  });
})();
