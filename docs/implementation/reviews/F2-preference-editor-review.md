# F2 偏好编辑、预览与保存闭环独立复审

日期：2026-10-03。结论：**本轮逻辑审查与独立回归通过**。新增 `tests/preference-editor-review.test.cjs`，执行 `node --test desktop/tests/preference-editor-review.test.cjs`，6 passed / 0 failed。未修改业务代码。

## 审查发现与修复

发现 P2：原编辑器使用 join/split 处理标签，已有 `ACME, Inc.` 或 `甲、乙` 会在无修改保存时拆成两个标签，改变筛选语义。主 Agent 已增加带双引号的编码/解析；独立回归确认英文逗号、中文逗号、顿号、双引号标签可无损往返，未闭合引号和引号后的非法文字会拒绝解析。该项关闭。

主 Agent 另修复预览取消后旧 `preferenceDraft` 可能覆盖后续编辑的问题；静态确认预览函数不再写入该旧草稿。实际弹窗取消/再编辑行为以 Electron 场景测试为准。

## 已执行独立验证

- 加载并原样序列化全部 8 个维度：路线、性质、方向、城市、行业、工作方式、单位名称、关键词；必须/优先/全局必须/全局排除四个范围均保留，多条 route 不丢失。
- roundtrip 测试运行生产 `preferenceFields` 与 `preferenceFormValue`，用最小 FormData 适配器读出生产渲染字段；不把此测试声称为完整 DOM/浏览器验证。
- `previewPreferences` 只处理已加载样本，不写 preferences、opportunities 或 userOpportunities；模拟取消后持久化内容不变。
- 预览后其他操作保存新 revision，旧草稿保存被拒绝，当前内容不被覆盖。
- organization 从真实单位记录补充后可匹配；workMode / industry 在机会保存后可参与匹配。
- 优先城市不符保留为 explore；全局排除单位优先；`planAssessments` 保留失败方案的具体 mismatch。
- 直接提取生产模板表达式验证“考公技术”、两组 OR、四组任一即可、考研模板的组合语义。
- 引号标签编码往返及无效输入拒绝。

## 范围限制

本报告不声称已完成真实 Electron 的全部编辑/取消流程测试；主 Agent 正在执行该验证。本轮也不替代真实来源的召回率验证。未知资料和未核验公告仍保持待核实，不由偏好声明代替个人事实。
