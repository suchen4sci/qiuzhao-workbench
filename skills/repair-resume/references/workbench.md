# 秋招工作台操作入口

此文件是本机实现索引，使用前核对实际路径和接口，避免依赖过期版本。

## 发现与连接

- 工作台关闭恢复：`application-tabs.json` 保存标签编号、公司分组及活动标签，`.bak` 为上一份有效快照。恢复前先备份，不把空白练习页状态覆盖到历史记录。新版本 `session-retention.cjs` 用系统加密保存临时 Cookie 和按标签/来源隔离的 sessionStorage；正常关闭先完成保存与浏览器存储落盘。网站过期、服务端注销或验证码仍可能需要本人登录。凭据备份不可打印、上传或写入通用技能正文。

- 现有本机工作区：`用户设置的 QIUZHAO_WORKSPACE`；应用代码在其 `秋招桌面助手` 子目录。找不到时定位用户现有工作区，不建立第二套知识库。
- 从 `%APPDATA%/QiuzhaoWorkbench/app-connection.json` 获取当前 CDP 端口和进程。使用应用依赖 `playwright-core` 的 `chromium.connectOverCDP`，定位 `/src/ui/index.html` 壳页面及当前招聘页。
- 私人事实使用现有知识库及其来源状态。浏览器自动化的安全参考在已安装 `qiuzhao-assistant/references/browser-safety.md`；只读取当前操作需要的内容，现有用户授权优先。
- UI 的 `window.__aiReaderState`、`window.__aiReaderHeartbeat` 及私人 `artifacts/ai-reader` 日志可用于核验已有任务。CLI任务不等于当前聊天自动出现消息；按钮文案不能替代实际执行证据。

## 查代码与验证

- 先检查应用 `AGENTS.md`（若有）、`package.json`、现有映射/控件执行代码，以及 `知识库/06-网站适配/通用控件与快速填写` 中相关经验。
- `scripts/update-live-engine.cjs`：修复后更新运行中的引擎，先读其参数和行为。
- 壳页面当前实际快速填写入口是 `run('fill')`。调用前确认无其他任务占用，之后读取报告及真实网页值。若版本已变，以现有按钮处理代码为准。
- `node scripts/run-regression.cjs --list`：列出现有回归测试；`npm run test:regression`：隔离运行完整回归，不在真实简历上删除数据。选择针对性测试时同时覆盖受影响的原结构与新增结构。
- `src/ai-reader.cjs`、`scripts/ai-reader-service.cjs`：AI后台与独立验证。修补表单时不得为通过验证修改 runner/schema、关闭验证器或重复启动后台任务。

把字段快照、运行证据及结果留在私人 artifacts 目录。日志可能含完整简历、邮箱邀请链接等敏感数据，不公开上传。

## 投递结果同步

- 工作台真实数据服务通常为 `http://127.0.0.1:33210`；先读 `GET /api/jobs`，返回 `jobs` 与 `workbookPath`。必要时使用 `秋招看板/网页看板/launch-dashboard.ps1 -NoBrowser` 启动，避免另建账本。
- 新岗位使用 `POST /api/jobs`；现有岗位使用 `PATCH /api/jobs/{记录ID}`，正文为 `{patch, expectedVersion: 原记录.__version}`。冲突时重新读取并保留用户更改，不能盲覆盖。
- 主要字段：公司名称、投递岗位、当前状态、地区、投递日期、投递链接、简历附件、下一步行动、状态核验日期、备注。状态取页面实际支持值；通常用“待投递”加备注表示已准备待确认，用“已投递”表示有成功证据。
- `dashboard-import` 当前仅支持本人确认已投递的导入，不能用它同步未提交草稿。草稿直接使用上述岗位接口写真实状态。
- 此分享版服务写入私人工作区的 投递记录.json（原本机版使用 Excel）；完成后再次 GET 核对记录，并保存同步前快照和同步后摘要。不能只调用接口而不核验响应，也不能只改标签页状态替代岗位管理同步。


## 学习落地的模块索引

以当前实现核验下面入口；这些是排查方向，不能仅修改参考文件就宣称快速填写已修复。

- 字段与栏目语义：`src/rules.cjs`、`src/profile.cjs`；事实从私人知识库读取，记录身份先于字段匹配。
- 教育/校园/考试记录身份：`src/education-identity.cjs`、`src/campus-identity.cjs`、`src/phoenix-record-repair.cjs`、`src/phoenix-internship.cjs`。独立正式工作与实习结构须同时保留。
- 定义列表及地区/日期控件：`src/definition-controls.cjs`、`src/region.cjs`、现有对应平台执行器；不要移除只读或绕开真实选项。
- 考试合法性与字段文本格式：`src/english-policy.cjs`、`src/text-formatting.cjs`；规则从私人网站适配目录读取，记住已实测的整数约束，避免校验提示消失后又写入不合法小数。
- 已验证解析纠错：私人知识库 `06-网站适配/已确认解析纠错.json`；字段格式：`06-网站适配/通用控件与快速填写/字段格式映射.json`。只追加确切匹配规则，不替换整个文件。
- 快速填写异步运行：启动 `run('fill')` 后读取壳页 `busy`、`lastReport` 及运行版本；执行期间不能换活动标签。必须等完成、回读，再保存或进入预览。
- 修复状态与每公司证据：私人 `outputs` 批次目录；保存已落地、待处理及实测范围，报告中不把隔离回归当成所有旧网站现场验证。
