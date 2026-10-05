const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { groups, normalize, matchField } = require('./rules.cjs');
const { inferSection } = require('./engine.cjs');
const { summarize, persistSummary } = require('./learning-summary.cjs');

function pageIdentity(raw) {
  const u = new URL(raw);
  return { origin: u.origin, path: u.pathname, route: /^#\/[\w/-]*$/.test(u.hash) ? u.hash : '' };
}

// Observer only. No clicks, form mutations, cookies, screenshots, or network requests.
function installObserver({ sessionId, bridge }) {
  window.__qiuzhaoTeachingObserver?.stop();
  const visible = el => el instanceof Element && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
  const trim = (s, n = 160) => String(s || '').trim().slice(0, n);
  const cleanText = node => {
    if (!node) return '';
    const copy = node.cloneNode(true);
    copy.querySelectorAll('input,textarea,select,button,[contenteditable]').forEach(e => e.remove());
    return trim(copy.textContent);
  };
  const secret = el => /password|file|hidden/.test(el.type || '') || /密码|验证码|动态码|口令|银行卡|信用卡|cvv|otp|password|verification.?code|one.?time|captcha|token|secret/i.test([el.name, el.id, el.autocomplete, el.placeholder, el.getAttribute('aria-label'), ...(el.labels || [])].map(x => x?.textContent || x || '').join(' '));
  const selector = el => {
    if (el.id && /^[a-zA-Z_][\w-]{0,45}$/.test(el.id) && !/\d{6}/.test(el.id) && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) return `#${CSS.escape(el.id)}`;
    const parts = [];
    for (let node = el; node && node !== document.documentElement; node = node.parentElement) {
      if (!node.parentElement) return '';
      const siblings = [...node.parentElement.children].filter(s => s.tagName === node.tagName);
      parts.unshift(`${node.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(node) + 1})`);
    }
    return `html > ${parts.join(' > ')}`;
  };
  function describe(el) {
    const labels = [...(el.labels || [])].map(cleanText);
    if (el.getAttribute('aria-labelledby')) labels.push(el.getAttribute('aria-labelledby').split(/\s+/).map(id => cleanText(document.getElementById(id))).join(' '));
    const item = el.closest('.el-form-item,.ant-form-item,.form-item,.form-group,.field,td');
    if (item) labels.push(cleanText(item.querySelector('label,.el-form-item__label,.ant-form-item-label,.label')));
    labels.push(trim(el.getAttribute('aria-label')), trim(el.placeholder), trim(el.name));
    const headings = [];
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const heading = node.querySelector(':scope > legend,:scope > h2,:scope > h3,:scope > h4,:scope > .section-title,:scope > .el-dialog__header,:scope > .ant-modal-header');
      if (heading && visible(heading)) headings.push(cleanText(heading));
      // Portals often use spans, not semantic headings (including ABC's resume sections).
      for (const child of [...node.children].slice(0, 5)) {
        const text = cleanText(child);
        if (/^(教育背景|教育经历|基本信息|工作经历|实习经历|项目经历|外语能力|奖励情况|学生干部任职情况)$/.test(text)) headings.push(text);
      }
    }
    return { selector: selector(el), tag: el.tagName.toLowerCase(), type: el.getAttribute('type') || el.tagName.toLowerCase(), role: trim(el.getAttribute('role')),
      title: trim(el.getAttribute('title')), ariaLabel: trim(el.getAttribute('aria-label')),
      component: el.closest('.ant-calendar,.ant-calendar-picker') ? 'ant-calendar' : el.closest('.ant-select') ? 'ant-select' : el.tagName === 'SELECT' ? 'native-select' : '',
      classes: [...el.classList].filter(c => /^(ant-calendar|ant-select|el-date|el-select)/.test(c)).slice(0, 8),
      labels: [...new Set(labels.filter(Boolean))].slice(0, 5), headings: [...new Set(headings.filter(Boolean))].slice(0, 5) };
  }
  function state() {
    const fields = [...document.querySelectorAll('input,select,textarea,[contenteditable="true"]')].filter(el => visible(el) && !secret(el));
    return { fields: fields.slice(0, 100).map(el => { const d = describe(el); return { selector: d.selector, label: d.labels[0] || '', type: d.type }; }),
      dialogs: [...document.querySelectorAll('[role="dialog"],.el-dialog,.ant-modal,.modal')].filter(visible).slice(0, 8).map(el => ({ selector: selector(el), title: cleanText(el.querySelector('h2,h3,.el-dialog__title,.ant-modal-title')) })),
    };
  }
  const pending = new Set();
  let active = true, lastState = '', timer, lastAction = '', sequence = 0;
  const send = event => {
    if (!active) return;
    const promise = Promise.resolve(window[bridge]({ sessionId, ...event })).catch(() => {}).finally(() => pending.delete(promise));
    pending.add(promise);
  };
  const changed = new Set(), watched = new Set(), sent = new WeakMap();
  function commit(el) {
    if (!el || secret(el) || !visible(el)) return;
    let value = el.matches('select') ? [...el.selectedOptions].map(o => o.textContent.trim()).join('、') : el.isContentEditable ? el.textContent : el.value;
    if (/checkbox|radio/.test(el.type)) value = el.checked ? '已选中' : '未选中';
    value = String(value ?? '').slice(0, 20000);
    if (sent.get(el) === value) return;
    sent.set(el, value); changed.delete(el);
    const actionId = `a${++sequence}`;
    lastAction = actionId;
    send({ kind: 'change', actionId, target: describe(el), value, manualOnly: /checkbox|radio/.test(el.type) });
  }
  const onInput = e => { if (e.isTrusted && e.target instanceof Element && !secret(e.target)) changed.add(e.target); };
  const onChange = e => { if (e.isTrusted) commit(e.target); };
  const onBlur = e => { if (changed.has(e.target)) commit(e.target); };
  const onClick = e => {
    if (!e.isTrusted || !(e.target instanceof Element)) return;
    const el = e.target.closest('button,a,[role="button"],[role="option"],input,select,textarea,[contenteditable="true"],label') || e.target;
    if (!visible(el) || secret(el)) return;
    const target = describe(el);
    const isField = el.matches('input,select,textarea,[contenteditable="true"]');
    if (isField) watched.add(el);
    const text = isField ? target.labels[0] : trim(el.textContent, 100) || target.ariaLabel || target.title || target.classes.join(' ');
    if (!isField && (!text || text.length > 90)) return;
    const actionId = `a${++sequence}`; lastAction = actionId;
    send({ kind: 'click', actionId, target, text: text || '', manualOnly: /保存|提交|删除|撤回|上传|登录|同意|签名|确认|save|submit|delete|upload|login/i.test((text || '').replace(/\s/g, '')) });
    queueState();
  };
  function captureState() {
    for (const el of watched) if (!changed.has(el)) commit(el);
    const current = state(), encoded = JSON.stringify(current);
    if (encoded !== lastState) { lastState = encoded; send({ kind: 'state', afterAction: lastAction, state: current }); }
  }
  function queueState() { clearTimeout(timer); timer = setTimeout(captureState, 220); }
  document.addEventListener('click', onClick, true);
  document.addEventListener('input', onInput, true);
  document.addEventListener('change', onChange, true);
  document.addEventListener('focusout', onBlur, true);
  const observer = new MutationObserver(queueState);
  observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class','style','hidden','aria-expanded','disabled'] });
  async function stop() {
    for (const el of changed) commit(el);
    clearTimeout(timer); captureState();
    active = false; observer.disconnect();
    document.removeEventListener('click', onClick, true); document.removeEventListener('input', onInput, true);
    document.removeEventListener('change', onChange, true); document.removeEventListener('focusout', onBlur, true);
    await Promise.allSettled([...pending]);
  }
  window.__qiuzhaoTeachingObserver = { stop, sessionId };
  captureState();
  return { installed: true };
}

class TeachingRecorder {
  constructor({ workspace, getPage, getProfile, onState = () => {} }) {
    this.workspace = workspace; this.getPage = getPage; this.getProfile = getProfile; this.onState = onState;
    this.bridge = `__qtRecord_${crypto.randomBytes(8).toString('hex')}`;
    this.boundPages = new WeakSet(); this.active = false; this.session = null; this.error = '';
    this.directory = path.join(workspace, '知识库', '07-教学待确认');
  }
  view() { return { active: this.active, error: this.error, session: this.session && { id: this.session.id, status: this.session.status, site: this.session.site.origin === 'null' ? '本地练习页' : this.session.site.origin,
    count: this.session.events.filter(e => ['click','change'].includes(e.kind)).length, eventCount: this.session.events.length, file: this.file,
    last: this.session.events.filter(e => ['click','change'].includes(e.kind)).at(-1)?.target?.labels?.[0] || '',
  } }; }
  notify() { this.onState(this.view()); }
  persist() {
    fs.mkdirSync(this.directory, { recursive: true });
    const temp = this.file + '.tmp';
    fs.writeFileSync(temp, JSON.stringify(this.session, null, 2), { mode: 0o600 });
    fs.renameSync(temp, this.file);
  }
  candidate(event) {
    if (event.kind !== 'change' || event.manualOnly || !event.value) return null;
    const profile = this.getProfile();
    const section = inferSection(event.target.headings);
    const labelMatch = matchField(event.target.labels, section);
    const matches = profile.library.flatMap(g => g.records.flatMap(r => r.fields.filter(f => f.value === event.value).map(f => ({ group: g.id, record: r.index, key: f.key, label: `${g.label} / ${f.label}` }))));
    const scoped = matches.filter(m => (!section || m.group === section) && (!labelMatch || (m.group === labelMatch.groupId && m.key === labelMatch.key)));
    if (scoped.length === 1) return { ...scoped[0], reason: '字段语义与资料值匹配', status: 'needs-confirmation' };
    if (labelMatch) return { group: labelMatch.groupId, key: labelMatch.key, record: this.session.selections[labelMatch.groupId] || 0, label: `${groups[labelMatch.groupId].label} / ${labelMatch.spec.label}`, reason: '字段名匹配，输入值需核对', status: 'needs-confirmation' };
    return null;
  }
  receive(source, raw) {
    if (!this.active || !this.session || raw?.sessionId !== this.session.id || source.page !== this.page) return;
    let frameSite; try { frameSite = pageIdentity(source.frame.url()); } catch { return; }
    const inheritedFrame = source.frame.url() === 'about:blank' || source.frame.url() === 'about:srcdoc';
    if (frameSite.origin !== this.session.site.origin && !inheritedFrame) return;
    if (!['click','change','state'].includes(raw.kind)) return;
    if (this.session.events.length >= 4000) { this.active = false; this.session.status = 'limit-reached'; this.error = '本次教学已达记录上限，请结束本次教学，再开启下一段。'; this.persist(); this.notify(); return; }
    const str = (v, n = 180) => typeof v === 'string' ? v.slice(0, n) : '';
    const list = v => Array.isArray(v) ? v.slice(0, 5).map(s => str(s)) : [];
    const target = raw.target ? { selector: str(raw.target.selector, 1500), tag: str(raw.target.tag, 20), type: str(raw.target.type, 30), role: str(raw.target.role, 30), labels: list(raw.target.labels), headings: list(raw.target.headings) } : undefined;
    if (target) Object.assign(target, { title: str(raw.target.title), ariaLabel: str(raw.target.ariaLabel), component: str(raw.target.component, 30), classes: list(raw.target.classes) });
    if (target && (/password|file|hidden/.test(target.type) || /密码|验证码|口令|银行卡|otp|password|captcha|token|secret/i.test(target.labels.join(' ')))) return;
    const event = { id: crypto.randomUUID(), at: new Date().toISOString(), kind: raw.kind, frame: inheritedFrame ? { origin: this.session.site.origin, path: 'embedded' } : frameSite,
      actionId: str(raw.actionId, 30), afterAction: str(raw.afterAction, 30), target, manualOnly: !!raw.manualOnly };
    if (raw.kind === 'click') event.text = str(raw.text, 100);
    if (raw.kind === 'change') { event.value = str(raw.value, 20000); event.candidate = this.candidate(event); }
    if (raw.kind === 'state') {
      event.state = { fields: (Array.isArray(raw.state?.fields) ? raw.state.fields : []).slice(0,100).map(f => ({ selector: str(f.selector,1500), label: str(f.label), type: str(f.type,30) })),
        dialogs: (Array.isArray(raw.state?.dialogs) ? raw.state.dialogs : []).slice(0,8).map(d => ({ selector: str(d.selector,1500), title: str(d.title) })) };
    }
    this.session.events.push(event);
    try { this.persist(); } catch { this.active = false; this.error = '本地记录写入失败，已停止接收；请结束教学并检查磁盘。'; this.session.status = 'error'; }
    this.notify();
  }
  async install(frame) {
    const identity = pageIdentity(frame.url());
    if (identity.origin !== this.session.site.origin && !['about:blank','about:srcdoc'].includes(frame.url())) return false;
    await frame.evaluate(installObserver, { sessionId: this.session.id, bridge: this.bridge }); return true;
  }
  async start({ selections = {} } = {}) {
    if (this.active) return this.view();
    this.page = await this.getPage();
    const site = pageIdentity(this.page.url());
    if (!/^https?:$/.test(new URL(this.page.url()).protocol) && site.origin !== 'null') throw new Error('请先打开要教学的网页');
    this.session = { version: 2, learningPolicy: '操作示范仅学习控件和字段映射；填写值以之前确认的知识库为准，示范日期不覆盖事实。', id: crypto.randomUUID(), startedAt: new Date().toISOString(), status: 'recording', site,
      selections: Object.fromEntries(Object.entries(selections).filter(([g,i]) => groups[g] && Number.isInteger(i) && i >= 0)),
      note: '私人观察记录；不是已验证的自动重放脚本。个人输入只作待确认，不覆盖事实库。', events: [] };
    this.file = path.join(this.directory, `教学-${this.session.startedAt.replace(/[:.]/g,'-')}-${this.session.id.slice(0,8)}.json`);
    this.error = ''; this.active = true; this.persist();
    try {
      if (!this.boundPages.has(this.page)) { await this.page.exposeBinding(this.bridge, (source, event) => this.receive(source, event)); this.boundPages.add(this.page); }
      let installed = 0;
      for (const frame of this.page.frames()) { try { if (await this.install(frame)) installed++; } catch {} }
      if (!installed) throw new Error('未能接入页面，请等待页面加载后重试');
      this.onNavigation = frame => {
        if (!this.active) return;
        if (frame === this.page.mainFrame() && pageIdentity(frame.url()).origin !== this.session.site.origin) {
          this.stop('跨站跳转，教学已停止').catch(() => {}); return;
        }
        this.install(frame).catch(() => { this.error = '有页面框架未能接入，请检查该部分是否有新增记录'; this.notify(); });
      };
      this.onClose = () => { this.active = false; this.session.status = 'interrupted'; this.session.endedAt = new Date().toISOString(); this.session.endReason = '网页关闭'; this.persist(); this.notify(); };
      this.page.on('framenavigated', this.onNavigation); this.page.on('close', this.onClose);
    } catch (error) { this.active = false; this.session.status = 'error'; this.error = error.message; this.persist(); this.notify(); throw error; }
    this.notify(); return this.view();
  }
  async stop(reason = '用户结束教学') {
    if (!this.session) return this.view();
    // Flush final text still focused in the website before turning receiving off.
    for (const frame of this.page?.frames() || []) { try { await frame.evaluate(() => window.__qiuzhaoTeachingObserver?.stop()); } catch {} }
    this.active = false;
    if (this.onNavigation) this.page.off('framenavigated', this.onNavigation);
    if (this.onClose) this.page.off('close', this.onClose);
    this.session.status = 'recorded'; this.session.endedAt = new Date().toISOString(); this.session.endReason = reason;
    persistSummary(this.workspace, this.session);
    this.persist(); this.notify(); return this.view();
  }
  review() {
    if (!this.session) {
      const files = fs.existsSync(this.directory) ? fs.readdirSync(this.directory).filter(f => /^教学-.*\.json$/.test(f)).sort().reverse() : [];
      if (files[0]) {
        this.file = path.join(this.directory, files[0]); this.session = JSON.parse(fs.readFileSync(this.file,'utf8'));
        if (this.session.status === 'recording') { this.session.status = 'interrupted'; this.session.endReason = '上次进程中断，已恢复落盘记录'; this.persist(); }
      }
    }
    return { ...this.view(), learning: this.session ? summarize(this.session) : null, events: this.session?.events || [], choices: Object.entries(groups).flatMap(([group,g]) => Object.entries(g.fields).map(([key,f]) => ({ id: `${group}.${key}`, label: `${g.label} / ${f.label}` }))) };
  }
  confirm({ eventId, field }) {
    if (this.active) throw new Error('先结束教学，再确认字段规则');
    const event = this.session?.events.find(e => e.id === eventId && e.kind === 'change');
    const [group,key] = String(field).split('.');
    if (!event || !groups[group]?.fields[key] || event.manualOnly) throw new Error('请选择有效的资料字段');
    const directory = path.join(this.workspace,'知识库','06-网站适配'); fs.mkdirSync(directory,{recursive:true});
    const file = path.join(directory, 'learned-fields.json');
    const rules = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file,'utf8')) : [];
    const rule = { site: this.session.site, frame: event.frame, selector: event.target.selector, tag: event.target.tag, type: event.target.type,
      labels: event.target.labels, headings: event.target.headings, group, key, confirmedAt: new Date().toISOString(), status: 'user-confirmed' };
    const existing = rules.findIndex(r => JSON.stringify(r.site) === JSON.stringify(rule.site) && JSON.stringify(r.frame) === JSON.stringify(rule.frame) && r.selector === rule.selector);
    if (existing >= 0) rules[existing] = rule; else rules.push(rule);
    fs.writeFileSync(file + '.tmp', JSON.stringify(rules,null,2)); fs.renameSync(file + '.tmp',file);
    event.confirmedField = field; this.persist(); return this.review();
  }
  async command({ action, ...options }) {
    if (action === 'start') return this.start(options);
    if (action === 'stop') return this.stop();
    if (action === 'review') return this.review();
    if (action === 'confirm') return this.confirm(options);
    if (action === 'status') return this.view();
    throw new Error('未知教学操作');
  }
}
module.exports = { TeachingRecorder, installObserver, pageIdentity };
