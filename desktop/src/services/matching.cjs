'use strict';
const DIMENSIONS = ['route', 'nature', 'direction', 'city', 'industry', 'keyword', 'workMode', 'organization'];
const ROUTES = ['enterprise', 'civil', 'public', 'postgraduate'];
const ROUTE_LABELS = { enterprise: '企业求职', civil: '考公', public: '事业单位', postgraduate: '考研' };
const ALIASES = {
  '技术': ['技术','研发','开发','软件','算法','数据','工程师','测试','运维','信息技术','计算机','IT'],
  '销售': ['销售','商务','客户经理','业务拓展','BD','售前'],
  '产品': ['产品','产品经理','用户研究'],
  '北京': ['北京','北京市'], '上海': ['上海','上海市'], '深圳': ['深圳','深圳市'],
  '私企': ['私企','民营','民营企业'], '国企': ['国企','央企','国有企业'], '外企': ['外企','外商独资','合资'],
};
function normalize(value) { return String(value ?? '').normalize('NFKC').trim().toLowerCase(); }
function tokens(value) { return Array.isArray(value) ? value.map(normalize).filter(Boolean) : value === undefined || value === null || value === '' ? [] : [normalize(value)]; }
function values(input) {
  if (!Array.isArray(input) || input.length > 40 || input.some(x => typeof x !== 'string' || !x.trim() || x.length > 120)) throw Error('每个条件请选择有效的标签');
  return [...new Set(input.map(x => x.trim()))];
}
function conditions(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw Error('筛选条件格式错误');
  const result = {};
  for (const [key, value] of Object.entries(input)) {
    if (!DIMENSIONS.includes(key)) throw Error('未知筛选维度');
    result[key] = values(value);
    if (key === 'route' && result[key].some(x => !ROUTES.includes(x))) throw Error('未知发展路线');
  }
  return result;
}
function validatePreferences(input) {
  if (!input || !Array.isArray(input.plans) || input.plans.length > 20) throw Error('最多保存 20 个搜索方案');
  const ids = new Set();
  const plans = input.plans.map((plan, index) => {
    const id = typeof plan.id === 'string' ? plan.id : `plan-${index + 1}`;
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || ids.has(id)) throw Error('搜索方案标识重复或无效');
    ids.add(id);
    return { id, name: String(plan.name || `方案 ${index + 1}`).slice(0,80), conditions: conditions(plan.conditions), preferred: conditions(plan.preferred) };
  });
  const notification = input.notification || {};
  if (notification.hour !== undefined && (!Number.isInteger(notification.hour) || notification.hour < 0 || notification.hour > 23)) throw Error('摘要时间无效');
  return { plans, global: conditions(input.global), excluded: conditions(input.excluded), notification: { enabled: notification.enabled !== false, hour: notification.hour ?? 9 } };
}
function dimensionValues(opportunity, dimension) {
  if (dimension === 'keyword') return tokens([opportunity.title, opportunity.description, ...(opportunity.tags || [])]);
  return tokens(opportunity[dimension]);
}
function matchesTag(tag, actual, dimension) {
  const sought = normalize(tag);
  const alternatives = [sought, ...(ALIASES[tag] || []).map(normalize)];
  return actual.some(value => alternatives.some(term => dimension === 'keyword' || dimension === 'direction' ? value.includes(term) : value === term));
}
function assessConditions(spec, opportunity) {
  const reasons = [], unknown = [], mismatch = [];
  for (const [dimension, wanted] of Object.entries(spec)) {
    if (!wanted.length) continue;
    const actual = dimensionValues(opportunity, dimension);
    if (!actual.length) { unknown.push(dimension); continue; }
    if (wanted.some(tag => matchesTag(tag, actual, dimension))) reasons.push({ dimension, values: wanted });
    else mismatch.push(dimension);
  }
  return { matched: mismatch.length === 0, reasons, unknown, mismatch };
}
const QUALIFICATION_FIELDS = new Set(['highestEducation', 'latestMajor', 'majorCode', 'graduationYear', 'certificates', 'workYears', 'politicalStatus']);
const EDUCATION = ['高中', '大专', '本科', '硕士', '博士'];
function personalFacts(profile) {
  const basic = profile?.values?.basic?.[0] || {};
  return { ...basic, graduationYear: /^\d{4}/.exec(String(basic.graduationDate || ''))?.[0] || basic.graduationYear, certificates: (profile?.values?.languages || []).map(x => x.name).filter(Boolean).concat(tokens(basic.certificates)) };
}
function assessRequirement(rule, facts) {
  const evidence = rule && typeof rule.evidence === 'string' && rule.evidence.trim();
  if (!rule || !QUALIFICATION_FIELDS.has(rule.field) || !['oneOf','minimum'].includes(rule.operator) || !Array.isArray(rule.values) || !rule.values.length || rule.values.some(value => !['string','number'].includes(typeof value) || !String(value).trim())) return { state: 'unknown', reason: '资格条款未结构化，需核验原文' };
  if (!evidence || rule.verified !== true) return { state: 'unknown', field: rule.field, reason: '资格要求尚未核验' };
  const actual = tokens(facts[rule.field]);
  if (!actual.length) return { state: 'unknown', field: rule.field, reason: '个人条件未填写', evidence };
  let compatible;
  if (rule.operator === 'minimum') {
    if (rule.field === 'highestEducation') {
      const actualRank = EDUCATION.indexOf(facts.highestEducation), requiredRank = EDUCATION.indexOf(rule.values[0]);
      if (actualRank < 0 || requiredRank < 0) return { state: 'unknown', field: rule.field, reason: '学历口径需核实', evidence };
      compatible = actualRank >= requiredRank;
    } else if (rule.field === 'workYears') {
      if (!actual.every(x => /^\d+(\.\d+)?$/.test(x)) || !/^\d+(\.\d+)?$/.test(String(rule.values[0]))) return { state: 'unknown', field: rule.field, reason: '年限口径需核实', evidence };
      compatible = Number(actual[0]) >= Number(rule.values[0]);
    } else return { state: 'unknown', field: rule.field, reason: '比较口径未支持', evidence };
  } else {
    const canonical = value => ({ '大学英语六级':'cet6', '大学英语四级':'cet4', 'cet-6':'cet6', 'cet-4':'cet4' }[normalize(value)] || normalize(value));
    compatible = rule.values.map(canonical).some(value => actual.map(canonical).includes(value));
  }
  // Free-text major equivalence is not sufficient to disqualify a person.
  if (!compatible && ['latestMajor','certificates'].includes(rule.field) && rule.exact !== true) return { state: 'unknown', field: rule.field, reason: '专业或证书对应关系需人工核实', evidence };
  return { state: compatible ? 'pass' : 'fail', field: rule.field, reason: compatible ? '初步符合公告条件' : '与已核验的强制条件不符', evidence };
}
function assessQualifications(opportunity, profile) {
  const alternatives = opportunity.eligibility?.anyOf;
  if (!Array.isArray(alternatives) || !alternatives.length) return { state: 'unknown', branches: [], reason: '资格要求待核实' };
  const facts = personalFacts(profile);
  const branches = alternatives.map(branch => {
    if (!Array.isArray(branch) || !branch.length) return [{ state: 'unknown', reason: '资格路径不完整' }];
    return branch.map(rule => assessRequirement(rule, facts));
  });
  const states = branches.map(rules => rules.some(x => x.state === 'fail') ? 'fail' : rules.some(x => x.state === 'unknown') ? 'unknown' : 'pass');
  return { state: states.includes('pass') ? 'pass' : states.includes('unknown') ? 'unknown' : 'fail', branches };
}
function matchOpportunity(opportunity, profile, rawPreferences) {
  const prefs = validatePreferences(rawPreferences);
  const global = assessConditions(prefs.global, opportunity);
  const excludedBy = Object.entries(prefs.excluded).filter(([dimension, tags]) => tags.some(tag => matchesTag(tag, dimensionValues(opportunity, dimension), dimension))).map(([dimension]) => dimension);
  const plans = (prefs.plans.length ? prefs.plans : [{ id: 'all', name: '全部机会', conditions: {}, preferred: {} }]).map(plan => ({ id: plan.id, name: plan.name, ...assessConditions(plan.conditions, opportunity), preferred: assessConditions(plan.preferred, opportunity) }));
  const matchedPlans = plans.filter(plan => plan.matched);
  const qualification = assessQualifications(opportunity, profile);
  let reason = '';
  if (opportunity.openStatus === 'closed' && opportunity.statusVerified === true) reason = '官方已明确关闭';
  else if (excludedBy.length) reason = '命中明确排除项';
  else if (!global.matched) reason = '不符合全局必须条件';
  else if (!matchedPlans.length) reason = '不符合任一搜索方案';
  else if (qualification.state === 'fail') reason = '已核验个人条件不满足强制资格';
  const unknown = global.unknown.length || (matchedPlans.length > 0 && matchedPlans.every(x => x.unknown.length)) || qualification.state === 'unknown' || opportunity.openStatus !== 'open' || opportunity.statusVerified !== true;
  const softMismatch = matchedPlans.length && matchedPlans.every(x => x.preferred.mismatch.length);
  return { included: !reason, tier: reason ? 'excluded' : unknown ? 'verify' : softMismatch ? 'explore' : 'recommended', reason, matchedPlans, planAssessments:plans, qualification, global, excludedBy };
}
function searchQueries(rawPreferences) {
  const prefs = validatePreferences(rawPreferences);
  return prefs.plans.flatMap(plan => Object.entries({ ...plan.conditions }).flatMap(([dimension,tags]) => tags.map(tag => ({ planId: plan.id, dimension, terms: [...new Set([ROUTE_LABELS[tag] || tag, ...(ALIASES[tag] || [])])] }))));
}
module.exports = { DIMENSIONS, ROUTES, ROUTE_LABELS, validatePreferences, matchOpportunity, assessQualifications, searchQueries, personalFacts };
