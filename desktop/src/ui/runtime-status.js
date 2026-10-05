(() => {
  if (window.__runtimeStatusInstalled) return;
  window.__runtimeStatusInstalled = true;
  function describe(info) {
    if (!info) return '引擎版本未报告';
    return `引擎 ${info.engineVersion} · ${info.mode === 'hot' ? '热更新' : '主程序'} · ${info.hostSync === 'connected' ? '主状态已同步' : '主状态未同步'}${info.sourceChanged ? ' · 源码已变更，当前进程待更新' : ''}`;
  }
  window.showRuntimeStatus = info => {
    if (info) window.__runtimeInfo = info;
    let badge = document.getElementById('runtime-status');
    if (!badge) { badge = document.createElement('span'); badge.id = 'runtime-status'; document.querySelector('.statusbar')?.append(badge); }
    badge.textContent = describe(window.__runtimeInfo);
    badge.title = `${describe(window.__runtimeInfo)} · PID ${window.__runtimeInfo?.pid || '未知'}`;
  };
  const summary = updateSummary;
  updateSummary = function () { summary(); window.showRuntimeStatus(lastReport?.runtime); };
  const render = renderReport;
  renderReport = function () {
    render();
    const notice = document.createElement('p'); notice.className = 'notice';
    notice.textContent = describe(lastReport?.runtime || window.__runtimeInfo);
    document.getElementById('panel-body').prepend(notice);
  };
  call('runtime-info').then(info => { if (!window.__runtimeInfo) window.showRuntimeStatus(info); }).catch(() => window.showRuntimeStatus());
})();
