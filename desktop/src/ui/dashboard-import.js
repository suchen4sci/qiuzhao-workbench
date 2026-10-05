(() => {
  const $ = id => document.getElementById(id);
  const button = document.createElement('button');
  button.className = 'button'; button.id = 'import-job'; button.textContent = '一键导入工作台';
  document.querySelector('.primary-actions').append(button);
  const escape = text => String(text || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  button.onclick = async () => {
    button.disabled = true;
    try {
      const draft = await (window.__jobDraft ? window.__jobDraft() : window.desktop.call('dashboard-draft'));
      await window.desktop.call('browser-visible', false);
      $('overlay').hidden = false; $('panel-title').textContent = '导入秋招工作台'; $('panel-eyebrow').textContent = '公司与岗位';
      const now = new Date(), date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      $('panel-body').innerHTML = `<p class="notice">核对公司和具体岗位。确认后标记为已投递；同公司同岗位更新原记录，后续面试进度不会被覆盖。</p><form id="import-job-form" class="import-job-form"><label>公司名称<input name="company" required maxlength="150" value="${escape(draft.company)}"></label><label>具体岗位<input name="role" required maxlength="200" value="${escape(draft.role)}" placeholder="例如：数字芯片验证工程师"></label><label>投递日期<input name="date" type="date" required value="${date}"></label><label>招聘链接<input name="url" type="url" required value="${escape(draft.url)}"></label><label class="import-confirm"><input name="confirmed" type="checkbox" required>我已完成该校园招聘岗位的投递</label><p id="import-feedback" role="status"></p><button class="button primary" type="submit">确认已投递并导入</button></form>`;
      $('import-job-form').onsubmit = async e => {
        e.preventDefault();
        const form = e.currentTarget, submit = form.querySelector('[type="submit"]'); submit.disabled = true;
        $('import-feedback').textContent = '正在写入工作台…';
        try {
          const values = Object.fromEntries(new FormData(form)); values.confirmed = values.confirmed === 'on';
          const result = await window.desktop.call('dashboard-import', values);
          $('import-feedback').textContent = `${result.updated ? '已更新原记录' : '已加入工作台'} · ${result.job['公司名称']} · ${result.job['投递岗位']} · ${result.job['当前状态']}`;
          submit.textContent = '导入成功';
          if ($('dashboard-frame').getAttribute('src')) $('dashboard-frame').src = 'http://127.0.0.1:33210/';
        } catch (error) { $('import-feedback').textContent = error.message; submit.disabled = false; }
      };
    } catch (error) { $('toast').textContent = error.message; $('toast').hidden = false; }
    finally { button.disabled = false; }
  };
})();

