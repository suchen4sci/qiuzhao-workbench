# S11 本地提醒：独立审查

日期：2026-10-03（Asia/Shanghai）。范围：`src/services/reminders.cjs`、`workbench.cjs` 的配置/快照/关闭集成、`main.cjs` 的通知与周期检查、`ui/workbench.js` 的 remindersPage，以及提醒测试。路径均相对于 `desktop`。

结论：**通过本轮本地任务提醒的有限范围复审**。发现的去重、恢复和关闭生命周期问题已在审查期间由实现方修复，并通过独立测试。真实系统通知显示和应用唤醒仍需平台实机验收。当前每日摘要只有任务统计，招聘来源摘要待 S05 接入，不能称 F2 全部完成。

## 已关闭发现

1. 原实现取消后不恢复相同 id 的提醒，关闭本地提醒后再次开启会漏掉仍然有效的未来任务。实现已将仍在 wanted 集合的 cancelled 记录恢复 pending。独立测试验证启用→禁用→启用→逾期只投递一次。
2. 原去重 id 含 task.history.length，手工任务仅编辑标题也会生成新提醒并再次投递。现使用任务 id、目标时刻和提前分钟组成身份。独立测试经真实 workflow.task 编辑标题，已投递截止提醒仍只有一条。
3. 原 tick 在 await notify 后继续访问 store，退出关闭数据库存在竞态。现引擎有 close 标记，workbench.close 先关闭引擎再关闭数据库；tick 入口及通知返回后检查关闭。独立测试挂起 notify、关闭引擎/数据库、释放 notify，返回 closed，无关闭后数据库访问；并发 tick 返回 busy。
4. 首次配置摘要时若 preferences 尚未建立，偏好页原先回退到启用/9点，保存其他偏好会静默覆盖提醒设置。workbench 快照的默认 notification 现读取提醒有效配置。独立测试先保存关闭/17点，再读取并保存偏好，仍保持关闭/17点。

## 验证结果

命令：`node --test desktop/tests/reminders.test.cjs desktop/tests/reminders-review.test.cjs`，共 **10/10 通过**，其中本审查新增 7 项回归测试。

- 关闭并重新打开 SQLite 数据库后，逾期 pending 提醒补投递一次，记录 late；重建调度引擎不再请求系统通知。
- 原测试覆盖改期撤销旧 pending 提醒、任务完成撤销 pending、每日摘要重复检查去重、已读记录与禁用静默。
- 纽约时区在 UTC 次日凌晨仍按当地前一日生成摘要；遵循 preferences 中的摘要小时，不提前生成；同日重复检查仍一条。
- 配置拒绝非法时区；通知抛错记录 failed，未声称已展示。main 的真实通知适配返回 requested，UI 显示“已请求系统”，并明确请求不代表已看见；中断留下 attempting 时 UI 显示“结果未知”。
- main 接入启动检查、30秒周期检查和 resume 检查；UI 说明依赖应用运行、恢复时补记，未承诺应用关闭期间依然运行。
- 系统通知默认关闭，开启选项明确说明可能包含任务名称；通知列表保留应用内记录。

## 验收边界

- P3 标题同步发现已关闭：pending reminder 现跟随任务标题变更，delivered 历史保留投递时标题；新增独立回归测试通过。
- 当前验证以服务测试和代码审查为主；未实际操作 macOS/Windows 通知权限、休眠恢复、通知点击、键盘操作和窄窗口布局，不能以10项测试替代这些端到端验收。
- 持久化先于系统通知，采用应用内恰好一次记录及系统通知至多一次请求策略。进程在请求前退出可能留下 unknown/attempting 而不重发，UI对此诚实；这不是系统通知可靠送达保证。
- 每日摘要仅统计任务，并未汇总招聘来源、官网动态或邮件。本报告不关闭该部分的集成验收。

审查只新增测试和本报告；产品实现的修复由主实现方完成。测试使用临时工作区并清理。

## 日期安排补充范围复审（2026-10-03）

结论：**日期提醒及 DST 补充范围通过有限范围复审**。新增 `tests/reminders-date-review.test.cjs` 8 项测试。运行 `node --test desktop/tests/reminders*.test.cjs`，当前全部 **18/18 通过**。

- manual/plan 任务只有 plannedOn 时按配置时区和 plannedHour 生成 planned 提醒；不假定日期本身包含精确时刻。到时投递，同一安排重复检查不重复。
- 关联岗位官网截止日期独立生成 deadline_date，与计划日期分开。targetAt 使用配置的本地提醒小时，dueAt 再减提前分钟；timeBasis 明确是 date_only_reminder_time，岗位原始日期保持不变。系统通知文案明确“具体时刻待核实”。
- 同任务面试 startsAt 与不同 dueAt 分别使用面试/截止提前量生成两个提醒；两时间相等时仅保留面试提醒。
- 时区变更撤销旧 pending 本地安排并生成新安排；夏令时跳跃保存 clockAdjusted。纽约 2026 春季不存在的 02:00 推到 03:00，秋季重复 01:00 选最早一次；Lord Howe 半小时跳跃推到 02:30。另验证 Kathmandu 的45分钟时区偏移、闰日与非法日期/小时。
- 审查发现新 kind 进入提醒 id 后会使旧版已投递记录重复投递。实现方已增加 taskId/kind/targetAt/dueAt 兼容匹配并优先复用 delivered；独立测试用旧三元组 hash id 验证重启后仍只有原记录，发现关闭。
- 审查发现整日被时区跳过（Pacific/Apia 2011-12-30）会使全次调度回滚。实现方已隔离单日期错误，写入 scheduler.issues/attention 并在 UI 展示；独立测试验证其他有效任务仍投递，发现关闭。

补充范围未改变原有边界：只在应用运行期间调度；招聘来源每日摘要未接入；原生系统通知及新增设置控件仍需桌面端到端验收。日期型提醒使用的是用户配置的提醒时刻，不应在其他页面把 targetAt 当作官网精确截止时间展示。
