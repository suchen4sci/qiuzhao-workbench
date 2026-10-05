# F4 / F7 · 事件—计划—申请—岗位关联独立审查

日期：2026-10-03。范围：workflow.event、event-context、BYOK briefings、hosted.quoteBriefing/adopt、事件编辑与计划入口，以及会议 URL 打开链路。仅新增独立测试与本文，未修改业务实现。

## 已验证的正确行为

- 同一家单位多岗位时，选定申请/计划决定准确岗位，不按单位名称猜测；只有计划尚无申请时仍能读取该岗位 JD，而且不会创建申请或标记已投递。
- 旧版只有 applicationId 的事件可经申请解析 plan/opportunity，后续编辑补齐关联字段。
- 事件修改拒绝跨单位、申请与计划不一致和过时 revision；旧关联保存在 history，任务 applicationId 同步更新。显式解除关联后不继续使用旧岗位。
- BYOK 实际模型输入携带正确岗位 title/description；托管报价输入携带同一计划岗位的 description；aiJobs 和本地 briefing 留下 opportunityId/opportunityRevision。
- 当计划重绑到另一岗位，event-context 阻断旧关联；两个 AI 路径都在正文读取/模型调用/托管报价网络之前拒绝，不静默改用新 JD。用户显式重新保存事件后可采用新关联。

UI 静态检查：planOpen 使用 event-new-plan 携带计划 ID；eventEditor 默认选当前申请或计划，只列同单位目标，更换单位清空选择；详情显示岗位名或明确未关联。主 Agent 另做真实 GUI 验证，本报告不将静态检查表述为已自行执行 GUI。

## 初审发现

1. **P2：计划岗位清空未触发旧事件失效。** event-context 条件只在 plan.opportunityId 非空时比较。计划由某岗位改为待选岗位后，旧 event.opportunityId 仍被接受，继续发送旧 JD。独立测试可复现；应在 plan 存在时比较，包含空值。
2. **P2：会议链接 fragment 被删除。** publicUrl 为来源去重清空 hash，直接用于 workflow 保存和 main 打开会将会议链接的 fragment 丢失。query 已保留。应在复用公开 HTTPS 校验后保留完整原 URL，避免改变来源去重所依赖的默认行为。

两项已反馈主 Agent，最终修复与验证结果见后续补充。

## 独立测试范围与边界

测试文件：`desktop/tests/event-association-review.test.cjs`。包含同单位多岗、无申请计划、legacy application-only、关联修改/解除和历史、跨单位/混合关系拒绝、重绑与清空 stale、两种 AI 输入和岗位版本、stale 在网络前拒绝、会议 URL query/fragment 与危险协议过滤。

所有模型、网页、托管请求使用受控 stub，无真实用户邮件、个人资料或生产付费调用。会议打开 main 读取已存事件 ID 后验证 URL，再使用 shell.openExternal；UI 仅显式 event-url 按钮调用，不因查看卡片/详情自动打开，不切换现有网申视图。实际系统默认浏览器/会议提供商跳转行为不由单元测试证明。

现阶段 opportunityRevision 已记录；已有简报卡片基于该版本显示“待更新”的统一状态属于后续面试状态呈现工作，不因本次关联链路修复自动宣称完成。

## 修复复核与最终结论

主 Agent 修复后，本 Agent 重新运行独立测试：**9 passed / 0 failed**。计划清空现与重绑同样触发 stale 拒绝；新增 `meetingUrl` 先复用 publicUrl 校验，再返回完整 URL，workflow 保存及 main 打开统一使用，query 与 fragment 均保留，来源去重规则未改。上述两项 P2 已关闭。

结论：本次事件关联与会议 URL 子功能独立审查通过。实际 GUI 由主 Agent 独立复跑；真实会议网站、外部模型和 Windows 系统跳转不属于本次已验证范围。
