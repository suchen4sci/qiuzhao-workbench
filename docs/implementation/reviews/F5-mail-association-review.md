# F5 申请编号与邮件关联独立审查

日期：2026-10-03。范围：workflow.applicationReference、confirmSubmission 可选编号、Workbench 命令、associateApplication 与 mail.ingest 集成、邮件确认及计划详情 UI。本次仅新增独立测试和本报告，未修改业务实现或提交。

## 结论

新增独立测试 **14 / 14 通过**；与邮件自动更新 15 项、工作流 7 项组合运行 **36 / 36 通过**。发现 1 项提交弹窗编号回归，主实现已修复，已复核当前源码。当前无遗留阻塞 P1/P2。

## 发现与修复

原 submission-confirm 弹窗的申请编号输入始终为空。草稿此前通过“核对 / 修改申请编号”登记的编号，在用户按默认值确认提交时会被空字符串覆盖。已向主实现报告；最新弹窗从当前 application.referenceNumber 预填。后端独立用例同时验证未传 referenceNumber 时保留草稿编号。主实现已提供真实 Electron 邮件关联预选、事件关联、计划详情改编号首次烟测通过；主实现随后确认扩展草稿 D-3 提交后仍保存 D-3 的真实 Electron 烟测通过。本报告不将其计入独立测试数量。

## 已验证边界

- 只在已唯一识别的同机构 submitted 申请中查找；草稿、其他机构相同/不同编号、未知机构均不会自动关联。
- 编号大小写与岗位名称均精确匹配。多个编号、多个岗位、编号与岗位交集不一致均冲突。同标题不同批次保持歧义；明确编号可在同公司多申请中唯一定位。
- 只接受完整行标签；正文随意提到编号不作为关联依据。重复相同标签值可去重。
- 单个已提交申请但没有明确标签时保持 unlinked，不猜测申请；同公司多个已提交申请且缺少标签时阻止自动创建和更新。
- 实际 RFC 邮件经过 mailparser 后可创建带 applicationId、planId 的事件和带 applicationId 的 pending 任务；不新增申请、不新增完成 Activity。
- 同线程另一申请编号不会改绑事件，也不会另建重复事件；同申请可更新原事件，手改事件后继续受自动更新保护。
- 冲突或缺少标签的多申请邮件即便拥有已知线程，仍保持 pending；事件内容不变。
- 手动确认跨公司关联被 workflow 拒绝，事件和 confirmation 不留下部分写入。
- 修改编号必须具有最新 revision、明确确认和非空证据；非法字符拒绝。提交快照冻结当时的 referenceNumber；后续编号修改/清空保留审计历史，不改变状态、原编号快照或完成 Activity，独立用例已断言快照原值 A-1。
- 同机构重复编号拒绝、不同机构允许复用。提交时重复编号错误会回滚提交快照与申请状态。草稿登记编号本身不产生投递或完成记录。
- 静态复核 UI：邮箱确认按机构列出申请，切换机构刷新选项，选择既有事件回填关联；计划详情可核对编号；提交弹窗预填已有编号；Workbench 已暴露 application-reference。

## 验证记录与范围

运行 `node --test desktop/tests/mail-association-review.test.cjs desktop/tests/mail-update-review.test.cjs desktop/tests/workflow.test.cjs`，36 通过，无失败、跳过或 TODO。使用临时真实 SQLite、实际 mailparser、合成邮件、可控工作流时间与内存凭据容器；未连接真实邮箱或发送消息。

此实现是明确文本规则，不是自然语言全量解析，也不是发件人身份认证；不确定邮件进入人工核对。手动关联可选择草稿，但不会把草稿标记为 submitted；自动关联只使用已登记提交的申请。
