# S09 多事件、任务、行动记录与月历：独立审查

审查日期：2026-10-03（Asia/Shanghai）。范围：`desktop/src/services/workflow.cjs` 的 event/task/completeTask/taskStatus/calendar/date/timestamp/dayOf，以及 `tests/workflow.test.cjs`。对照 Plan §4.2.2、F4/F6、ActivityRecord 和对应验收条目。仅审查服务；UI 尚未接入，不能视为整项验收通过。

结论：**需修复后复审**。现有 4 个 workflow 测试全部通过，但发现以下 3 个可复现问题。

## 必须修复

### S09-01 · P2 · 只有截止时间的事件在用户切换时区后落错月份

位置：workflow.cjs:158、209。

事件生成任务时将 deadline 按事件时区写入 plannedOn；calendar 优先使用这个固定日期而没有按当前用户时区转换 dueAt。复现：创建测评，deadline=`2026-09-30T23:00:00Z`，timezone=`Asia/Shanghai`；查询 `calendar('2026-09', 'America/New_York', 'planned')` 得到空 cells，查询 10 月却得到 `2026-10-01:1`。实际纽约日期是 9 月 30 日。带 startsAt 的事件没有同样问题，导致两种事件归日口径不一致。

建议：明确区分用户手工选择的无时区计划日期与从事件时间派生的日期。事件任务按 startsAt 或 deadline 在选定时区归日；手工计划日保留日历日期语义。加入 UTC 月末、反向跨月、闰日测试。

### S09-02 · P2 · 事件改期后旧提醒仍然 pending

位置：workflow.cjs:154–160。

event 更新事件及派生任务，但未撤销旧提醒。复现：为事件关联任务放入一条 pending reminder，再将事件 deadline 改期；旧 reminder 的状态、时间、revision 均原样保留。与 Plan「改期撤销旧提醒」不符；后续提醒服务消费该记录会在旧时间提醒。

建议：改期与旧提醒撤销在同一事务完成，新提醒由明确的重新排程入口生成；同时覆盖开始时间与截止时间变更，以及手工任务改期。无需因仅改标题而无意义地取消有效提醒。

### S09-03 · P2 · 手工任务改期和撤销后再完成会丢失历史回顾依据

位置：workflow.cjs:168–169、181–182、195–198。

手工任务编辑直接覆盖 plannedOn/dueAt，没有任何旧安排历史；taskStatus 清除完成时间/结果，不记录取消或复开轨迹。虽然撤销时 ActivityRecord 暂时保留旧结果，再次 completeTask 会用同一个 id 覆盖该记录，旧完成结果与日期随之消失。store audit 只记录操作与 revision，没有旧 document，无法还原。

复现：手工任务从 10 月 1 日改到 10 月 2 日，10 月 2 日完成并记录「历史结果」，复开后 10 月 3 日再次完成写入「新结果」；task.history 为 undefined，唯一 activity 仅余 10 月 3 日与「新结果」。这不虚增计数，但无法实现 Plan 要求的「过去日期详情可查看当时的安排及后续变化」。事件 history 也只保留部分旧时间，没有取消/复开状态变更。

建议：保留不可丢失的安排、状态、完成与撤销变更记录，或在当前记录附加完整历史。有效行动仍按稳定标识计数一次，撤销版本不可再计入热力。新增历史回顾接口/数据测试，确认旧日仍可追溯安排、改期、结果与撤销原因。

## 已验证

- `node --test desktop/tests/workflow.test.cjs`：4/4 通过。
- 正式申请任务不能绕过实际提交确认直接完成。
- 同一任务重复完成不会增加 activity；事件与派生任务共用一个稳定 activity id。
- 多个独立事件不会覆盖彼此；完成一个不影响另一个。
- 已完成行动按实际完成时间与请求时区归日；撤销后不计完成。
- 无效日期和未来完成被拒绝；事件改期保留旧 startsAt/deadline。
- startsAt 与 deadline 分字段保存；任务 dueAt 优先 deadline。
- `coverage: recorded_only` 避免服务声称数据覆盖全部真实活动；UI 仍需明确未记录/未覆盖语义。

## 后续集成复审范围

- 本轮服务没有跨来源 canonical action 绑定 API；同一动作由不同事件/手工任务录入时仍可重复计数。邮箱导入/合并接入后必须验证稳定事件关联与去重，不能仅凭每 task 幂等宣称已实现多来源去重。
- 当前 calendar 返回聚合，没有按日安排、历史结果、复盘查询；需验证实际 UI 接入后的历史详情、月历双模式和未知覆盖显示。
- 同日 0/1/多场面试、冲突、取消、跨天、键盘及窄窗口访问属于后续 UI 复审，不在本轮通过范围。

独立复现仅使用临时工作区，已清理；未修改实现、测试或 Git 状态。

## 第一次复审（2026-10-03）

状态：**部分修复，仍需修正后复审**。workflow 测试现为 7/7 通过。独立临时工作区验证结果：

- S09-01 原事件跨月问题已修复；但目前对所有 task 都将 dueAt 置于 plannedOn 之前，引入手工计划语义回归。手工任务 plannedOn=`2026-10-03`、dueAt=`2026-10-10T12:00:00Z`，计划月历返回 `{ '2026-10-10': 1 }`，丢失用户安排的 10 月 3 日。应区分 origin：event 由真实时间归日；manual/plan 优先显式计划日，截止独立呈现。
- S09-02 事件改期撤销旧 pending reminder 已修复。手工任务改期仍保留旧 pending reminder（实证从 10 月 10 日截止改到 10 月 11 日后原 reminder.status=`pending`）。正式调度未接入，但基础服务有写入提醒的数据结构和取消语义，应在任务改期同事务撤销，避免调度接入后沿用陈旧记录。
- S09-03 手工任务安排历史、activity 撤销及再次完成旧结果的保留已补充。剩余：未完成任务 pending→cancelled→pending 没有 activity，因此其取消/复开没有任何历史记录；同样 taskStatus 更新关联 event 不追加 history。实证 task.history 只含 create/reschedule。需在任务/事件状态变更处保存旧/新状态、时间和相关安排；未来按日回顾才能说明曾取消和恢复。

以上不涉及 UI 尚未接入的延期验收，属于当前服务层数据语义。

## 第二次复审（2026-10-03）

状态：**本轮服务层发现已关闭；通过有限范围复审**。此前记录保留为修复过程，不再代表当前未修复缺陷。

- S09-01 已关闭：按 origin 分流，event 按 startsAt/dueAt 在查看时区归日；manual/plan 优先明确 plannedOn。独立断言验证手工任务计划 10 月 3 日、截止 10 月 10 日在计划月历显示于 10 月 3 日。
- S09-02 已关闭：事件及手工任务改期均在保存安排的事务内撤销旧 pending 提醒。独立断言验证手工任务改期后原 reminder 为 cancelled。
- S09-03 已关闭：手工旧安排、撤销及重做前完成结果保留；taskStatus 追加 task 与 event 的 from/to 状态历史。独立断言覆盖 pending→cancelled→pending、scheduled→cancelled→scheduled、撤销后重做仍仅计一个有效行动且旧结果仍可查。
- 原 workflow 测试 7/7 通过，以上追加验证在临时工作区执行并清理，没有修改实现或测试。

验收界限：这次仅关闭已发现的服务层问题。按日历史展示、日期下钻、跨来源去重、正式提醒调度和 UI 多场面试仍按前述集成范围单独验收，不以本报告替代全功能验收。
