# F6 / F7 · 面试状态、阅读、来源与导出独立审查

日期：2026-10-03。范围：`ui/interview-preparation.js`、workbench 卡片/下一场定位/分段阅读、新 `services/interview-materials.cjs`、main 来源打开和原生保存入口。本 Agent 仅新增独立测试与本文，未修改业务实现。

## 结论

本次子功能审查通过。独立测试 **10 / 10**，连同原有 3 项，共 **13 passed / 0 failed**。既有简报与笔记可在无 AI 配置时本地读取和导出，不自动创建模型任务。UI 的真实滚动定位和原生保存由主 Agent 执行 GUI 验证，本轮不将函数测试混称为操作系统端到端验收。

## 初审发现与修复复核

| 发现 | 修复后证据 |
|---|---|
| 事件保留旧 opportunityId 时，计划改绑/清空未显示 stale | summary 增加 associationStale，覆盖清空、重绑、缺失、跨单位与申请/计划不一致；独立回归通过 |
| 导出未取得当前资料 hash，界面与导出可能 stale 结论不同 | interviewMaterials 接收本地 profileHash callback，workbench 注入 facts.read().hash；读取失败标 profileUnavailable；新测试确认仍保留并导出材料/笔记同时提示核对 |
| 详情 `.at(-1)` 与卡片/导出 newest 排序不一致 | interviewOpen 改为 preparation(e).briefing；详情、卡片、导出使用相同按 createdAt/id 排序规则；独立逆序数据测试通过 |

上述三项已关闭。

## 独立验证覆盖

- 时间状态：旧失败任务不覆盖更新的 ready 简报；新的 queued/running/pending_remote 优先显示生成中，失败后仍可阅读已有简报；quoted 和 empty 明确区分。
- 陈旧状态：eventRevision、opportunityRevision、岗位缺失、个人 hash 改变/不可读取、申请/计划关联变化都能提示核对，不阻止阅读或导出旧结果。
- 下一场：排除已完成、取消、结束和无效日期；当前进行中的面试优先于后续场；imminent 从开始前 30 分钟至实际结束前，精确结束时不再显示进行中。
- 源链接：只能由已保存 briefingId + sourceId 解析，调用方另传 URL 被忽略；缺失/非 ready 简报、无此 sourceId、file/javascript、带凭据 URL、本机 IP 拒绝；合法 HTTPS query 与 fragment 保留。
- 导出：包含当前岗位记录、生成时间、来源 URL 与读取时间、原文引证、待核实推断、个人依据、体验/交流问题、独立笔记；无简报仅笔记时仍可导出；不包含其他场次笔记，不改写原记录、不创建 aiJobs、不依赖模型配置。

命令：`node --test desktop/tests/interview-materials-review.test.cjs desktop/tests/interview-materials.test.cjs`。

## UI / 主进程静态路径复核

- 卡片显示明确准备状态；临近且存在会议 URL 时才提供打开按钮，没有默认打开或自动生成。
- 今日轮播在 next 指向的可见卡片索引大于 0 时定位，历史日期不强行跳到今日；键盘、手动滑动和位置计数继续保留。
- 详情按来源事实、待核实推断、个人证据、体验问题分段；模型文本、URL、sourceId 与展示属性经 HTML 转义。
- 来源点击交给主进程从存储重新解析，`shell.openExternal` 在显式按钮操作后执行，未复用正在网申的浏览器视图。
- 导出先生成本地内容，再走系统保存对话框；取消不写文件；拒绝已存在的符号链接/非普通文件，普通保存权限为 0600。没有后台上传、自动收费或依赖托管账号权益。

## 保留边界

本次证明代码层链接校验和显式打开路径，不证明远程网站仍在线或内容仍正确。历史来源已失效时保留原 URL/抓取时间是必要证据，来源真实性仍需用户打开核验。真实系统默认浏览器、保存覆盖对话框、不同平台权限及窗口布局由主 Agent 的 GUI/平台验收补充，不纳入此处 13 项函数测试通过含义。
