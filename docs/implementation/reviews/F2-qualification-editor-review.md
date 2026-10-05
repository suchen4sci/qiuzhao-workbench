# F2 人工资格维护闭环独立审查

日期：2026-10-03。审查范围：`services/qualifications.cjs`、workbench `qualifications-save` 分派、UI `qualificationEditor / qualificationRead` 与动作、匹配后的恢复行为。

**结论：本轮服务逻辑与生产读值 helper 回归通过，未发现阻断。** 新增 `tests/qualification-editor-review.test.cjs`，运行 `node --test desktop/tests/qualification-editor-review.test.cjs`，5 passed / 0 failed。未修改业务实现。

## 独立验证结果

1. 多路径按 OR、路径内多条件按 AND。先保存明确不符条件时排除，改为任一路径满足后重新进入推荐；清空全部规则后回到 unknown / verify，未自动变为资格通过。
2. 未核验且无原文的条件、缺失个人证书资料、非 exact 的专业差异保留 unknown。明确核验且 exact 的专业差异可形成过滤。
3. 字段白名单、operator 适用范围、学历取值、年限、届别、无效值、无证据 verified、非布尔标记、内网/脚本来源链接、空路径及路径/规则上限均被拒绝，拒绝后无快照写入。
4. 旧 revision 和未确认保存被拒绝；注入机会写入故障后，先建立的审查快照与机会变更一起回滚。正常保存记录每次快照。
5. 操作前后个人事实、已有计划及任务完全相同；维护资格不会重建计划、调整日期或改写个人资料。
6. 运行生产 `qualificationRead` 和标签编码 helper，确认两条路径、全部 rule 字段、未选 verified/exact、引号与逗号值、原文文本均正确读取。

## UI 核对及限制

- 岗位详情具备“按公告核验资格”入口；新增/删除路径与条件先读取当前表单，再重绘，避免正常编辑丢失。
- 路径全部移除时明确提示清空后回到待核实；保留空路径时服务拒绝保存，提示移除空路径。
- UI 显示多路径任一满足、路径内同时满足、初步筛选及资料未知不直接排除。保存需要明确确认，revision 固定为开始编辑时的岗位版本。
- 外部岗位标题、原文、来源与标签在 HTML 中转义。生产读值 helper 回归使用最小 FormData/DOM 适配器，**不代表已独立完成实际 Electron UI 操作或 DOM XSS 场景**；实际浏览器流程由主 Agent 补验。
- 本轮只核对人工维护与匹配，不证明真实公告已核验，也不将用户勾选转化为官方最终报名资格认定。
