window.installHotProfile = async bridge => {
  async function refresh() { profile = await window[bridge]({ mode: 'profile' }); renderLibrary(); }
  await refresh();
  $('refresh').onclick = () => attempt(async () => { await refresh(); toast('已用当前引擎重新读取知识库。'); });
  // The legacy main process may not know new categories. Copy exactly the data
  // displayed by this profile, never fall back to a stale main-process field ID.
  $('records').onclick = event => attempt(async () => {
    const copy = event.target.closest('[data-copy]'), whole = event.target.closest('[data-copy-record]'), select = event.target.closest('[data-select]');
    if (copy || whole) {
      if (!navigator.clipboard?.writeText) throw new Error('当前窗口无法访问剪贴板，请恢复窗口后重试。');
      const records = profile.library.flatMap(group => group.records);
      const record = whole ? records.find(record => record.id === whole.dataset.copyRecord) : undefined;
      const field = copy ? records.flatMap(record => record.fields).find(field => field.id === copy.dataset.copy) : undefined;
      if (!(record || field)) throw new Error('当前资料中没有此字段，请刷新资料后再复制。');
      const value = field ? field.value : record.fields.map(field => `${field.label}：${field.value}`).join('\n');
      try { await navigator.clipboard.writeText(value); }
      catch { throw new Error('剪贴板写入失败，请恢复窗口后重试；没有使用旧版资料替代。'); }
      toast(copy ? '已复制，回到网页粘贴即可。' : '已复制整条经历（含字段名称）。');
    }
    if (select) { const [group, index] = select.dataset.select.split(':'); selections[group] = Number(index); $('search').value = ''; renderLibrary(); }
  });
};
