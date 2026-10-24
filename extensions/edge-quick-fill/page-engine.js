(() => {
  if (globalThis.__QIUZHAO_ENGINE_INSTALLED__) return;
  globalThis.__QIUZHAO_ENGINE_INSTALLED__ = true;

  const SENSITIVE_KEYS = new Set([
    "idNumber", "politicalStatus", "religion", "healthStatus", "maritalStatus",
    "fertilityStatus", "hasLaborDispute", "wasDismissed", "hasBadRecord",
    "hasNonCompete", "hasRelativeInCompany", "hasForeignResidencePermit",
    "hasMilitaryService", "isPoorStudent", "familyMembers", "familyAddress"
  ]);

  const FIELD_ALIASES = {
    "basicInfo.name": ["姓名", "真实姓名", "中文姓名", "name", "full name"],
    "basicInfo.gender": ["性别", "gender"],
    "basicInfo.birthDate": ["出生日期", "出生年月", "生日", "birth date", "birthday"],
    "basicInfo.phone": ["手机号", "手机号码", "联系电话", "移动电话", "phone", "mobile"],
    "basicInfo.email": ["邮箱", "电子邮箱", "电子邮件", "email", "e-mail"],
    "basicInfo.wechat": ["微信", "微信号", "wechat"],
    "basicInfo.qq": ["qq", "qq号"],
    "basicInfo.country": ["国籍", "国家", "nationality", "country"],
    "basicInfo.nativePlace": ["籍贯", "native place"],
    "basicInfo.birthOrigin": ["生源地", "生源所在地"],
    "basicInfo.hukouLocation": ["户口所在地", "户籍所在地", "户籍地址"],
    "basicInfo.currentAddress": ["现居住地", "现住址", "当前所在地", "居住城市", "current address"],
    "basicInfo.currentAddressDetail": ["现居住详细地址", "现居地址", "详细住址", "通讯地址"],
    "basicInfo.currentIdentity": ["当前身份", "人员类别", "身份"],
    "basicInfo.highestEducation": ["最高学历", "学历", "highest education"],
    "basicInfo.highestDegree": ["最高学位", "学位", "highest degree"],
    "basicInfo.graduationSchool": ["毕业院校", "毕业学校", "最高学历学校"],
    "basicInfo.highestMajor": ["最高学历专业", "所学专业", "毕业专业"],
    "basicInfo.graduationDate": ["毕业时间", "预计毕业时间", "毕业日期"],
    "basicInfo.expectedPosition": ["期望岗位", "意向岗位", "应聘职位", "应聘岗位"],
    "basicInfo.homepage": ["个人主页", "个人网站", "作品集链接", "homepage"],
    "basicInfo.postalCode": ["邮政编码", "邮编", "postcode", "postal code"],
    "jobIntention.position": ["期望职位", "目标职位", "职位类别"],
    "jobIntention.industry": ["期望行业", "目标行业"],
    "jobIntention.city": ["期望城市", "意向城市", "工作地点", "工作城市"],
    "jobIntention.salary": ["期望薪资", "期望月薪", "薪资要求"],
    "jobIntention.availability": ["到岗时间", "可入职时间", "入职时间"],
    "education.0.school": ["学校", "学校名称", "院校", "院校名称", "毕业院校"],
    "education.0.department": ["学院", "院系", "学院名称", "所在院系"],
    "education.0.level": ["学历", "学历层次", "教育程度"],
    "education.0.degree": ["学位", "学位类型"],
    "education.0.major": ["专业", "专业名称", "所学专业"],
    "education.0.startTime": ["入学时间", "教育开始时间", "开始日期"],
    "education.0.endTime": ["毕业时间", "教育结束时间", "结束日期"],
    "education.0.gpa": ["gpa", "平均绩点", "绩点"],
    "education.0.classRank": ["专业排名", "班级排名", "排名"],
    "education.0.majorCourses": ["主修课程", "主要课程", "专业课程"],
    "languageSkills.0.name": ["外语语种", "语言", "语种"],
    "languageSkills.0.level": ["英语等级", "外语水平", "语言水平"],
    "languageSkills.0.score": ["英语等级成绩", "外语成绩", "语言成绩", "英语成绩"],
    "selfIntroduction.selfIntroduction": ["自我评价", "自我介绍", "个人评价", "个人优势"]
  };

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "QIUZHAO_RUN") return;
    try {
      const result = run(message.mode, message.profile);
      sendResponse(result);
    } catch (error) {
      sendResponse({
        ready: false,
        summary: { found: 0, ready: 0, filled: 0, review: 1 },
        items: [{ status: "failed", label: "页面引擎", detail: String(error?.message || error) }]
      });
    }
    return true;
  });

  function run(mode, profile) {
    clearHighlights();
    const controls = collectControls();
    const candidates = profile ? buildCandidates(profile.data || {}) : [];
    const items = [];
    let ready = 0;
    let filled = 0;
    let review = 0;

    for (const descriptor of controls) {
      const match = profile ? findBestMatch(descriptor, candidates) : null;
      if (!match) {
        review += descriptor.required ? 1 : 0;
        if (descriptor.required) {
          mark(descriptor.element, "review");
          items.push({ status: "review", label: descriptor.label, detail: "必填字段尚未匹配到已确认资料" });
        }
        continue;
      }

      if (match.sensitive) {
        review += 1;
        mark(descriptor.element, "review");
        items.push({ status: "review", label: descriptor.label, detail: "敏感字段，需要本人确认后填写" });
        continue;
      }

      if (!descriptor.safeType) {
        review += 1;
        mark(descriptor.element, "review");
        items.push({ status: "review", label: descriptor.label, detail: `${descriptor.type} 控件需要专用适配器` });
        continue;
      }

      ready += 1;
      if (mode === "scan") {
        mark(descriptor.element, "ready");
        items.push({ status: "ready", label: descriptor.label, detail: `${match.path} · 匹配 ${Math.round(match.score * 100)}%` });
        continue;
      }

      const success = fillControl(descriptor.element, match.value, descriptor.type);
      if (success) {
        filled += 1;
        mark(descriptor.element, "filled");
        items.push({ status: "filled", label: descriptor.label, detail: `${match.path} · 已写入并触发网页事件` });
      } else {
        review += 1;
        mark(descriptor.element, "failed");
        items.push({ status: "failed", label: descriptor.label, detail: "写入失败，需要手动处理" });
      }
    }

    return {
      ready: controls.length > 0,
      summary: { found: controls.length, ready, filled, review },
      items,
      engineVersion: "0.1.0"
    };
  }

  function collectControls() {
    const selector = [
      "input:not([type='hidden']):not([type='submit']):not([type='button']):not([type='reset']):not([type='image'])",
      "textarea", "select", "[contenteditable='true']", "[role='textbox']", "[role='combobox']"
    ].join(",");

    return Array.from(document.querySelectorAll(selector))
      .filter((element) => isVisible(element) && !element.disabled)
      .map((element) => describeControl(element))
      .filter((item) => item.label);
  }

  function describeControl(element) {
    const inputType = String(element.getAttribute("type") || "").toLowerCase();
    const tag = element.tagName.toLowerCase();
    let type = tag;
    if (tag === "input") type = inputType || "text";
    if (element.getAttribute("role") === "combobox") type = "combobox";
    if (element.isContentEditable) type = "contenteditable";

    return {
      element,
      type,
      label: findLabel(element),
      required: Boolean(element.required || element.getAttribute("aria-required") === "true" || /[*＊]|必填|required/i.test(findContainerText(element))),
      safeType: ["text", "email", "tel", "url", "number", "textarea", "contenteditable"].includes(type)
    };
  }

  function findLabel(element) {
    const parts = [];
    if (element.id) {
      const explicit = document.querySelector(`label[for="${cssEscape(element.id)}"]`);
      if (explicit) parts.push(explicit.textContent);
    }
    const wrappingLabel = element.closest("label");
    if (wrappingLabel) parts.push(wrappingLabel.textContent);
    ["aria-label", "placeholder", "name", "data-field", "data-label"].forEach((attr) => {
      const value = element.getAttribute(attr);
      if (value) parts.push(value);
    });
    const container = element.closest(".ant-form-item,.el-form-item,.form-item,.form-group,.field,.field-row,.row,[class*='formItem'],[class*='form-item'],td,li");
    if (container) {
      const label = container.querySelector("label,.label,[class*='label'],th,dt");
      if (label) parts.push(label.textContent);
    }
    return normalizeLabel(parts.filter(Boolean).join(" "));
  }

  function findContainerText(element) {
    const container = element.closest(".ant-form-item,.el-form-item,.form-item,.form-group,.field,.field-row,.row,[class*='formItem'],[class*='form-item'],td,li");
    return normalizeLabel(container?.textContent || "");
  }

  function buildCandidates(data) {
    return Object.entries(FIELD_ALIASES).map(([path, aliases]) => {
      const value = getByPath(data, path);
      const key = path.split(".").at(-1);
      return {
        path,
        aliases: aliases.map(normalizeLabel),
        value,
        sensitive: SENSITIVE_KEYS.has(key),
        usable: value !== undefined && value !== null && String(value).trim() !== ""
      };
    }).filter((item) => item.usable);
  }

  function findBestMatch(descriptor, candidates) {
    const target = normalizeLabel(descriptor.label);
    let best = null;
    for (const candidate of candidates) {
      for (const alias of candidate.aliases) {
        let score = similarity(target, alias);
        if (target === alias) score = 1;
        else if (target.includes(alias) || alias.includes(target)) {
          const specificity = Math.min(alias.length, target.length) / Math.max(alias.length, target.length);
          score = Math.max(score, 0.88 + specificity * 0.1);
        }
        if (!best || score > best.score) best = { ...candidate, score };
      }
    }
    return best && best.score >= 0.76 ? best : null;
  }

  function fillControl(element, rawValue, type) {
    const value = String(rawValue ?? "");
    try {
      element.focus();
      if (type === "contenteditable") {
        element.textContent = value;
      } else {
        const prototype = element.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
        if (setter) setter.call(element, value);
        else element.value = value;
      }
      ["input", "change", "blur"].forEach((name) => element.dispatchEvent(new Event(name, { bubbles: true, composed: true })));
      return readValue(element) === value || readValue(element).includes(value);
    } catch (_error) {
      return false;
    }
  }

  function readValue(element) {
    return String(element.isContentEditable ? element.textContent : element.value || "").trim();
  }

  function mark(element, status) {
    const color = { ready: "#207a58", filled: "#207a58", review: "#d97706", failed: "#b42318" }[status];
    element.dataset.qiuzhaoStatus = status;
    element.style.setProperty("outline", `2px solid ${color}`, "important");
    element.style.setProperty("outline-offset", "2px", "important");
  }

  function clearHighlights() {
    document.querySelectorAll("[data-qiuzhao-status]").forEach((element) => {
      delete element.dataset.qiuzhaoStatus;
      element.style.removeProperty("outline");
      element.style.removeProperty("outline-offset");
    });
  }

  function getByPath(value, path) {
    return path.split(".").reduce((current, key) => current == null ? undefined : current[key], value);
  }

  function normalizeLabel(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[＊*:：]/g, "")
      .replace(/\b(required|optional|please|enter|select)\b/gi, "")
      .replace(/(必填|选填|请输入|请选择|请填写|请确认)/g, "")
      .replace(/[\s\-_/（）()【】\[\]]+/g, "")
      .trim()
      .slice(0, 80);
  }

  function similarity(a, b) {
    if (!a || !b) return 0;
    const max = Math.max(a.length, b.length);
    if (!max) return 1;
    return 1 - levenshtein(a, b) / max;
  }

  function levenshtein(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, index) => index);
    for (let i = 1; i <= a.length; i += 1) {
      let previous = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const saved = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
        previous = saved;
      }
    }
    return row[b.length];
  }

  function isVisible(element) {
    const style = getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
  }

  function cssEscape(value) {
    return globalThis.CSS?.escape ? CSS.escape(value) : String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }
})();
