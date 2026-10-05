const fs = require('node:fs');
const path = require('node:path');
function summarize(session) {
  const events = session.events || [];
  const openings = events.filter(e => e.kind === 'click' && /^添加$/.test((e.text || '').trim())).map(e => {
    const next = events.slice(events.indexOf(e) + 1).find(x => x.kind === 'state');
    return { selector: e.target.selector, headings: e.target.headings, expectedFields: next?.state?.fields?.map(f => f.label).filter(Boolean) || [], status: '待验证，不自动重复添加' };
  });
  const components = [...new Set(events.map(e => e.target?.component).filter(Boolean))];
  return { version: 1, site: session.site, sourceSession: session.id,
    policy: '示范值不覆盖知识库；执行时读取最新确认资料。保存、提交、删除不重放。',
    components, openings, capabilities: ['文本和原生日期直接填写', '原生下拉框精确匹配', '可访问下拉选项精确匹配', '旧版 Ant 日历按目标年月日选择并回读'],
    limitations: ['添加入口仅记录候选，避免重复新增经历', '学校、专业等多级联动尚需专门适配', '未识别控件停止，不盲试点击'] };
}
function persistSummary(workspace, session) {
  const summary = summarize(session);
  const dir = path.join(workspace, '知识库', '06-网站适配');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `教学流程-${session.id}.json`), JSON.stringify(summary, null, 2));
  return summary;
}
module.exports = { summarize, persistSummary };
