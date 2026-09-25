const STAGES = ["待确认岗位", "待投递", "已投递", "测评/笔试", "一面", "二面", "HR/终面", "Offer", "已结束"];
const COMPANY_TYPES = ["国央企", "私企", "外企", "待确认"];
const TERMINAL_STAGES = new Set(["已结束"]);
const INTERVIEW_STAGES = new Set(["测评/笔试", "一面", "二面", "HR/终面"]);
const STATUS_CLASS = {
  "待确认岗位": "status-confirm",
  "待投递": "status-todo",
  "已投递": "status-sent",
  "测评/笔试": "status-test",
  "一面": "status-first",
  "二面": "status-second",
  "HR/终面": "status-final",
  "Offer": "status-offer",
  "已结束": "status-closed",
};

const state = {
  jobs: [],
  filter: "all",
  search: "",
  category: "",
  stage: "",
  editingId: "",
};
const elements = Object.fromEntries([...document.querySelectorAll("[id]")].map((el) => [el.id, el]));

function escapeHtml(value = "") {
  return String(value).replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function linkValue(value) {
  const text = String(value || "").trim();
  return /^https?:\/\//i.test(text) ? text : "";
}

function jobStage(job) {
  if (STAGES.includes(job["当前状态"])) return job["当前状态"];
  const progress = job["进展"];
  if (["Offer", "待意向", "已录用"].includes(progress)) return "Offer";
  if (["HR面", "终面"].includes(progress)) return "HR/终面";
  if (progress === "二面") return "二面";
  if (progress === "一面") return "一面";
  if (["测评", "笔试", "AI面试", "初筛通过"].includes(progress)) return "测评/笔试";
  if (["已结束", "未通过"].includes(progress) || ["已结束", "已撤回", "暂停"].includes(job["投递情况"])) return "已结束";
  if (job["投递情况"] === "已投递") return "已投递";
  if (["待投递", "填写中", "已保存"].includes(job["投递情况"])) return "待投递";
  return "待确认岗位";
}

function isClosed(job) {
  return TERMINAL_STAGES.has(jobStage(job));
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function nextDue(job) {
  const candidates = [
    { type: "准备 DDL", date: parseDate(job["准备DDL"]) },
    { type: "官方时间", date: parseDate(job["官方节点时间"]) },
  ].filter((item) => item.date && item.date.getTime() > 0);
  candidates.sort((a, b) => a.date - b.date);
  return candidates[0] || null;
}

function missingDueLabel(job) {
  const stage = jobStage(job);
  if (["一面", "二面", "HR/终面"].includes(stage)) return "等待邮箱提取面试时间";
  if (["已投递", "测评/笔试"].includes(stage)) return "等待邮箱更新";
  if (stage === "待投递") return linkValue(job["投递链接"] || job["内推链接"]) ? "可直接投递" : "待补投递入口";
  if (stage === "待确认岗位") return "待确认具体岗位";
  return "暂无时间要求";
}

function urgency(job) {
  if (isClosed(job)) return { rank: 5, cls: "", label: "已结束", time: Infinity };
  const due = nextDue(job);
  if (!due) {
    const stage = jobStage(job);
    const rank = stage === "待投递" ? 2 : stage === "待确认岗位" ? 4 : 3;
    return { rank, cls: "", label: missingDueLabel(job), time: Infinity };
  }
  const delta = due.date.getTime() - Date.now();
  if (delta < 0) return { rank: 0, cls: "overdue", label: "已逾期", time: due.date.getTime() };
  if (delta <= 72 * 3600 * 1000) return { rank: 1, cls: "soon", label: "72 小时内", time: due.date.getTime() };
  return { rank: 2, cls: "", label: due.type, time: due.date.getTime() };
}

function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

function formatDay(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function activityDateLabel(job) {
  if (job["投递日期"]) return `投递 ${formatDay(job["投递日期"])}`;
  if (job["准备日期"]) return `准备 ${formatDay(job["准备日期"])}`;
  return job["地区"] || "";
}

function statusClass(stage) {
  return STATUS_CLASS[stage] || "status-confirm";
}

function stageOptions(selected) {
  return STAGES.map((stage) => `<option value="${stage}" ${stage === selected ? "selected" : ""}>${stage}</option>`).join("");
}

function nextActionForStage(job, stage) {
  const platform = job["会议平台"] || "面试入口";
  const actions = {
    "待确认岗位": "确认具体岗位与投递入口",
    "待投递": linkValue(job["内推链接"] || job["投递链接"]) ? "打开投递入口并完成提交" : "等待 Excel 补充投递入口",
    "已投递": "等待邮箱通知并跟进进度",
    "测评/笔试": "按邮件要求完成测评或笔试",
    "一面": `查看安排并参加${platform}`,
    "二面": `查看安排并参加${platform}`,
    "HR/终面": `查看安排并参加${platform}`,
    "Offer": "确认意向、材料与回复期限",
    "已结束": "流程已结束",
  };
  return actions[stage] || "查看当前节点";
}

function actionFor(job) {
  const stage = jobStage(job);
  if (stage === "待确认岗位") return { label: "查看招聘信息", url: linkValue(job["招聘信息"] || job["投递链接"]) };
  if (stage === "待投递") return { label: "打开投递入口", url: linkValue(job["内推链接"] || job["投递链接"]) };
  if (["一面", "二面", "HR/终面"].includes(stage)) return { label: job["会议平台"] ? `打开${job["会议平台"]}` : "打开面试入口", url: linkValue(job["会议链接"]) };
  if (stage === "测评/笔试") return { label: "打开测评或进度入口", url: linkValue(job["进度查询入口"] || job["会议链接"] || job["投递链接"]) };
  if (stage === "已投递") return { label: "查询投递进度", url: linkValue(job["进度查询入口"] || job["投递链接"]) };
  return { label: "查看相关入口", url: linkValue(job["进度查询入口"] || job["招聘信息"] || job["投递链接"]) };
}

function renderStats() {
  const counts = Object.fromEntries(STAGES.map((stage) => [stage, state.jobs.filter((job) => jobStage(job) === stage).length]));
  const interviews = counts["一面"] + counts["二面"] + counts["HR/终面"];
  const dueSoon = state.jobs.filter((job) => [0, 1].includes(urgency(job).rank)).length;
  const cards = [
    ["全部岗位", state.jobs.length, "Excel 中的完整清单", "#16233b"],
    ["待投递", counts["待投递"], "已有岗位，等待提交", "#d18b00"],
    ["已投递", counts["已投递"], "等待后续通知", "#2e67f8"],
    ["面试中", interviews, "一面、二面及终面", "#7357cc"],
    ["Offer", counts.Offer, "待意向、Offer 或录用", "#16835f"],
    ["临期 / 逾期", dueSoon, "未来 72 小时需处理", dueSoon ? "#d94b57" : "#8b95a5"],
  ];
  elements.stats.innerHTML = cards.map(([label, value, note, color]) => `
    <article class="stat" style="--accent:${color}"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong><span class="stat-note">${note}</span></article>
  `).join("");
}

function renderTimeline() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(now); date.setDate(now.getDate() + index); return date;
  });
  elements.timeline.innerHTML = days.map((date, index) => {
    const next = new Date(date); next.setDate(date.getDate() + 1);
    const jobs = state.jobs.filter((job) => {
      const due = nextDue(job)?.date;
      return due && !isClosed(job) && due >= date && due < next;
    }).sort((a, b) => nextDue(a).date - nextDue(b).date).slice(0, 4);
    const weekday = new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date);
    return `<article class="day ${index === 0 ? "today" : ""}">
      <div class="day-label"><strong>${date.getMonth() + 1}/${date.getDate()}</strong><span>${weekday}</span></div>
      <div class="day-jobs">${jobs.length ? jobs.map((job) => `<button class="day-chip" data-open-id="${escapeHtml(job["记录ID"])}">${escapeHtml(job["公司名称"])}</button>`).join("") : '<span class="due-note">暂无</span>'}</div>
    </article>`;
  }).join("");
}

function filteredJobs() {
  const query = state.search.trim().toLowerCase();
  return state.jobs.filter((job) => {
    const searchable = ["公司名称", "投递岗位", "地区", "公司类型", "岗位JD", "公司背调", "业务技术方向", "面试亮点", "可提问题"].map((key) => job[key] || "").join(" ").toLowerCase();
    if (query && !searchable.includes(query)) return false;
    if (state.category && job["公司类型"] !== state.category) return false;
    if (state.stage && jobStage(job) !== state.stage) return false;
    if (state.filter === "closed") return isClosed(job);
    if (state.filter === "active") return ["已投递", "测评/笔试", "一面", "二面", "HR/终面", "Offer"].includes(jobStage(job));
    if (state.filter === "todo") return !isClosed(job) && (urgency(job).rank <= 2 || jobStage(job) === "待投递");
    return true;
  }).sort((a, b) => {
    const ua = urgency(a), ub = urgency(b);
    return ua.rank - ub.rank || ua.time - ub.time || a["公司名称"].localeCompare(b["公司名称"], "zh-CN");
  });
}

function renderTable() {
  const jobs = filteredJobs();
  elements.resultCount.textContent = jobs.length;
  elements.emptyState.hidden = jobs.length > 0;
  elements.jobsBody.innerHTML = jobs.map((job) => {
    const stage = jobStage(job);
    const due = nextDue(job);
    const urgent = urgency(job);
    const action = job["下一步行动"] || nextActionForStage(job, stage);
    return `<tr class="job-row ${isClosed(job) ? "is-closed" : ""}" data-row-id="${escapeHtml(job["记录ID"])}">
      <td>
        <button class="company-button" data-open-id="${escapeHtml(job["记录ID"])}">
          <strong>${escapeHtml(job["公司名称"])}</strong>
          <span title="${escapeHtml(job["投递岗位"])}">${escapeHtml(job["投递岗位"])}</span>
        </button>
      </td>
      <td><span class="kind-chip kind-${job["公司类型"] === "外企" ? "foreign" : job["公司类型"] === "私企" ? "private" : "state"}">${escapeHtml(job["公司类型"])}</span></td>
      <td><select class="status-select ${statusClass(stage)}" data-status-id="${escapeHtml(job["记录ID"])}" aria-label="修改 ${escapeHtml(job["公司名称"])} 的状态">${stageOptions(stage)}</select></td>
      <td><span class="next-action" title="${escapeHtml(action)}">${escapeHtml(action)}</span></td>
      <td><span class="due-main ${urgent.cls}">${due ? formatDate(due.date) : escapeHtml(urgent.label)}</span><span class="due-kind">${escapeHtml(due ? `${due.type} · ${activityDateLabel(job)}` : activityDateLabel(job))}</span></td>
      <td><button class="detail-button" data-open-id="${escapeHtml(job["记录ID"])}" aria-label="查看 ${escapeHtml(job["公司名称"])} 详情">›</button></td>
    </tr>`;
  }).join("");
}

function renderAll() {
  renderStats();
  renderTimeline();
  renderTable();
}

async function loadJobs(showToast = false) {
  elements.syncState.classList.remove("error");
  elements.syncState.textContent = "正在读取 Excel…";
  try {
    const response = await fetch("/api/jobs", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    state.jobs = data.jobs;
    const time = new Date(data.refreshedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
    elements.syncState.textContent = `已同步 ${state.jobs.length} 条 · ${time}`;
    renderAll();
    if (showToast) toast(`已从 Excel 同步 ${state.jobs.length} 条岗位`);
  } catch (error) {
    elements.syncState.textContent = error.message;
    elements.syncState.classList.add("error");
  }
}

function renderText(element, value, emptyText) {
  const text = String(value || "").trim();
  element.innerHTML = text
    ? text.split(/\n+/).map((line) => `<p>${escapeHtml(line)}</p>`).join("")
    : `<p class="muted-copy">${escapeHtml(emptyText)}</p>`;
}

function externalButton(label, url, className = "") {
  return `<button type="button" class="${className}" data-external-url="${escapeHtml(url)}">${escapeHtml(label)}</button>`;
}

async function openExternal(url) {
  const response = await fetch("/api/open-external", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "无法打开链接");
}

function openDetail(job) {
  state.editingId = job["记录ID"];
  const stage = jobStage(job);
  const due = nextDue(job);
  const action = actionFor(job);
  elements.dialogCompanyType.textContent = job["公司类型"];
  elements.dialogTitle.textContent = job["公司名称"];
  elements.dialogRole.textContent = job["投递岗位"];
  elements.detailStageSelect.innerHTML = stageOptions(stage);
  elements.detailStageSelect.className = `status-select ${statusClass(stage)}`;
  elements.detailDue.textContent = due ? `${due.type} · ${formatDate(due.date)}` : missingDueLabel(job);
  elements.detailDateNote.textContent = activityDateLabel(job);
  elements.detailAction.innerHTML = action.url ? externalButton(action.label, action.url, "button primary") : `<span>${escapeHtml(action.label)}：Excel 中暂无入口</span>`;
  renderText(elements.jdContent, job["岗位JD"], `Excel 当前只记录了岗位名称：${job["投递岗位"]}`);
  renderText(elements.backgroundContent, job["公司背调"], "本地 Excel 暂无可核验的公司背调。");
  renderText(elements.technologyContent, job["业务技术方向"], `当前可确认的岗位方向：${job["投递岗位"]}`);
  renderText(elements.highlightContent, job["面试亮点"], "尚无与该岗位匹配的本地面试要点。");
  renderText(elements.questionContent, job["可提问题"], "尚未生成针对该公司与岗位的问题。");

  const interviewFacts = [
    ["方式", [job["面试方式"], job["会议平台"]].filter(Boolean).join(" · ")],
    ["会议链接", linkValue(job["会议链接"])],
    ["准备要求", job["准备要求"]],
    ["邮件依据", job["邮件依据"]],
  ].filter(([, value]) => value);
  elements.interviewCard.hidden = !INTERVIEW_STAGES.has(stage) && !interviewFacts.length;
  elements.interviewContent.innerHTML = interviewFacts.length ? interviewFacts.map(([label, value]) => `<div><b>${escapeHtml(label)}</b>${linkValue(value) ? externalButton("打开链接", value) : `<span>${escapeHtml(value)}</span>`}</div>`).join("") : '<p class="muted-copy">等待邮箱自动同步本轮安排。</p>';

  const sources = [
    ["投递入口", job["投递链接"]],
    ["内推入口", job["内推链接"]],
    ["招聘信息", job["招聘信息"]],
    ["进度查询", job["进度查询入口"]],
    ["背调来源", job["背调来源"]],
  ].filter(([, value]) => linkValue(value));
  const referral = String(job["内推码"] || "").trim();
  elements.sourceStrip.innerHTML = [
    ...sources.map(([label, value]) => externalButton(label, value)),
    referral ? `<button type="button" data-copy-code="${escapeHtml(referral)}">复制内推码 ${escapeHtml(referral)}</button>` : "",
  ].filter(Boolean).join("") || '<span>Excel 中暂无附加入口</span>';
  elements.detailError.textContent = "";
  if (!elements.detailDialog.open) elements.detailDialog.showModal();
}

async function changeStatus(job, stage, control) {
  const previous = jobStage(job);
  control.disabled = true;
  try {
    const response = await fetch(`/api/jobs/${encodeURIComponent(job["记录ID"])}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patch: {
          "当前状态": stage,
          "下一步行动": nextActionForStage(job, stage),
          "状态核验日期": new Date().toISOString(),
          ...(stage === "已投递" && !job["投递日期"] ? { "投递日期": new Date().toISOString() } : {}),
        },
        expectedVersion: job.__version,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    const index = state.jobs.findIndex((item) => item["记录ID"] === job["记录ID"]);
    state.jobs[index] = data.job;
    renderAll();
    toast(`${job["公司名称"]}：${previous} → ${stage}`);
    if (elements.detailDialog.open && state.editingId === job["记录ID"]) openDetail(state.jobs[index]);
  } catch (error) {
    control.value = previous;
    control.className = `status-select ${statusClass(previous)}`;
    elements.detailError.textContent = error.message;
    toast(error.message);
  } finally {
    control.disabled = false;
  }
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastTimer = setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

elements.categoryFilter.innerHTML += COMPANY_TYPES.map((type) => `<option value="${type}">${type}</option>`).join("");
elements.stageFilter.innerHTML += STAGES.map((stage) => `<option value="${stage}">${stage}</option>`).join("");
elements.todayText.textContent = `${new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long" }).format(new Date())}，全部岗位已归入同一张状态表。`;
elements.refreshButton.addEventListener("click", () => loadJobs(true));
elements.searchInput.addEventListener("input", (event) => { state.search = event.target.value; renderTable(); });
elements.categoryFilter.addEventListener("change", (event) => { state.category = event.target.value; renderTable(); });
elements.stageFilter.addEventListener("change", (event) => { state.stage = event.target.value; renderTable(); });
elements.filterButtons.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-filter]");
  if (!button) return;
  state.filter = button.dataset.filter;
  [...elements.filterButtons.querySelectorAll("button")].forEach((item) => item.classList.toggle("active", item === button));
  renderTable();
});
document.addEventListener("click", async (event) => {
  const external = event.target.closest("[data-external-url]");
  if (external) {
    try {
      await openExternal(external.dataset.externalUrl);
      toast("已用系统浏览器打开");
    } catch (error) {
      toast(error.message);
    }
    return;
  }
  const opener = event.target.closest("[data-open-id]");
  if (opener) {
    const job = state.jobs.find((item) => item["记录ID"] === opener.dataset.openId);
    if (job) openDetail(job);
    return;
  }
  const copy = event.target.closest("[data-copy-code]");
  if (copy) {
    await navigator.clipboard.writeText(copy.dataset.copyCode);
    toast("内推码已复制");
  }
});
document.addEventListener("change", (event) => {
  const control = event.target.closest("[data-status-id]");
  if (!control) return;
  const job = state.jobs.find((item) => item["记录ID"] === control.dataset.statusId);
  if (job) changeStatus(job, control.value, control);
});
elements.detailStageSelect.addEventListener("change", () => {
  const job = state.jobs.find((item) => item["记录ID"] === state.editingId);
  if (job) changeStatus(job, elements.detailStageSelect.value, elements.detailStageSelect);
});
document.querySelectorAll("[data-close]").forEach((button) => button.addEventListener("click", () => document.getElementById(button.dataset.close).close()));
setInterval(() => { if (!elements.detailDialog.open && !elements.addDialog.open) loadJobs(); }, 15000);
loadJobs();

function openAddCompany() {
  elements.addForm.reset();
  elements.addCompany.value = state.search.trim();
  elements.addError.textContent = '';
  elements.addDialog.showModal();
  elements.addCompany.focus();
}
elements.addCompanyButton.addEventListener('click', openAddCompany);
elements.emptyAddButton.addEventListener('click', openAddCompany);
elements.addForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (elements.saveCompanyButton.disabled) return;
  const payload = Object.fromEntries(new FormData(elements.addForm));
  payload['公司名称'] = payload['公司名称'].trim();
  if (!payload['公司名称']) { elements.addError.textContent = '请输入公司名称'; return; }
  payload['下一步行动'] = nextActionForStage(payload, payload['当前状态']);
  elements.saveCompanyButton.disabled = true;
  elements.addError.textContent = '';
  try {
    const response = await fetch('/api/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || '保存失败，请重试');
    state.jobs = [...state.jobs.filter(job => job['记录ID'] !== data.job['记录ID']), data.job];
    state.search = payload['公司名称']; state.category = ''; state.stage = ''; state.filter = 'all';
    elements.searchInput.value = state.search; elements.categoryFilter.value = ''; elements.stageFilter.value = '';
    elements.filterButtons.querySelectorAll('button').forEach(button => button.classList.toggle('active', button.dataset.filter === 'all'));
    renderAll();
    elements.syncState.textContent = `已保存到 Excel · ${state.jobs.length} 条`;
    elements.addDialog.close();
    toast('公司已添加并保存到 Excel，可在列表中修改状态');
  } catch (error) { elements.addError.textContent = error.message; }
  finally { elements.saveCompanyButton.disabled = false; }
});
