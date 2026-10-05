const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { candidatesFrom, validateMappings, suggestMappings, confirmMappings } = require('../src/ai-mapping.cjs');
const { createAISettings, validateSettings } = require('../src/ai-settings.cjs');
const { ensureWorkspace } = require('../src/workspace.cjs');
const { loadLearnedFields, learnedMatch } = require('../src/learned-fields.cjs');
const candidate = () => ({ id: 'field-1', status: 'pending', label: '用于国际交流的称呼', labels: ['用于国际交流的称呼'], headings: ['基本信息'], section: 'basic', tag: 'input', type: 'text', selector: '#international', frameUrl: 'https://site.test/form?token=private', recordIdentity: {} });
const good = { id: 'field-1', group: 'basic', key: 'englishName', confidence: 0.95, reason: '英文名' };
const temp = t => { const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qiuzhao-services-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true })); return dir; };

test('AI candidates exclude confirmed, populated, secret and unknown section fields', () => {
  const c = candidate();
  const scan = { items: [c, { ...c, id: 'known', match: {} }, { ...c, id: 'populated', hasValue: true }, { ...c, id: 'login', labels: ['验证码'] }, { ...c, id: 'unknown', section: null, headings: ['付款信息'] }] };
  assert.deepEqual(candidatesFrom(scan).map(c => c.id), ['field-1']);
});
test('AI mapping rejects fabricated keys, manual fields, cross sections and duplicate IDs', () => {
  for (const mapping of [{ ...good, key: 'madeUp' }, { ...good, key: 'idNumber' }, { ...good, group: 'education', key: 'school' }]) {
    assert.throws(() => validateMappings({ mappings: [mapping] }, [candidate()]));
  }
  assert.throws(() => validateMappings({ mappings: [good, good] }, [candidate()]));
  assert.deepEqual(validateMappings({ mappings: [{ ...good, confidence: 0.5 }] }, [candidate()]), []);
});
test('model receives metadata only; invalid HTTP responses never expose provider contents', async () => {
  let sent;
  const config = { enabled: true, baseUrl: 'http://127.0.0.1:1234/v1', model: 'test', apiKey: 'secret-key' };
  const fake = async (url, request) => { sent = JSON.parse(request.body); assert.equal(url, config.baseUrl + '/chat/completions'); assert.equal(request.redirect, 'error'); return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ mappings: [good] }) } }] }) }; };
  const c = { ...candidate(), observedValue: 'private-fact', recordIdentity: { name: 'private-name' } };
  assert.equal((await suggestMappings(config, [c], { fetchImpl: fake })).length, 1);
  const serialized = JSON.stringify(sent);
  for (const privateText of ['private-fact', 'private-name', 'private', 'secret-key', '#international', 'site.test']) assert.equal(serialized.includes(privateText), false);
  await assert.rejects(suggestMappings(config, [c], { fetchImpl: async () => ({ ok: false, status: 401, json: () => { throw Error('secret-key'); } }) }), /HTTP 401/);
  await assert.rejects(suggestMappings({ ...config, enabled: false }, [c], { fetchImpl: fake }), /未开启/);
});
test('confirmation rescans the page, persists only mappings, removes URL secrets and rejects stale changes', t => {
  const dir = temp(t), c = candidate(), url = c.frameUrl;
  const ticket = { url, candidates: [c], suggestions: validateMappings({ mappings: [good] }, [c]) };
  assert.throws(() => confirmMappings(dir, ticket, ['field-1'], { url: 'https://other.test', items: [c] }));
  assert.throws(() => confirmMappings(dir, ticket, ['field-1'], { url, items: [{ ...c, labels: ['手机号'] }] }));
  assert.equal(confirmMappings(dir, ticket, ['field-1'], { url, items: [c] }), 1);
  const rules = loadLearnedFields(dir); assert.equal(rules.length, 1);
  assert.equal(JSON.stringify(rules).includes('token'), false);
  assert.equal(learnedMatch(rules, url, c).key, 'englishName');
  confirmMappings(dir, ticket, ['field-1'], { url, items: [c] });
  assert.equal(loadLearnedFields(dir).length, 1);
  assert.ok(fs.existsSync(path.join(dir, '知识库/06-网站适配/learned-fields.json.bak')));
});
test('saved keys are encrypted, omitted from UI responses, retained on blank input and clearable', t => {
  const dir = temp(t);
  const storage = { isEncryptionAvailable: () => true, encryptString: s => Buffer.from(s.split('').reverse().join('')), decryptString: b => b.toString().split('').reverse().join('') };
  const settings = createAISettings(dir, storage), config = { enabled: true, baseUrl: 'https://api.test/v1', model: 'model' };
  assert.equal(settings.save({ ...config, apiKey: 'secret-123' }).hasKey, true);
  assert.equal(fs.readFileSync(path.join(dir, 'ai-settings.json'), 'utf8').includes('secret-123'), false);
  assert.equal(settings.publicSettings().apiKey, undefined);
  settings.save({ ...config, apiKey: '' }); assert.equal(settings.read().apiKey, 'secret-123');
  settings.save({ ...config, clearKey: true }); assert.equal(settings.read().apiKey, '');
  const unavailable = createAISettings(dir, { isEncryptionAvailable: () => false });
  assert.throws(() => unavailable.save({ ...config, apiKey: 'no-plaintext' }), /加密不可用/);
});
test('settings permit only secure cloud endpoints or explicit loopback models', () => {
  for (const baseUrl of ['http://remote.test/v1', 'https://user:pass@api.test', 'https://api.test?token=x']) assert.throws(() => validateSettings({ enabled: true, baseUrl, model: 'm' }));
  assert.equal(validateSettings({ enabled: true, baseUrl: 'http://localhost:11434/v1/', model: 'm' }).baseUrl, 'http://localhost:11434/v1');
});
test('packaged workspace is writable and personal initialization never receives demo facts', t => {
  const dir = temp(t), root = path.resolve(__dirname, '../..');
  const options = { root, resourcesPath: root, packaged: true, userData: path.join(dir, 'user') };
  const workspace = ensureWorkspace(options);
  assert.equal(JSON.parse(fs.readFileSync(path.join(workspace, '知识库/profile.json'))).demo, false);
  assert.equal(ensureWorkspace(options), workspace);
  const personal = ensureWorkspace({ ...options, configured: path.join(dir, 'personal') });
  const data = JSON.parse(fs.readFileSync(path.join(personal, '知识库/profile.json')));
  assert.equal(data.demo, false); assert.equal(data.values.basic[0].name, '');
  const occupied = path.join(dir, 'occupied'); fs.mkdirSync(occupied); fs.writeFileSync(path.join(occupied, 'keep.txt'), 'keep');
  assert.throws(() => ensureWorkspace({ ...options, configured: occupied }), /未覆盖/);
  assert.equal(fs.readFileSync(path.join(occupied, 'keep.txt'), 'utf8'), 'keep');
});
test('embedded dashboard accepts its own API, rejects cross-site mutation and allows iframe document loading', async t => {
  const dir = temp(t); process.env.QIUZHAO_WORKSPACE = dir;
  const { startDashboard } = await import('../../dashboard/server.mjs');
  let opened;
  const { server, url } = await startDashboard({openExternal: target => {opened=target;}}); t.after(() => server.close());
  assert.equal((await fetch(url, { headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 200);
  assert.equal((await fetch(url + 'api/jobs')).status, 200);
  const body = JSON.stringify({ 公司名称: '测试公司', 投递岗位: '开发' });
  assert.equal((await fetch(url + 'api/jobs', { method: 'POST', headers: { Origin: 'https://evil.test' }, body })).status, 403);
  assert.equal((await fetch(url + 'api/jobs', { method: 'POST', headers: { Origin: new URL(url).origin, 'Content-Type': 'application/json' }, body })).status, 201);
  const status = await new Promise((resolve, reject) => {
    const request = require('node:http').get(url + 'api/jobs', { headers: { Host: 'evil.test' } }, response => { response.resume(); resolve(response.statusCode); });
    request.on('error', reject);
  });
  assert.equal(status, 403);
  assert.equal((await fetch(url+'api/open-external',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'https://company.test/jobs'})})).status,200);
  assert.equal(opened,'https://company.test/jobs');
  assert.equal((await fetch(url+'api/open-external',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'file:///etc/passwd'})})).status,400);
});
test('site plans do not invent personal degree, language ability or salary for an empty workspace', t => {
  const dir = temp(t), root = path.resolve(__dirname, '../..');
  const workspace = ensureWorkspace({ root, userData: dir, resourcesPath: root, packaged: false, configured: path.join(dir, 'blank') });
  const profile = require('../src/profile.cjs').loadProfile(workspace);
  const plans = require('../src/zhaopin.cjs').plans(profile);
  const intent = plans.find(plan => plan.section === '求职意向');
  assert.equal(intent.values['最低薪资'], undefined); assert.equal(intent.values['最高薪资'], undefined);
  assert.equal(plans.some(plan => plan.section === '语言能力'), false);
  fs.writeFileSync(path.join(workspace, '知识库/profile.json'), JSON.stringify({ schemaVersion: 1, values: { basic: [null] } }));
  assert.throws(() => require('../src/profile.cjs').loadProfile(workspace), /资料对象数组/);
});
