function safeUrl(raw) {
  const u = new URL(raw);
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('请先打开招聘网站');
  u.username = ''; u.password = ''; u.search = '';
  if (!/^#\/[\w/-]*$/.test(u.hash)) u.hash = '';
  return u.href;
}
async function importJob(request, api) {
  const company = String(request.company || '').trim(), role = String(request.role || '').trim();
  if (!company || !role) throw new Error('请填写公司和具体岗位');
  if (company.length > 150 || role.length > 200) throw new Error('公司或岗位名称过长');
  if (request.confirmed !== true) throw new Error('请确认已经完成投递');
  const date = String(request.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error('请核对投递日期');
  const link = safeUrl(request.url);
  const { jobs } = await api('/api/jobs');
  const matches = jobs.filter(j => j['公司名称'].trim() === company && j['投递岗位'].trim() === role);
  if (matches.length > 1) throw new Error('工作台有多条同名岗位，请先在工作台核对');
  const now = new Date().toISOString();
  const note = '填表助手导入：本人确认已投递；未自动核验网站提交结果。';
  if (matches.length) {
    const old = matches[0];
    const patch = { '状态核验日期': now };
    if (['待确认岗位','待投递','填写中','已保存','已投递',''].includes(old['当前状态'] || '')) patch['当前状态'] = '已投递';
    if (!old['投递日期']) patch['投递日期'] = date;
    if (!old['投递链接']) patch['投递链接'] = link;
    if (!(old['备注'] || '').includes(note)) patch['备注'] = [old['备注'], note].filter(Boolean).join('\n');
    return { ...(await api(`/api/jobs/${encodeURIComponent(old['记录ID'])}`, 'PATCH', { patch, expectedVersion: old.__version })), updated: true };
  }
  return { ...(await api('/api/jobs', 'POST', { '公司名称': company, '投递岗位': role, '当前状态': '已投递', '投递日期': date,
    '投递链接': link, '下一步行动': '关注招聘进度通知', '招聘信息': '校园招聘（本人确认）', '简历附件': '待核验', '备注': note })), updated: false };
}
module.exports = { safeUrl, importJob };
