'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { groups } = require('../rules.cjs');
function hash(text) { return createHash('sha256').update(text).digest('hex'); }
function atomicWrite(filename, data, beforeReplace = () => {}) {
  fs.mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  let fd;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, data); fs.fsyncSync(fd); fs.closeSync(fd); fd = undefined;
    beforeReplace();
    fs.renameSync(temporary, filename);
  } finally { if (fd !== undefined) fs.closeSync(fd); if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
}
function validateProfile(input) {
  if (!input || input.schemaVersion !== 1 || !input.values || typeof input.values !== 'object' || Array.isArray(input.values)) throw Error('资料结构不正确');
  const candidate = JSON.parse(JSON.stringify(input));
  if (Buffer.byteLength(JSON.stringify(candidate)) > 1024 * 1024) throw Error('资料过大');
  for (const [group, records] of Object.entries(candidate.values)) {
    if (!Object.hasOwn(groups, group)) throw Error('资料包含不支持的分组');
    if (!Array.isArray(records) || records.length > 200) throw Error('每组资料必须是最多 200 条记录的列表');
    for (const record of records) {
      if (!record || typeof record !== 'object' || Array.isArray(record)) throw Error('资料记录无效');
      for (const [key, value] of Object.entries(record)) {
        if (['__proto__', 'constructor', 'prototype'].includes(key) || !['string','number','boolean'].includes(typeof value) || String(value).length > 50000) throw Error('资料字段值无效');
      }
    }
  }
  if (!Array.isArray(candidate.values.basic) || candidate.values.basic.length !== 1) throw Error('基本信息需要且只能有一条记录');
  if (typeof candidate.demo !== 'boolean') throw Error('资料必须明确标注演示状态');
  return candidate;
}
function createProfileService(workspace) {
  const filename = path.join(workspace, '知识库/profile.json');
  const revisions = path.join(workspace, '.workbench/profile-history');
  function raw() {
    try { const text = fs.readFileSync(filename, 'utf8').replace(/^\uFEFF/, ''); return { text, hash: hash(text), missing: false }; }
    catch (error) { if (error.code === 'ENOENT') return { text: '', hash: 'missing', missing: true }; throw error; }
  }
  function status() { const current = raw(); try { validateProfile(JSON.parse(current.text)); return { hash: current.hash, valid: true }; } catch { return { hash: current.hash, valid: false, missing: current.missing }; } }
  function read() {
    const { text } = raw();
    return { profile: validateProfile(JSON.parse(text)), hash: hash(text), fields: Object.fromEntries(Object.entries(groups).map(([key, group]) => [key, { label: group.label, fields: Object.fromEntries(Object.entries(group.fields).map(([id, field]) => [id, { label: field.label, manual: !!field.manual, date: !!field.date }])) }])) };
  }
  function remember(current) {
    fs.mkdirSync(revisions, { recursive: true, mode: 0o700 });
    const target = path.join(revisions, `${current.hash}.json`);
    if (!fs.existsSync(target)) atomicWrite(target, JSON.stringify({ hash: current.hash, savedAt: new Date().toISOString(), profile: current.profile }));
  }
  function save(input, expectedHash, { recovery = false } = {}) {
    fs.mkdirSync(revisions, { recursive: true, mode: 0o700 });
    const lockPath = path.join(revisions, 'write.lock');
    const ticket = path.join(revisions, `lock-${randomUUID()}.tmp`);
    // Publish a fully written ownership ticket atomically; no empty lock crash window.
    fs.writeFileSync(ticket, String(process.pid), { flag: 'wx', mode: 0o600 });
    let acquired = false;
    try {
      try { fs.linkSync(ticket, lockPath); acquired = true; }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const observed = fs.statSync(lockPath);
        let owner;
        try { owner = Number(fs.readFileSync(lockPath, 'utf8')); } catch {}
        let abandoned = !Number.isInteger(owner) || owner <= 0;
        if (!abandoned) {
          try { process.kill(owner, 0); }
          catch (probe) { abandoned = probe.code === 'ESRCH'; }
        } else abandoned = Date.now() - observed.mtimeMs > 60_000;
        if (abandoned && fs.statSync(lockPath).ino === observed.ino) {
          fs.unlinkSync(lockPath);
          return save(input, expectedHash, { recovery });
        }
        throw Error('个人资料正在另一个进程中保存，请稍后重试；异常空锁将在一分钟后恢复');
      }
      const current = raw();
      if (!expectedHash || expectedHash !== current.hash) throw Error('个人资料已变化，请刷新后重新核对');
      const profile = validateProfile(input);
      profile.updated = new Date().toISOString();
      let before;
      try { before = validateProfile(JSON.parse(current.text)); }
      catch { if (!recovery) throw Error('当前资料已损坏，请从历史版本恢复'); }
      if (before) remember({ profile: before, hash: current.hash });
      else if (!current.missing) atomicWrite(path.join(revisions, `${current.hash}.corrupt`), current.text);
      atomicWrite(filename, JSON.stringify(profile, null, 2) + '\n', () => {
        if (raw().hash !== current.hash) throw Error('保存期间资料被外部修改，未覆盖；请刷新后重试');
      });
      return read();
    } finally {
      if (acquired && fs.existsSync(lockPath) && fs.statSync(lockPath).ino === fs.statSync(ticket).ino) fs.unlinkSync(lockPath);
      fs.unlinkSync(ticket);
    }
  }
  function history() {
    if (!fs.existsSync(revisions)) return [];
    return fs.readdirSync(revisions).filter(name => /^[a-f0-9]{64}\.json$/.test(name)).map(name => {
      try {
        const entry = JSON.parse(fs.readFileSync(path.join(revisions, name), 'utf8'));
        validateProfile(entry.profile);
        if (entry.hash !== name.slice(0, -5) || typeof entry.savedAt !== 'string' || !Number.isFinite(Date.parse(entry.savedAt))) throw Error('历史元数据损坏');
        return { hash: entry.hash, savedAt: entry.savedAt, updated: entry.profile.updated, demo: entry.profile.demo, corrupt: false };
      } catch { return { hash: name.slice(0, -5), savedAt: '', corrupt: true }; }
    }).sort((a,b) => b.savedAt.localeCompare(a.savedAt));
  }
  function restore(revisionHash, expectedHash) {
    if (!/^[a-f0-9]{64}$/.test(revisionHash)) throw Error('资料版本标识无效');
    const previous = JSON.parse(fs.readFileSync(path.join(revisions, revisionHash + '.json'), 'utf8'));
    return save(previous.profile, expectedHash, { recovery: true });
  }
  function merge(changes, expectedHash) {
    const current = read();
    if (!Array.isArray(changes) || changes.length > 2000) throw Error('资料修改清单无效');
    const candidate = JSON.parse(JSON.stringify(current.profile));
    const seen = new Set();
    for (const change of changes) {
      if (!change || !Object.hasOwn(groups, change.group) || !Object.hasOwn(groups[change.group].fields, change.key) || !Number.isInteger(change.index) || change.index < 0 || typeof change.value !== 'string') throw Error('待采用字段无效');
      const identity = `${change.group}/${change.index}/${change.key}`;
      if (seen.has(identity)) throw Error('存在重复字段修改');
      seen.add(identity);
      const records = candidate.values[change.group] || (candidate.values[change.group] = []);
      if (change.index > records.length) throw Error('新增记录索引无效');
      if (change.index === records.length) records.push({});
      if (String(records[change.index][change.key] ?? '') !== String(change.before ?? '')) throw Error('待合并字段已变化，请重新核对');
      records[change.index][change.key] = change.value;
    }
    return save(candidate, expectedHash);
  }
  return { read, status, save, history, restore, merge };
}
module.exports = { createProfileService, validateProfile, atomicWrite, hash };
