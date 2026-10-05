(() => {
  if (window.__teachingUiInstalled) return;
  window.__teachingUiInstalled = true;
  const el = id => document.getElementById(id);
  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const transport = payload => typeof window.__teachingCall === 'function' ? window.__teachingCall(payload) : window.desktop.call('teaching', payload);
  const start = document.createElement('button'); start.id = 'teach'; start.className = 'button'; start.textContent = '● 开始教学';
  const end = document.createElement('button'); end.id = 'teach-end'; end.className = 'button'; end.textContent = '■ 结束教学'; end.disabled = true;
  const history = document.createElement('button'); history.id = 'teach-history'; history.className = 'button'; history.textContent = '教学记录';
  document.querySelector('.primary-actions').append(start, end, history);
  let current = { active: false }, requesting = false, timer;
  function message(text) { el('toast').textContent = text; el('toast').hidden = false; clearTimeout(timer); timer = setTimeout(() => el('toast').hidden = true, 5000); }
  function update(state) {
    current = state;
    start.textContent = state.active ? `● 正在学习 · ${state.session?.count || 0} 步` : '● 开始教学';
    start.className = state.active ? 'button danger' : 'button';
    start.disabled = state.active || requesting;
    end.disabled = !state.active || requesting;
    end.className = state.active ? 'button danger' : 'button';
    start.setAttribute('aria-pressed', String(state.active));
    if (state.active) {
      el('status').textContent = `● 正在记录 · ${state.session?.site || ''} · ${state.session?.count || 0} 步已记到本地`;
      for (const id of ['fill','inspect','ai','demo']) el(id).disabled = true;
    } else {
      for (const id of ['fill','inspect','ai','demo']) el(id).disabled = false;
      if (state.session) el('status').textContent = state.error || `教学已结束 · ${state.session.count} 步已保存 · 可查看教学记录`;
    }
    if (state.error) message(state.error);
  }
  window.__updateTeaching = update;
  async function review() {
    const result = await transport({ action: 'review' }); update(result);
    await window.desktop.call('browser-visible', false);
    el('overlay').hidden = false; el('panel-title').textContent = '教学记录'; el('panel-eyebrow').textContent = result.session?.site || '人工教学';
    if (!result.session) { el('panel-body').innerHTML = '<p>还没有教学记录。关闭此面板，点击“开始教学”，再正常操作网页。</p>'; return; }
    const changes = result.events.filter(e => e.kind === 'change');
    const actions = result.events.filter(e => ['click','change'].includes(e.kind));
    el('panel-body').innerHTML = `<div class="notice">${result.active ? '正在记录。请先结束教学，再确认字段规则。' : '操作已经保存在本地。确认字段对应关系后，后续快速填写可以复用；新增输入仍需核对，不会自动覆盖个人事实。'}<br>本版记录操作与弹窗变化；不会自动重放“添加”、保存、提交等点击。</div><p>已记录 ${actions.length} 步 · ${changes.length} 次字段变化 · ${result.events.filter(e=>e.kind==='state').length} 次界面结构快照</p><p>记录文件：${escape(result.session.file)}</p><h3>字段对应关系</h3>${changes.length ? changes.map(e => `<div class="teaching-row"><b>${escape(e.target.labels[0] || '未标注字段')}</b><p>${escape(e.value || '（清空）')}</p><small>${escape(e.target.headings.join(' / '))} · ${escape(e.candidate?.reason || '请选择对应资料；不确定可保留待确认')}</small><div><select data-binding="${e.id}" aria-label="字段对应关系" ${e.manualOnly ? 'disabled' : ''}><option value="">待确认</option>${result.choices.map(c => `<option value="${c.id}" ${c.id === (e.confirmedField || (e.candidate ? `${e.candidate.group}.${e.candidate.key}` : '')) ? 'selected' : ''}>${escape(c.label)}</option>`).join('')}</select><button class="button" data-confirm="${e.id}" ${result.active || e.manualOnly ? 'disabled' : ''}>${e.confirmedField ? '已确认 · 更新' : '确认字段规则'}</button></div></div>`).join('') : '<p>尚无字段填写记录。点击与弹窗变化在下方。</p>'}<h3>操作顺序</h3>${actions.map((e,i)=>`<div class="result-row"><div>${i+1}. ${e.kind === 'click' ? '点击' : '填写'}<small>${escape(e.target.headings.join(' / '))}</small></div><span>${e.manualOnly ? '本人操作' : '已记录'}</span><span class="reason">${escape(e.kind === 'click' ? e.text : e.target.labels[0] || '未标注字段')}</span></div>`).join('')}`;
    if (result.learning) el('panel-body').insertAdjacentHTML('afterbegin', `<div class="notice"><b>学习结果与可执行范围</b><p>以之前确认的知识库为准，示范日期不覆盖事实。</p><p>已识别控件：${escape(result.learning.components.join('、') || '旧记录缺少控件标识，可继续教学补充')}</p><p>快速填写已支持：${escape(result.learning.capabilities.join('；'))}</p><p>记录了 ${result.learning.openings.length} 次添加入口；待验证，不自动重复新增经历。</p><p>${escape(result.learning.limitations.join('；'))}</p></div>`);
    el('panel-body').querySelectorAll('[data-confirm]').forEach(button => button.onclick = async () => {
      const field = el('panel-body').querySelector(`[data-binding="${button.dataset.confirm}"]`).value;
      try { await transport({ action: 'confirm', eventId: button.dataset.confirm, field }); message('字段规则已保存。它使用当前所选资料，不会把这次输入写死。'); await review(); } catch(e) { message(e.message); }
    });
  }
  start.onclick = async () => {
    if (requesting) return;
    requesting = true; start.disabled = true;
    try {
      if (!current.active) {
        await window.desktop.call('browser-visible', true); el('overlay').hidden = true;
        const selections = {};
        document.querySelectorAll('.record.selected [data-select]').forEach(button => { const [group,index] = button.dataset.select.split(':'); selections[group] = Number(index); });
        update(await transport({action:'start', selections})); message('教学已开始。现在可以手动点击“添加”并填写；结束后查看记录。');
      }
    } catch(e) { message(`教学未开始或已中断：${e.message}`); }
    finally { requesting = false; update(current); }
  };
  end.onclick = async () => {
    if (requesting || !current.active) return;
    requesting = true; end.disabled = true;
    try { update(await transport({action:'stop'})); message('本次教学已保存，后续操作不再记录。'); await review(); }
    catch(e) { message(`结束教学未完成：${e.message}`); }
    finally { requesting = false; update(current); }
  };
  history.onclick = () => review().catch(e => message(e.message));
  window.desktop.onState(({type,data}) => { if (type === 'teaching') update(data); });
  transport({action:'status'}).then(update).catch(() => message('教学服务未连接，请不要开始示范。'));
  setInterval(() => {
    if (!current.active) return;
    Promise.race([transport({action:'status'}), new Promise((_,reject)=>setTimeout(()=>reject(new Error('连接超时')),4500))])
      .then(update).catch(() => { current.active = false; start.textContent = '录制连接中断'; el('status').textContent = '录制连接中断，请暂停示范，已落盘内容仍保留。'; });
  }, 4000);
})();
