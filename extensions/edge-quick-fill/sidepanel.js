const STORAGE_KEY = "qiuzhaoProfile";
const REPORT_KEY = "qiuzhaoLastReport";

const elements = {
  profileFile: document.querySelector("#profileFile"),
  clearProfile: document.querySelector("#clearProfile"),
  profileState: document.querySelector("#profileState"),
  profileName: document.querySelector("#profileName"),
  pageState: document.querySelector("#pageState"),
  scanPage: document.querySelector("#scanPage"),
  fillPage: document.querySelector("#fillPage"),
  exportReport: document.querySelector("#exportReport"),
  resultList: document.querySelector("#resultList"),
  emptyResult: document.querySelector("#emptyResult"),
  metricFound: document.querySelector("#metricFound"),
  metricReady: document.querySelector("#metricReady"),
  metricFilled: document.querySelector("#metricFilled"),
  metricReview: document.querySelector("#metricReview")
};

let profile = null;
let latestReport = null;

init();

async function init() {
  const stored = await chrome.storage.local.get([STORAGE_KEY, REPORT_KEY]);
  if (stored[STORAGE_KEY]) setProfile(stored[STORAGE_KEY]);
  if (stored[REPORT_KEY]) {
    latestReport = stored[REPORT_KEY];
    renderReport(latestReport);
  }
}

elements.profileFile.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    validateProfile(parsed);
    profile = parsed;
    await chrome.storage.local.set({ [STORAGE_KEY]: parsed });
    setProfile(parsed);
    setPageState("已载入资料", "ready");
  } catch (error) {
    setPageState(error.message || "JSON 无法读取", "error");
  } finally {
    event.target.value = "";
  }
});

elements.clearProfile.addEventListener("click", async () => {
  profile = null;
  latestReport = null;
  await chrome.storage.local.remove([STORAGE_KEY, REPORT_KEY]);
  elements.profileState.textContent = "未导入";
  elements.profileState.className = "state state-empty";
  elements.profileName.textContent = "导入 offer-resume-import.json 后开始使用";
  elements.fillPage.disabled = true;
  elements.exportReport.disabled = true;
  resetResults();
});

elements.scanPage.addEventListener("click", () => runPageAction("scan"));
elements.fillPage.addEventListener("click", () => runPageAction("fill"));
elements.exportReport.addEventListener("click", exportReport);

function validateProfile(value) {
  if (!value || typeof value !== "object" || typeof value.name !== "string" || !value.data || typeof value.data !== "object") {
    throw new Error("请选择包含 name 和 data 的 Offer 简历 JSON");
  }
}

function setProfile(value) {
  profile = value;
  elements.profileState.textContent = "本机已载入";
  elements.profileState.className = "state state-ready";
  elements.profileName.textContent = value.name || value.data?.basicInfo?.resumeName || "未命名简历";
}

async function runPageAction(mode) {
  if (mode === "fill" && !profile) {
    setPageState("请先导入简历", "review");
    return;
  }

  setPageState(mode === "scan" ? "正在扫描" : "正在填写", "working");
  elements.scanPage.disabled = true;
  elements.fillPage.disabled = true;

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !/^https?:/i.test(tab.url || "")) {
      throw new Error("请在普通招聘网页中使用，Edge 设置页和空白页无法填写");
    }

    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["page-engine.js"] });
    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "QIUZHAO_RUN",
      mode,
      profile: mode === "fill" ? profile : null
    });

    latestReport = {
      ...response,
      mode,
      profileName: profile?.name || "",
      pageUrl: tab.url,
      pageTitle: tab.title,
      createdAt: new Date().toISOString()
    };
    await chrome.storage.local.set({ [REPORT_KEY]: latestReport });
    renderReport(latestReport);
    setPageState(mode === "fill" ? "填写完成，等待复核" : "扫描完成", mode === "fill" ? "review" : "ready");
    elements.fillPage.disabled = !profile || !response.ready;
  } catch (error) {
    setPageState(normalizeError(error), "error");
  } finally {
    elements.scanPage.disabled = false;
    if (latestReport?.ready && profile) elements.fillPage.disabled = false;
  }
}

function normalizeError(error) {
  const message = String(error?.message || error || "页面操作失败");
  if (/Receiving end does not exist/i.test(message)) return "页面尚未准备好，请刷新网页后重试";
  if (/Cannot access/i.test(message)) return "Edge 未授权访问此页，请重新点击扩展图标";
  return message.replace(/^Error:\s*/i, "").slice(0, 120);
}

function setPageState(text, type) {
  elements.pageState.textContent = text;
  elements.pageState.className = `state state-${type}`;
}

function resetResults() {
  latestReport = null;
  elements.resultList.hidden = true;
  elements.resultList.innerHTML = "";
  elements.emptyResult.hidden = false;
  updateMetrics({ found: 0, ready: 0, filled: 0, review: 0 });
  setPageState("等待扫描", "idle");
}

function renderReport(report) {
  updateMetrics(report.summary || {});
  const items = Array.isArray(report.items) ? report.items : [];
  elements.resultList.innerHTML = items.slice(0, 80).map((item) => {
    const status = escapeHtml(item.status || "review");
    return `<li class="result-item ${status}">
      <span class="result-dot" aria-hidden="true"></span>
      <span class="result-copy"><strong>${escapeHtml(item.label || "未命名字段")}</strong><small>${escapeHtml(item.detail || "")}</small></span>
      <span class="result-badge">${statusText(item.status)}</span>
    </li>`;
  }).join("");
  elements.resultList.hidden = items.length === 0;
  elements.emptyResult.hidden = items.length > 0;
  elements.exportReport.disabled = !report;
}

function updateMetrics(summary) {
  elements.metricFound.textContent = summary.found || 0;
  elements.metricReady.textContent = summary.ready || 0;
  elements.metricFilled.textContent = summary.filled || 0;
  elements.metricReview.textContent = summary.review || 0;
}

function statusText(status) {
  return ({ ready: "可填写", filled: "已填写", review: "待确认", failed: "失败" })[status] || "检查";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
}

function exportReport() {
  if (!latestReport) return;
  const blob = new Blob([JSON.stringify(latestReport, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `秋招投递-填写报告-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
