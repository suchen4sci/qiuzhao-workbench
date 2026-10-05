# S12 面试准备简报独立审查

审查日期：2026-10-03。范围：`desktop/src/services/briefings.cjs`、`workbench.cjs` 的 briefing 命令与生命周期接入、`src/ui/workbench.js` 的生成/取消/阅读入口。

结论：当前明确范围内通过离线代码审查及 16 项独立回归测试。范围为 BYOK、用户提供 1–5 个公开 HTTPS 链接、来源逐字引用、单独标识的待核实推断及准备建议。没有托管搜索、平台收费或自动采纳个人经历。

## 发现与修复复核

1. 原 UI 只有生成按钮，虽然服务暴露 `briefing-cancel`，用户无法取消正在读取或调用模型的任务。已由主代理补充生成表单中始终可用的取消按钮、面试详情中的运行任务取消入口与 action 分发。动态执行实际 briefingEditor 函数验证取消按钮使用当前任务 ID；服务测试验证取消后不接受忽略 abort 的 reader/model 晚结果。
2. 原生成表单在失败后沿用 requestId；服务为了幂等返回 failed 记录，UI 将其当成功交付，关闭表单且不真正重试。已由主代理改为非 ready 结果报错，失败时准备新的 requestId，下一次显式提交才启动新请求，并显示新的供应商费用提醒。动态 UI 回归覆盖 requestId 更新、取消按钮 ID 同步及 failed 不当成功。
3. 原服务允许同一面试以不同 requestId 同时生成。已由主代理加入同 event 运行任务检查，回归验证第二个任务在 reader 之前拒绝，避免重复外部调用。

以上修复均已复核；本审查未改业务代码。

## 验证证据

运行：`node --test desktop/tests/briefings-review.test.cjs`，16/16 通过。

- 引文必须属于指定来源，且是连续原文；模型额外 claim 不进入事实记录；无事实拒绝交付。
- 默认不读取/发送个人资料；opt-in 只发送教育、实习、项目、校园、技能的明确字符串白名单，独立联系方式和证明人字段不发送。自由描述可能含个人信息，UI 已提示。
- 确认缺失、链接数量不合规及不安全 URL 在读取前拒绝。
- 同 requestId 运行中/完成后重放不重复调用；范围变化拒绝；失败重放保留失败且不产生额外调用。
- 来源文本、URL、读取时间和 SHA256 被持久化；推断与建议独立标识；原有笔记保持原值和 revision。
- reader/model 两阶段取消均阻断晚交付；close 先标 interrupted，再阻断晚写入；重新打开状态正确；启动恢复 running 任务。
- briefing 与 ready job 原子写入；注入 job 写入异常后 briefing 回滚且任务记录 failed。
- `workbench.cjs` 具备 generate/cancel 分发、snapshot 暴露及 store.close 之前的 briefings.close；UI 阅读转义引文与来源，显示生成时间及事件 revision 变化提醒。

## personalEvidence 补充复核

新增可选个人依据数组已复核：服务只把显式授权且经字段白名单过滤的 experiences 传给验证器；group 必须是 own property，index 必须为非负整数且对应记录存在，field 必须为记录 own property，quote 必须是该字段的连续原文。校验通过后保留 profileHash、字段位置与引文，relevance 在正文明确显示为“待核实关联”。原模型输出不包含 personalEvidence 时兼容为空数组。

补充两项服务级回归：未授权引用拒绝交付、授权原文正确持久化及标识；伪造经历、证明人/联系方式字段、原型属性、负数/越界/字符串/小数 index 全部拒绝交付且任务记录 failed。总计 16/16 通过，无新增阻断发现。relevance 为模型关联分析，并不因引文通过校验而成为已证实事实。

## 验证边界

没有验证真实模型服务、供应商实际计费、真实页面文本质量或 Electron 完整点击流程。UI 回归使用 VM 执行实际编辑器函数及 mock DOM 表单，不等于全量桌面端到端测试。来源 reader 的真实请求已在本次整体任务中因 DNS 返回受限地址而被拒绝；本审查未绕过公网地址保护，也未重试该外部请求。

来源引文保证可回溯，不代表网页内容真实或权威；个人经历自由文本是否包含敏感信息仍由用户确认。当前模式不承担自动联网搜索、来源权威性评级或托管付费交付。
