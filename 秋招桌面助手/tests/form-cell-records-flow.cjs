const { _electron } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { ensureFormCellRecords } = require('../src/form-cell-records.cjs');
const field = (label, content) => `<div class="ant-form-item"><div class="ant-form-item-label"><label>${label}<span class="labelRequired">*</span><span class="remarkShow">?</span></label></div><div>${content}</div></div>`;
const row = (label, name = '', content = '', extra = '') => `<div class="form-cell-inner" ${extra}>${field(label, `<input data-identity value="${name}">`)}${content}</div>`;
const section = (title, label, rows) => `<section class="form-cell" data-identity-label="${label}"><div class="tit-wrap"><div class="tit"><p>${title}</p></div></div><div class="rows">${rows}</div><button class="add-more-btn" type="button">添加新的${title}</button></section>`;
const profile = { values: {
  family: [{ name: '测试父亲' }, { name: '测试母亲' }],
  projects: [{ name: '项目甲' }, { name: '项目乙' }, { name: '不自动添加的项目' }],
  internship: [{ company: '实习单位甲' }],
}, autoProjectNames: ['项目甲', '项目乙'] };
(async () => {
  const env = { ...process.env, QIUZHAO_TEST: '1', QIUZHAO_USER_DATA: fs.mkdtempSync(path.join(os.tmpdir(), 'form-cell-records-')) }; delete env.ELECTRON_RUN_AS_NODE;
  const app = await _electron.launch({ executablePath: require('electron'), args: [path.resolve('.')], env });
  try {
    await app.firstWindow(); let page;
    for (let i = 0; i < 50; i++) { page = app.context().pages().find(p => p.url().includes('/fixtures/demo.html')); if (page) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert.ok(page, 'isolated fixture guest exists');
    const mount = async html => {
      await page.setContent(html);
      await page.evaluate(() => {
        window.addClicks = 0;
        document.querySelectorAll('.add-more-btn').forEach(button => button.onclick = () => {
          window.addClicks++;
          const section = button.closest('.form-cell'), label = section.dataset.identityLabel;
          const row = document.createElement('div'); row.className = 'form-cell-inner';
          row.innerHTML = '<div class="ant-form-item"><div class="ant-form-item-label"><label>' + label + '<span class="labelRequired">*</span><span class="remarkShow">?</span></label></div><input data-identity></div>';
          section.querySelector('.rows').append(row);
        });
      });
    };
    await mount(section('家庭关系', '姓名', row('姓名')) + section('项目经历', '项目名称', row('项目名称')) + section('实习经历', '企业名称', row('企业名称', '实习单位甲', field('工作内容', '<textarea>完整已有正文</textarea>'))));
    const first = await ensureFormCellRecords(page, profile);
    assert.equal(first.pending.length, 0, JSON.stringify(first)); assert.equal(first.added.length, 4);
    assert.deepEqual(await page.locator('section').nth(0).locator('[data-identity]').evaluateAll(nodes => nodes.map(n => n.value)), ['测试父亲', '测试母亲']);
    assert.deepEqual(await page.locator('section').nth(1).locator('[data-identity]').evaluateAll(nodes => nodes.map(n => n.value)), ['项目甲', '项目乙']);
    assert.equal(await page.evaluate(() => window.addClicks), 2);
    assert.equal(await page.locator('textarea').inputValue(), '完整已有正文');
    const again = await ensureFormCellRecords(page, profile); assert.equal(again.added.length, 0); assert.equal(again.pending.length, 0); assert.equal(await page.evaluate(() => window.addClicks), 2);

    await mount(section('实习经历', '企业名称', ''));
    const internship = await ensureFormCellRecords(page, profile); assert.equal(internship.pending.length, 0, JSON.stringify(internship)); assert.equal(internship.added.length, 1); assert.equal(await page.locator('[data-identity]').inputValue(), '实习单位甲');
    assert.equal((await ensureFormCellRecords(page, profile)).added.length, 0);

    await mount(section('家庭关系', '姓名', row('姓名') + row('姓名')));
    const many = await ensureFormCellRecords(page, profile); assert.match(many.pending[0], /多条/); assert.equal(many.added.length, 0); assert.equal(await page.evaluate(() => window.addClicks), 0);
    assert.deepEqual(await page.locator('[data-identity]').evaluateAll(nodes => nodes.map(n => n.value)), ['', '']);

    for (const content of [field('工作单位', '<input value="已有但未确认归属的单位">'), field('关系', '<div class="ant-select-selection-selected-value">母亲</div>'), field('关系', '<select><option value="mother" selected>母亲</option></select>'), field('关系', '<label><input type="radio" checked>母亲</label>')]) {
      await mount(section('家庭关系', '姓名', row('姓名', '', content)));
      const partial = await ensureFormCellRecords(page, profile); assert.match(partial.pending[0], /已有内容/); assert.equal(partial.added.length, 0); assert.equal(await page.locator('[data-identity]').inputValue(), ''); assert.equal(await page.evaluate(() => window.addClicks), 0);
    }
    await mount(section('家庭关系', '姓名', '<div class="form-cell-inner">' + field('工作单位', '<input value="无法识别身份的记录">') + '</div>'));
    const unknown = await ensureFormCellRecords(page, profile); assert.match(unknown.pending[0], /身份控件/); assert.equal(await page.evaluate(() => window.addClicks), 0);

    await mount(section('家庭关系', '姓名', row('姓名', '测试父亲') + row('姓名', '测试父亲')));
    const duplicate = await ensureFormCellRecords(page, profile); assert.match(duplicate.pending[0], /重复记录/); assert.equal(await page.evaluate(() => window.addClicks), 0);

    await mount(section('家庭关系', '姓名', row('姓名', '', '', 'style="display:none"') + row('姓名')));
    const hidden = await ensureFormCellRecords(page, profile); assert.equal(hidden.pending.length, 0); assert.equal(hidden.added.length, 2); assert.equal(await page.locator('.form-cell-inner:visible').count(), 2); assert.equal(await page.locator('.form-cell-inner[style] input').inputValue(), '');
    const verified = require('../src/form-cell-verified.cjs');
    const verifiedRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'form-cell-verified-'));
    const directory = path.join(verifiedRoot, '知识库/06-网站适配'); fs.mkdirSync(directory, {recursive:true});
    const ruleFile = path.join(directory, 'FormCell逐字段已核验.json');
    const url = new URL(page.url());
    const reviewed = {status:'verified', origin:url.origin, path:url.pathname, records:[{section:'家庭关系', identity:{姓名:'测试父亲'}, fields:[{label:'工作单位',values:['测试单位']}]}]};
    fs.writeFileSync(ruleFile, JSON.stringify([reviewed]));
    await mount(section('家庭关系', '姓名', row('姓名','测试母亲',field('工作单位','<input value="母亲原单位">')) + row('姓名','测试父亲',field('工作单位','<input>'))));
    await verified.prepare(page,{workspaceRoot:verifiedRoot});
    assert.equal(await page.locator('.form-cell-inner').nth(1).locator('input').nth(1).inputValue(),'测试单位');
    assert.equal(await page.locator('.form-cell-inner').nth(0).locator('input').nth(1).inputValue(),'母亲原单位');
    await verified.prepare(page,{workspaceRoot:verifiedRoot});
    assert.equal(await page.locator('.form-cell-inner').count(),2);
    await mount(section('家庭关系', '姓名',row('姓名','测试父亲',field('工作单位','<input>'))+row('姓名','测试父亲',field('工作单位','<input>'))));
    await verified.prepare(page,{workspaceRoot:verifiedRoot});
    assert.deepEqual(await page.locator('input:not([data-identity])').evaluateAll(es=>es.map(e=>e.value)),['','']);
    fs.writeFileSync(ruleFile,JSON.stringify([{...reviewed,path:'/another-employer'}]));
    await mount(section('家庭关系', '姓名',row('姓名','测试父亲',field('工作单位','<input>'))));
    await verified.prepare(page,{workspaceRoot:verifiedRoot});
    assert.equal(await page.locator('input:not([data-identity])').inputValue(),'');
    console.log(JSON.stringify({ passed: true, families: 2, projects: 2, existingPreserved: true, repeatedNoDuplicates: true, ambiguousEmptyStopped: true, populatedUnnamedStopped: true, unknownIdentityStopped: true, hiddenTemplateIgnored: true, verifiedIdentityScopeAndRepeat: true }));
  } finally { await app.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
