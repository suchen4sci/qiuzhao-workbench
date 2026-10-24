const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
test('hot sidebar refresh and copy use displayed current profile, preserving record selection', async () => {
  const buttons = { refresh: {}, records: {}, search: { value: 'old query' } }, writes = [];
  let renders = 0, reads = 0;
  const current = { library: [{ id: 'family', records: [{ id: 'family:0', fields: [{ id: 'family:0:name', label: '姓名', value: 'fixture parent' }] }] }] };
  const context = { window: { fixtureBridge: async request => { assert.equal(request.mode, 'profile'); reads++; return current; } }, navigator: { clipboard: { writeText: async value => writes.push(value) } }, $: id => buttons[id], selections: {}, profile: null, renderLibrary: () => renders++, toast: () => {}, attempt: fn => fn() };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../src/ui/hot-profile.js'), 'utf8'), context);
  await context.window.installHotProfile('fixtureBridge'); assert.equal(reads, 1); assert.equal(renders, 1);
  const click = (selector, dataset) => buttons.records.onclick({ target: { closest: query => query === selector ? { dataset } : null } });
  await click('[data-copy]', { copy: 'family:0:name' }); assert.equal(writes[0], 'fixture parent');
  await click('[data-copy-record]', { copyRecord: 'family:0' }); assert.equal(writes[1], '姓名：fixture parent');
  await click('[data-select]', { select: 'family:0' }); assert.equal(context.selections.family, 0); assert.equal(buttons.search.value, '');
  await buttons.refresh.onclick(); assert.equal(reads, 2);
  await assert.rejects(click('[data-copy]', { copy: 'obsolete:field' }), /当前资料/);
  context.navigator.clipboard.writeText = async () => { throw new Error('denied'); };
  await assert.rejects(click('[data-copy]', { copy: 'family:0:name' }), /没有使用旧版资料替代/);
});
