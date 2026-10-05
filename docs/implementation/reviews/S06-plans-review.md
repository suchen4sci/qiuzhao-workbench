# S06 计划、草稿和提交闭环独立审查

审查日期：2026-10-03（Asia/Shanghai）。范围：`desktop/src/services/workflow.cjs` 的 organization / opportunity / watch / plan / collect / startApplication / confirmSubmission / bindAsset 及关联 taskStatus；参考 `store.cjs`、`profile-service.cjs`。本轮仅审查服务层，GUI 尚未接入，不能据此确认端到端完成。

结论：**需修复后复审**。现有 `node --test desktop/tests/workflow.test.cjs` 4/4 通过，但以下场景未覆盖。我在临时工作区运行服务调用复现了前 3 项，没有修改实现或 Git。

## 发现

1. **[P1] 填写中的计划可以改绑岗位，提交会完成错误岗位的任务。** `plan()` 允许用现有 id 把 opportunityId 从 A 改成 B，保留 `filling`，并把任务标题改为 B；既有 application 仍关联 A。随后提交 A 的 application，`confirmSubmission()` 直接按 planId 将 B 的计划和任务完成，产生“申请 B”的完成行动。复现：创建 A 计划 → startApplication → plan({...current, opportunityId: B.id}) → confirmSubmission(A)。需在已有草稿/提交后锁定计划的机构和岗位身份，或实现明确的迁移/新建流程；提交前验证 application、plan、task 关联一致性。

2. **[P1] 公司待选岗位计划绑定已有岗位时不去重，造成无法完成的重复计划。** 已有岗位 A 计划后，再创建 company-only 计划，并用其 id 绑定 A，得到两个活动计划与两个任务。对第二个计划 startApplication 会返回第一个计划的 application（返回对象的 planId 与调用方不同），不更新第二计划。提交只完成第一个计划。需按机构、岗位及批次的业务身份复用或合并计划，绑定时处理已有目标；应用复用也必须维护唯一一致的关联，不能只返回同岗位应用。当前默认 id 去重不足以覆盖待选岗位绑定路径。

3. **[P1] 提交快照记录确认时的全局资料，而非本次填写使用的资料。** `startApplication()` 保存资料 A；用户随后修改个人资料为 B；`confirmSubmission()` 重新读取全局 profile 并把 B 写入 submitted snapshot，application.profileHash 却仍为 A。临时复现中 submitted snapshot 姓名是“后改资料 B”，application 仍保存旧 hash。附件也在确认时从 asset 对象重新读取 hash，没有核对 app.assetHash。需把本次使用的资料/附件版本作为显式申请修订保存；确认时采用该修订，或让用户核对并明确更新，不能静默替换。后续真实浏览器整合还应保存实际回读字段与上传版本，以支持手改后的精确记录。

4. **[P2] 取消恢复后的草稿不会回到填写中。** `taskStatus(pending)` 对所有带岗位计划一律设 `planned`；已有草稿的计划取消后恢复，再 `startApplication` 会在 `if (old) return old` 提前返回，计划仍显示待投递。需按关联 application 的状态恢复计划状态，并验证取消/恢复/继续填写不会让计划数和草稿数产生误导。

## 通过或已有保护

- 创建岗位计划不会提前创建 application；company-only 计划为 awaiting_role，未绑定岗位不能开始填写。
- 相同默认机构、机会和计划 identity 的重复调用复用记录；草稿与提交分离，必须明确 confirmed 并提供证据，未来提交时间被拒绝。
- 同一 application 重复确认不会重复创建 snapshot 或 activity；完整提交在事务内。
- 已提交申请不能通过 bindAsset 修改附件；修改默认文件不直接改写已有快照。
- 已完成申请任务不能用普通 taskStatus 直接撤销成未完成。

## 补测与未完成验收

增加上述四个回归场景；补公司无岗位绑定、跨机构改绑拒绝、已有岗位绑定去重、资料编辑与申请修订分离、附件归档/替换后的版本稳定、取消恢复、机会 city 顺序变化不会重复建档的测试。当前机会 identity 使用 city.join('|')，城市集合顺序颠倒可生成另一条同 externalId 记录，应规范化集合或定义来源稳定 identity。

计划服务没有显式移除/归档入口；目前取消可通过任务入口实现。GUI 接入时应提供可发现的移除/恢复操作并规定关联任务、草稿及历史保留规则，不能直接依赖通用 store.remove 破坏引用。后续需端到端复审“公司/机会 → 计划 → 真实填写 → 回读 → 提交确认 → 精确快照 → 进度”。

## 第一次修复复审

再次执行 workflow 测试，7/7 通过。原发现 1（草稿后改绑）、发现 2 的活动计划绑定路径、发现 4（草稿恢复 filling）已通过代码复核；资料快照已采用 draft 中冻结的 profile/profileHash，修复原发现 3 的全局资料漂移。bindAsset 现在事务性更新 application 与 draft snapshot。

仍需处理：

- **[P1] 取消路径绕开计划唯一性。** plan() 的重复检查排除 cancelled：取消岗位 A 的旧计划后，可将另一个 company-only 计划绑定 A。如果旧计划有草稿，新计划 startApplication 被旧 application 占用而失败；如果恢复旧计划，taskStatus 没有重复检查，两个计划均可活动。应复用/明确恢复旧计划，或在有历史 application 时拒绝新绑定；恢复操作也应校验唯一性。
- **[P2] 提交附件 hash 仍取当前 asset 对象。** confirmSubmission 虽冻结了 profile，但仍保存 asset?.hash，未用已绑定的 app/draft assetHash，也未校验二者一致。需保留已确认的绑定版本，并在文件使用前校验内容，避免以后附件元数据更新使提交记录漂移。
- 现有冻结资料回归测试没有在 startApplication 后实际修改个人资料，建议增加该变化以保证测试能拦住原 bug。

浏览器运行冻结资料、实际填写与手改回读、真实附件上传版本仍留待集成审查；本轮不作端到端通过声明。

## 第二次修复复审

再次执行服务测试，7/7 通过。plan 的唯一性检查现已覆盖 cancelled 历史计划，关闭“取消后绑定第二计划”入口；confirmSubmission 校验 asset.hash 与绑定的 app.assetHash 一致，并以 app.assetHash 保存提交快照。**本报告提出的服务层阻断项已关闭；S06 服务层可进入集成验收。** 本结论替代前两轮“待修复”的服务层状态，不等同于 GUI/浏览器全流程通过。

main.cjs 已增加 application-open 与 executionProfile：打开草稿时建立 activeApplicationId，并由 draft snapshot 构建执行资料；run、资料刷新及 AI 流程可读取冻结资料。静态检查符合资料隔离方向。以下仍必须在浏览器/资产服务接入后验证：

1. 创建使用资料 A 的草稿后将全局资料改为 B；打开草稿、普通填写、手动字段选择、AI 建议与重新扫描均使用 A；切换另一申请时正确换版本，退出申请执行场景后恢复全局资料。回归测试应确实修改资料，而非只比较未变化的 hash。
2. 用户直接在官网把某字段改为 C，确认后应保存实际填写回读和差异；冻结基础资料 A 不能冒充实际提交字段 C。保存资料快照与实际提交表单记录应能区分。
3. 已绑定文件的磁盘内容被替换、文件丢失、归档以及默认简历改变时，上传必须校验绑定 hash；实际上传版本与提交快照一致。当前仅完成元数据一致性检查，未验磁盘内容。
4. 打开岗位链接失败、切换页面/申请、重启恢复、取消计划后继续填写，以及提交后的继续操作，应验证当前页面、activeApplicationId、计划、申请与快照不会错配。
5. 公司待选岗位绑定、重复选择/取消恢复、手动确认提交后的列表/计数/任务/月历联动，均需 GUI 端到端验收。
