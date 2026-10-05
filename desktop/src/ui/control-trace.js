(() => {
  if (window.__controlTraceRevision === 'ant-controls-v1') return;
  window.__controlTraceInstalled = true;
  window.__controlTraceRevision = 'ant-controls-v1';
  const names = {text:'文本框','native-select':'原生下拉','native-date':'原生日期','native-radio':'单选按钮','element-select':'Element 下拉','element-date':'Element 日期','aria-combobox':'标准组合框','phoenix-widget':'Phoenix 控件','phoenix-radio':'Phoenix 单选','ant-date':'Ant 日期','ant-select':'Ant 下拉','ant-radio':'Ant 单选组','select2-select':'Select2 下拉',unsupported:'未识别控件'};
  const previous = renderReport;
  renderReport = function () {
    previous();
    document.querySelectorAll('#panel-body .result-row').forEach((row,index) => {
      row.querySelectorAll('details').forEach(details => { if (details.querySelector('summary')?.textContent === '识别与执行记录') details.remove(); });
      const field=lastReport?.fields[index];
      const runs=field?.controlRuns || (field?.attempts ? [field] : []);
      if (!runs.length) return;
      const details=document.createElement('details');
      const summary=document.createElement('summary');summary.textContent='识别与执行记录';details.append(summary);
      for(const run of runs){
        const line=document.createElement('div');
        line.textContent=(run.label?run.label+'：':'')+(names[run.controlType]||run.controlType||'控件')+' → '+(run.attempts||[]).map(a=>a.method+'（'+({verified:'回读通过',failed:'失败',unverified:'未通过',recovery:'回退'}[a.status]||a.status)+(a.reason?'：'+a.reason:'')+'）').join(' → ');
        line.style.marginTop='6px';details.append(line);
      }
      details.style.marginTop='8px';(row.querySelector('.reason')||row).append(details);
    });
  };
})();
