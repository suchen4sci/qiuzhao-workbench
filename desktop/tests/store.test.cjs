const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openStore } = require('../src/services/store.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'workbench-store-'));
  const store = openStore(root);
  t.after(() => { store.close(); fs.rmSync(root, { recursive: true, force: true }); });
  return { store, root };
}
test('persistent revisions reject stale writes and a failed multi-record operation rolls back', t => {
  const { store } = fixture(t);
  const first = store.put('plans', { title: '完成申请' });
  const second = store.put('plans', { ...first, title: '修改申请' }, { expectedRevision: first.revision });
  assert.throws(() => store.put('plans', first, { expectedRevision: first.revision }), { code: 'REVISION_CONFLICT' });
  assert.throws(() => store.transaction(() => { store.put('tasks', { title: '不应保留' }); throw Error('模拟中断'); }));
  assert.equal(store.list('tasks').length, 0);
  assert.equal(store.get('plans', first.id).title, second.title);
});
test('full restore rejects incomplete backups and invalidates open editors', t => {
  const { store } = fixture(t);
  const first = store.put('notes', { text: '保留笔记' });
  const backup = store.exportData();
  const updated = store.put('notes', { ...first, text: '临时修改' }, { expectedRevision: first.revision });
  assert.throws(() => store.restoreData({ ...backup, collections: { notes: [] } }), /不完整/);
  assert.equal(store.get('notes', first.id).text, '临时修改');
  store.restoreData(backup);
  assert.equal(store.get('notes', first.id).text, '保留笔记');
  assert.throws(() => store.put('notes', updated, { expectedRevision: updated.revision }), { code: 'REVISION_CONFLICT' });
});
test('database survives reopen and blocks malformed records without partial mutations', t => {
  const { store, root } = fixture(t);
  const note = store.put('notes', { text: '可恢复' });
  store.close();
  const reopened = openStore(root);
  try {
    assert.equal(reopened.get('notes', note.id).text, '可恢复');
    assert.throws(() => reopened.put('unknown', {}));
    assert.throws(() => reopened.put('notes', { id: '../secret' }));
    const backup = reopened.exportData();
    backup.collections.notes.push(backup.collections.notes[0]);
    assert.throws(() => reopened.restoreData(backup), /重复/);
    assert.equal(reopened.list('notes').length, 1);
  } finally { reopened.close(); }
});
test('restore/delete/recreate cannot resurrect a revision accepted by an old editor', t => {
  const { store } = fixture(t), empty = store.exportData();
  const first = store.put('notes', { id: 'stable', text: '原笔记' });
  const oldBackup = store.exportData();
  const stale = store.put('notes', { ...first, text: '编辑中' }, { expectedRevision: first.revision });
  store.restoreData(empty); store.restoreData(oldBackup);
  assert.ok(store.get('notes', first.id).revision > stale.revision);
  assert.throws(() => store.put('notes', stale, { expectedRevision: stale.revision }), { code: 'REVISION_CONFLICT' });
  const current = store.get('notes', first.id);
  store.remove('notes', current.id, current.revision);
  assert.ok(store.put('notes', { id: current.id, text: '重新创建' }).revision > current.revision);
});
test('async continuation of a rejected transaction cannot mutate after rollback', async t => {
  const { store } = fixture(t);
  let continuation;
  assert.throws(() => store.transaction(() => {
    store.put('notes', { text: '将回滚' });
    continuation = Promise.resolve().then(() => store.put('notes', { text: '延迟写入' }));
    return continuation;
  }), /异步/);
  await assert.rejects(continuation, /事务已结束/);
  assert.equal(store.list('notes').length, 0);
  assert.throws(() => store.transaction(async () => store.put('notes', { text: '不得执行' })), /异步/);
});
test('nested transactions use savepoints and reject asynchronous partial commits', async t => {
  const { store } = fixture(t);
  let continuation;
  store.transaction(() => {
    store.put('notes', { id: 'outer', text: '有效外层' });
    assert.throws(() => store.transaction(async () => store.put('notes', { id: 'async', text: '不能运行' })), /异步/);
    assert.throws(() => store.transaction(() => {
      store.put('notes', { id: 'prefix', text: '内部回滚' });
      continuation = Promise.resolve().then(() => store.put('notes', { id: 'suffix', text: '禁止逃逸' }));
      return continuation;
    }), /异步/);
    assert.equal(store.list('notes').length, 1);
  });
  await assert.rejects(continuation, /事务已结束/);
  assert.deepEqual(store.list('notes').map(x => x.id), ['outer']);
});
