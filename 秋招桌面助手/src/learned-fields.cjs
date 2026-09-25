const fs = require('node:fs');
const path = require('node:path');
const { groups, normalize } = require('./rules.cjs');
function identity(raw) { const u = new URL(raw); return { origin: u.origin, path: u.pathname, route: /^#\/[\w/-]*$/.test(u.hash) ? u.hash : '' }; }
function loadLearnedFields(workspace) {
  try { const records = JSON.parse(fs.readFileSync(path.join(workspace,'知识库','06-网站适配','learned-fields.json'),'utf8')); return Array.isArray(records) ? records : []; } catch { return []; }
}
function learnedMatch(rules, url, control) {
  const site = identity(url), frame = identity(control.frameUrl);
  const match = rules.filter(r => r.status === 'user-confirmed' && r.site.origin === site.origin && r.site.path === site.path && r.site.route === site.route
    && r.frame.origin === frame.origin && r.frame.path === frame.path && (r.frame.route || '') === frame.route
    && r.selector === control.selector && r.tag === control.tag && r.type === control.type
    && r.labels.length > 0 && r.labels.some(l => control.labels.some(c => normalize(c) === normalize(l)))
    && groups[r.group]?.fields[r.key]);
  return match.length === 1 ? { groupId: match[0].group, key: match[0].key, spec: groups[match[0].group].fields[match[0].key] } : null;
}
module.exports = { loadLearnedFields, learnedMatch };
