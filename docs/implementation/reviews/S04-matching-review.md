# S04 高召回搜索与资格匹配独立审查

审查时间：2026-10-03。范围：`desktop/src/services/matching.cjs`、`desktop/tests/matching.test.cjs`，对照 Plan F2.1 / F2.2。UI 尚未接入，本报告不代表端到端验收通过。未修改实现或 Git 状态。

结论：**所列四项缺陷已修复，匹配核心本轮复审通过**。首次审查的现有 4 项测试通过，额外 4 项边界断言失败；修复后正式测试 5/5 通过，独立重新执行原始 4 项边界断言也全部通过。完整搜索召回及 UI 验收仍受下述范围限制。

## 修复复审记录

- 无效规则值先返回 unknown，原始 `[null]` 误排除已消除。
- CET4 / CET6 有限明确别名可识别；其他无法确认的专业/证书名称不等保持 unknown（除非明确标记 exact）。
- 缺少毕业日期时回退到已有 `basic.graduationYear`，不再将已填年份覆盖为 undefined。
- 只要存在条件全部明确命中的方案，另一未知备选方案不会单独将结果降为 verify。
- 验证命令：`node --test desktop/tests/matching.test.cjs`，5 passed / 0 failed。另通过内联 Node assert 重放首次审查全部 4 项输入，4/4 通过。
- 接入复审仍需关注毕业日期与单独年份冲突的处理；当前修复只增加 fallback，日期仍优先。确认资料保存层是否已消除冲突后再判断资格链路是否可以验收。

## 首次发现（以下四项原始复现均已关闭）

1. **P1：畸形资格取值会被当作可靠冲突，误排除用户。** `matching.cjs:69,83` 只验证 `rule.values` 为非空数组，没有验证元素是否有效。已核验 `highestEducation oneOf [null]` 与本科用户比较后返回 `fail / excluded`。空字符串或对象也存在相同风险。规则的来源已核验不代表提取后的值有效；应先校验字段值，异常返回 unknown。
2. **P1：证书别名被当成明确不满足。** `matching.cjs:83` 对证书只进行文本完全相等比较。个人语言记录 `{name:'大学英语六级',score:'520'}`，公告结构化要求 `certificates oneOf ['CET6']`，被判 `fail / excluded`。应用既有 `rules.cjs` 已包含同类考试名称别名。应采用经确认的证书标识/别名；无法确认的自由文本不应直接构成排除依据。
3. **P2：覆盖掉已填写毕业年份。** `matching.cjs:65` 无条件从 `graduationDate` 派生 `graduationYear`；用户只填写既有资料字段 `basic.graduationYear:'2027'` 时被改成 undefined，导致所有届别资格显示“个人条件未填写”。应保留明确年份，只有缺失时再从日期派生；两者冲突需标记待核实。
4. **P2：额外未知方案降低已有确定命中的推荐层级。** `matching.cjs:112` 对所有匹配方案使用 `some(unknown)`。一条方案明确匹配企业路线，另一条方案要求销售但岗位方向缺失，即使个人资格、开放状态均已核验，也会由 recommended 变成 verify。组间 OR 的确定满足分支应足够；可保留其他方案未知解释，但不应要求所有备选方案都确定才能进入推荐层。

## 已确认行为

- 组间 OR、组内跨维度 AND、同维度多选 OR 正确，方案间条件不串用。
- 明确全局排除优先，缺失维度保留，软偏好不直接剔除。
- 资格路径 OR、路径内规则 AND，以及缺个人资料/未核验公告的 unknown 行为正确。
- 只有确认关闭才排除；关闭但未确认保留待核实。
- 匹配函数分别接收 profile 与 preferences，未观察到偏好写入个人事实的代码。UI 保存和网申数据流隔离仍需接入后复审。

## 实际验证

`node --test desktop/tests/matching.test.cjs`：4 passed / 0 failed。

使用 Node 内联 assert 执行 4 项额外边界测试：

| 输入场景 | 期望 | 实际 |
| --- | --- | --- |
| 已核验学历规则 values 为 [null] | included=true、unknown | included=false |
| basic 只有 graduationYear=2027 | 保留 2027 | undefined |
| 大学英语六级 vs CET6 | 保留，标准化或待核实 | included=false |
| 一个确定命中方案 + 一个未知方案 | recommended | verify |

以上测试不读取用户真实资料，使用内存虚构数据，未写入应用数据。

## 后续接入复审

搜索查询目前只输出逐维度关键词/别名：尚不能据此验收语义召回、相邻方向召回、来源覆盖与召回率。需对实际发现服务的多路检索、完整候选保留、排序、过滤原因恢复及资料修改重算进行集成测试。事实来源冲突、人工更正优先级与版本记录也需要在持久化和 UI 链路核对。
