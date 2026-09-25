const $ = id => document.getElementById(id);
const call = (name, data) => window.desktop.call(name, data);
let profile, activeCategory = 'basic', selections = {}, lastReport, busy = false, toastTimer;
const expandedFields = new Set();
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
function toast(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 4000); }
async function attempt(fn) { try { return await fn(); } catch (e) { toast(e.message.replace(/^Error invoking remote method '[^']+': Error: /, '')); } }
function renderLibrary() {
  const query = $('search').value.trim().toLowerCase();
  $('categories').innerHTML = profile.library.map(g => `<button data-category="${g.id}" class="${activeCategory === g.id && !query ? 'active' : ''}">${g.label}</button>`).join('');
  let count = 0;
  $('records').innerHTML = profile.library.filter(g => query || g.id === activeCategory).map(group => group.records.map(record => {
    const fields = record.fields.filter(f => !query || `${record.title} ${f.label} ${f.value}`.toLowerCase().includes(query));
    if (!fields.length) return '';
    count++;
    return `<article class="record ${(selections[group.id] || 0) === record.index ? 'selected' : ''}"><div class="record-head"><button class="record-title" data-select="${group.id}:${record.index}"><i></i><span>${escapeHtml(record.title)}</span></button><div class="record-tools"><span>${(selections[group.id] || 0) === record.index ? '当前填写这条' : '点击标题选择'} · ${group.label}</span><button data-copy-record="${record.id}">复制整条 ↗</button></div>${record.sourceLabel ? `<small class="source-label">${escapeHtml(record.sourceLabel)}</small>` : ''}</div><div class="fields">${fields.map(f => f.value.length > 30 ? `<details class="field long expandable" data-detail="${f.id}" ${expandedFields.has(f.id) ? 'open' : ''}><summary><span class="label">${f.label}${f.manual ? ' · 手动核对' : ''}<span class="expand-hint">展开全文 ▾</span></span><span class="long-preview">${escapeHtml(f.value)}</span></summary><div class="full-text" tabindex="0">${escapeHtml(f.value)}</div><div class="long-actions"><span>拖选文字后按 Ctrl+C</span><button type="button" class="text-button" data-copy="${f.id}">复制全文 ⧉</button></div></details>` : `<button class="field" data-copy="${f.id}" title="${escapeHtml(f.value)}"><span class="label">${f.label}${f.manual ? ' · 手动核对' : ''}</span><span class="copy">⧉</span><span class="value">${escapeHtml(f.value)}</span></button>`).join('')}</div></article>`;
  }).join('')).join('');
  if (!count) $('records').innerHTML = '<p class="empty">没有匹配的资料，试试其他关键词。</p>';
  $('field-count').textContent = profile.library.reduce((sum, g) => sum + g.records.reduce((n, r) => n + r.fields.length, 0), 0) + ' 个字段';
}
function setBusy(value) {
  busy = value;
  for (const id of ['fill', 'inspect', 'ai', 'refresh', 'demo', 'reload', 'url']) $(id).disabled = value;
  $('stop').hidden = !value;
  $('status').textContent = value ? '正在本地填写 · 可随时停止' : '就绪 · 只填写当前页，保留已有内容';
}
async function openPanel(title, eyebrow) {
  await call('browser-visible', false);
  $('panel-title').textContent = title; $('panel-eyebrow').textContent = eyebrow; $('overlay').hidden = false;
}
async function closePanel() { $('overlay').hidden = true; await call('browser-visible', true); }
function renderReport() {
  if (!lastReport) { $('panel-body').innerHTML = '<p>还没有检查记录。打开招聘表单后点击“检查漏项”。</p>'; return; }
  const c = lastReport.counts;
  $('panel-body').innerHTML = `<div class="stats">${[['filled','已填写'],['ready','可快速填'],['pending','待处理'],['existing','保留已有']].map(([key,label]) => `<div class="stat"><b>${c[key] || 0}</b><span>${label}</span></div>`).join('')}</div><p class="notice">本次用时 ${(lastReport.elapsedMs / 1000).toFixed(1)} 秒。仅检查当前可见表单；隐藏栏目需展开后再检查。字段回读通过不代表网站已保存，附件和最终提交需另行核验。</p>${lastReport.fields.map(f => `<div class="result-row"><div>${escapeHtml(f.label)}<small>${escapeHtml(f.group || '页面框架')}</small></div><span class="${f.status}">${({filled:'已填写', ready:'可填写', pending:'待处理',existing:'已保留',failed:'需检查',notApplicable:'不适用'})[f.status]}</span><span class="reason">${escapeHtml(f.reason || '可使用当前所选资料填写')}</span></div>`).join('') || '<p>当前页面没有可见表单。请进入简历编辑页。</p>'}`;
}
async function run(mode) {
  await closePanel();
  setBusy(true);
  try { lastReport = await call('run', { mode, selections }); updateSummary(); toast(mode === 'fill' ? `本次填写 ${lastReport.counts.filled} 项，保留已有 ${lastReport.counts.existing} 项，${lastReport.counts.pending} 项待处理。` : `找到 ${lastReport.counts.ready} 项可快速填写。`); }
  finally { setBusy(false); }
}
function updateSummary() { if (lastReport) $('summary').textContent = `本次填写 ${lastReport.counts.filled} · 保留已有 ${lastReport.counts.existing} · 可填 ${lastReport.counts.ready} · 待处理 ${lastReport.counts.pending} · ${(lastReport.elapsedMs/1000).toFixed(1)}s`; }
$('categories').onclick = event => { const button = event.target.closest('[data-category]'); if (button) { activeCategory = button.dataset.category; $('search').value = ''; renderLibrary(); } };
$('records').onclick = event => attempt(async () => {
  const copy = event.target.closest('[data-copy]'), whole = event.target.closest('[data-copy-record]'), select = event.target.closest('[data-select]');
  if (copy) { await call('copy-field', copy.dataset.copy); toast('已复制，回到网页粘贴即可。'); }
  if (whole) { await call('copy-record', whole.dataset.copyRecord); toast('已复制整条经历（含字段名称）。'); }
  if (select) { const [group, index] = select.dataset.select.split(':'); selections[group] = Number(index); renderLibrary(); }
});
$('search').oninput = renderLibrary;
$('records').addEventListener('toggle', event => { const detail = event.target.dataset?.detail; if (detail) { if (event.target.open) expandedFields.add(detail); else expandedFields.delete(detail); } }, true);
$('refresh').onclick = () => attempt(async () => { profile = await call('refresh-profile'); renderLibrary(); toast('已重新读取知识库。'); });
$('navigation').onsubmit = event => { event.preventDefault(); attempt(() => call('navigate', $('url').value)); };
for (const name of ['back', 'forward', 'reload']) $(name).onclick = () => attempt(() => call('browser-action', name));
$('demo').onclick = () => attempt(() => call('demo'));
$('fill').onclick = () => attempt(() => run('fill'));
$('inspect').onclick = () => attempt(async () => { await run('inspect'); await openPanel('页面检查', '当前页面'); renderReport(); });
$('stop').onclick = () => attempt(() => call('stop'));
$('results').onclick = () => attempt(async () => { await openPanel('填写结果', '当前页面'); renderReport(); });
$('close-panel').onclick = () => attempt(closePanel);
window.desktop.onState(({type, data}) => {
  if (type === 'navigation') { $('page-title').textContent = data.title || '招聘网站'; $('back').disabled = !data.back; $('forward').disabled = !data.forward; if (data.error) toast(data.error); }
  if (type === 'busy') setBusy(data);
  if (type === 'report') { lastReport = data; updateSummary(); }
  if (type === 'reset-report') { lastReport = null; $('summary').textContent = '填写不等于保存或提交'; }
  if (type === 'error') toast(data);
});
document.addEventListener('keydown', event => { if (event.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName)) { event.preventDefault(); $('search').focus(); } if (event.key === 'Escape' && !$('overlay').hidden) attempt(closePanel); });
function resizeBrowser() { const rect = $('browser-anchor').getBoundingClientRect(); attempt(() => call('browser-rect', { x: rect.x, y: rect.y })); }
new ResizeObserver(resizeBrowser).observe($('browser-anchor'));
attempt(async () => { profile = await call('profile'); renderLibrary(); resizeBrowser(); });

$('dashboard-tab').onclick = () => attempt(async () => {
  $('dashboard-tab').disabled = true;
  try {
    const url = await call('dashboard-open');
    await call('browser-visible', false);
    $('overlay').hidden = true;
    if (!$('dashboard-frame').getAttribute('src')) $('dashboard-frame').src = url;
    $('dashboard-pane').hidden = false;
    $('dashboard-tab').classList.add('active'); $('forms-tab').classList.remove('active');
    $('dashboard-tab').setAttribute('aria-pressed', 'true'); $('forms-tab').setAttribute('aria-pressed', 'false');
  } finally { $('dashboard-tab').disabled = false; }
});
$('forms-tab').onclick = () => attempt(async () => {
  $('dashboard-pane').hidden = true;
  $('forms-tab').classList.add('active'); $('dashboard-tab').classList.remove('active');
  $('forms-tab').setAttribute('aria-pressed', 'true'); $('dashboard-tab').setAttribute('aria-pressed', 'false');
  await call('browser-visible', true);
});
