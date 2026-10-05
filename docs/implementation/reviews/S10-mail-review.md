# S10 邮箱基础链路独立审查

审查日期：2026-10-03。范围：`mail.cjs`、`mail-rules.cjs`、`secret-vault.cjs`、workbench/main 接线、connections/confirmations UI、备份中的原始邮件。审查人仅新增测试与此文档；产品修复由主代理实施。

## 结论

只读 IMAP 与本地待确认基础链路已具备；**不能据此标记完整 S10 完成**。已增加用户显式开启的窄范围自动创建规则；真实邮箱联网验收、真实系统钥匙串验收仍未进行。默认关闭自动创建，未满足完整规则条件的提案需用户确认。

## 发现与状态

1. **P1，已由主代理修复并复验：UIDVALIDITY 换代空页丢新邮件。** 旧 cursor=100，新 UIDVALIDITY 首轮无结果时，仅保存新 validity 而未清 cursor，下轮从 101 查询而错过新 UID=1。现在换代时查询前持久清 cursor；新增测试通过。
2. **P1，已由主代理修复并复验：不同附件原文被误判重复。** 无 Message-ID、同主题/正文、不同附件会合并，第二份原文未保留。现在无 Message-ID 使用 rawHash，有 Message-ID 纳入附件及 HTML 指纹。无 Message-ID 的两份附件差异邮件测试通过。
3. **P2，已由主代理修复并复验：Offer 发出时间被当作截止。** `mail-rules.cjs` 全文任意位置出现“截止”，就把唯一 ISO 时间作为 deadline。例如“发出时间 2026-10-03T08:00:00+08:00。回复截止时间将在附件中另行通知。”得到发出时间的 deadline，且 confidence=structured。现在仅从紧邻标签提取时间；该反例留空且 needs_review，显式面试开始与回复截止分别提取的测试通过。复杂否定语义、转发历史仍需用户核对。
4. **P2，已由主代理修复并复验：邮件改期清空原事件字段。** `mail.confirm` 将 UI 的部分 event payload 直接送入 `workflow.event`。该表单不传 location/url/endsAt/applicationId/final；workflow 的默认空值覆盖原值。已复现地点、会议 URL、结束时间丢失；申请关联/final 由源码确认相同路径。现在合并原事件后应用提交字段；地点、URL、结束时间保留测试通过。旧结束时间早于改后开始仍会被正确拒绝，UI 需允许用户核对或清除结束时间，不能自动猜测。

## 新增验证

`desktop/tests/mail-review.test.cjs` 共 17 项：50 条分页与重复同步、UID 换代空页、同步并发拒绝/断开停止后不落库、无 Message-ID 附件差异保留、Offer 错误截止回归、确认事务故障回滚、原始 .eml 备份恢复/授权码排除、密钥库拒绝 basic_text/加密格式、超大邮件不下载正文、改期保留信息回归、显式开始与截止区分。

运行 `node --test desktop/tests/mail.test.cjs desktop/tests/mail-review.test.cjs`。原有 4 项与新增 17 项合计 21/21 通过；原缺陷刻画测试均已改为正确行为回归断言。

## 已核对的边界

- IMAP 固定 TLS/993、只读 mailbox lock、logger/logRaw 关闭；正文仅标题关键词匹配后下载。一次最多 50 条；2 MB 上限，超限待确认并推进 cursor。
- 主进程每 15 分钟及系统 resume 同步，同一连接并发被拒绝。停止检查覆盖异步 connect/search/fetch/parse 返回后；断开会清凭据并保持 disconnected。
- 读邮件仅更新 readAt；确认创建事件产生 pending task，未伪造完成活动。取消/改期需显式 eventId 与当前 eventRevision。
- 本地 .eml 原文按 SHA-256 留存并进入备份；恢复写新工作区，校验 rawHash，连接被断开。凭据存 userData 的 safeStorage 文件，不在工作区备份；测试使用替身加密实现，未实际测试平台钥匙串。
- main/UI 未提供发信动作；邮件正文不进入模型调用。UI 使用转义文本而非渲染邮件 HTML；普通 snapshot messages 去 text，但 confirmations.proposal.evidence 仍包含本地正文摘要，应继续只限本地 renderer 使用。
- 文件落盘发生在数据库事务之前；数据库失败可能留下孤立 .eml，备份仅纳入有记录原文。这不是逻辑记录半提交，但后续可补垃圾清理策略。

## 窄范围自动创建追加审查

主代理新增 autoCreate（默认 false）及完整 senderAddresses 白名单。满足显式配置、完整 From 地址匹配、唯一已知机构、带标签的明确 ISO 时间、创建动作且无附件，才自动建事件并将确认记录标为 user_configured_rule。生成任务为 pending，不产生完成活动；重复导入不重复建事件；开启自动规则不会追溯处理已存在的待确认邮件。真实发件身份未验证，UI 明示该限制。

追加发现并修复 P1：原先仅标题识别取消/改期，正文取消仍可能自动创建。现对标题与正文整体识别取消/改期，同时历史引用和否定标记降为人工核对。新增正文取消、改期、历史引用、否定、未知时间、有附件、非白名单/多个发件人、本地导入、关闭配置、幂等与自动创建失败原子回滚测试，全部通过。有限关键字规则无法理解任意自然语言；其安全边界依赖用户明确选择自动规则适用发件地址，不能宣传为身份认证或通用可靠语义识别。

邮件确认 UI 已增加结束时间、地点、链接，并在选择既有事件时载入原值，允许用户核对/清空旧结束时间；本轮对该 UI 为源码审查，未真实邮箱测试。
