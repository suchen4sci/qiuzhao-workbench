# S05 来源字段更新闭环独立审查

日期：2026-10-03。范围：sources.review/confirm/preview 的版本选择与字段更新、Workbench API、UI sourceConfirmation/sourceReview。审查者只新增测试、适配旧测试 fixture/helper 与本报告，未修改业务实现。

## 已复核机制

- 更新前提供旧/新字段差异；更新请求必须带草稿 revision、目标岗位 ID、岗位 revision、明确 updateFields 数组和 resetVerification 布尔值。
- 只有差异中勾选的 title/city/description/url/openedOn/deadline 被写入；未知字段、重复字段、不存在的差异字段、缺少明确选择和旧岗位版本均拒绝。
- 空 updateFields + false 明确保留记录，不修改机会 revision、不新增快照；草稿记录 kept_existing。
- 每次实际更新写 source_update 快照，包含完整 previous、patch、confirmationId、evidenceId、reviewedAt；机会 lastSourceReview 关联该快照及本次原文。
- 更新与快照、确认采用在同一事务；注入最后一步确认写入失败，机会及快照完整回滚，草稿仍 pending。
- 人工标题/描述等未勾选值、人工资格结构、开放状态核验依据、计划与任务保持不变；只有显式 resetVerification=true 才改 unknown/false。来源字段更新不是开放状态核验。
- externalId 存在时标题/城市变化仍匹配旧岗位；同单位同批次多个强 ID 候选要求选择具体目标，跨批次目标被拒绝。
- UI 显示逐字段前后值、默认不勾选、单独开放状态重置；机会详情另列最近来源字段核对和原文入口，与开放状态证据分开。此为源码复核，不是独立 Electron UI 验收。

## 审查发现与修复状态

1. **P2 来源 A→B→A 漏核对：已修复。** 原 normalized job 永久复用 accepted 草稿，回到历史正文时不产生新待确认。最新 source.proposalIds 记录上次候选集合，只复用连续相同候选；回退 A 新建 pending；非当前旧 pending 标记 superseded 并拒绝采用。
2. **P2 手工无编号同 URL 岗位未参与选择：已修复。** 原弱身份候选只查旧 accepted 来源记录，手工旧岗位被遗漏。最新手工同 URL 无编号岗位也进入候选，用户选具体旧岗位或新建。
3. **P2 无编号同名不同城误合并：已修复。** 原仅标题变化视弱身份，同 URL 同名不同城直接 update，不能选择新岗位。最新所有无 externalId 候选均要求弱身份选择并允许明确新建；独立用例可创建两个不同城市岗位。
4. **P2 首次升级缺 proposalIds 的回退迁移：已修复。** 原迁移 fallback 扫所有历史 accepted，旧数据 A→B 已确认后升级首轮回 A 仍复用 accepted A。最新从旧 source.evidenceId 留存正文 extractJobs 恢复上一页集合后再匹配；缺证据或不能解析时新建草稿而非扫描全部历史。独立迁移 ABA 用例通过。

## 测试与兼容

新增 `tests/source-update-review.test.cjs` 覆盖选择更新、完整快照、人工字段/资格/计划保护、显式保留、状态重置、旧版本/非法字段拒绝、回滚、强弱身份、正常及升级 ABA、superseded 防过期采用。

`tests/sources-review.test.cjs` 的 accept helper 已按新契约先 source-review，再显式 updateFields=[]/resetVerification=false；原人工标题、备注、原文和去重断言全部保留。

`tests/source-daily-review.test.cjs` 的 legacy fixture 去掉新字段 proposalIds，真实模拟旧 schema；原 legacy ID、accepted 状态及原证据复用断言保留。

最终运行 `node --test desktop/tests/source-update-review.test.cjs desktop/tests/sources-review.test.cjs desktop/tests/source-daily-review.test.cjs`：新增更新闭环 13 项、旧来源独立 13 项、每日来源独立 9 项，共 **35 / 35 通过**，0 失败、0 跳过、0 TODO。四项审查发现全部修复并复核，目前无遗留阻塞 P1/P2。测试使用临时真实 SQLite 和注入读页器，没有真实联网。

本次有限来源单页更新能力不等于全网招聘覆盖，100 岗位 / 连续 7 天基准仍未完成。
