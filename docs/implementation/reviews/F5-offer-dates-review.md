# F5 邮件时间与 Offer 日期独立审查

日期：2026-10-03。范围：mail.cjs、mail-rules.cjs、workflow.cjs、calendar.cjs 及 mailConfirmation/eventEditor 相关 UI。审查者仅新增 tests/offer-dates-review.test.cjs 和本报告，未修改业务实现或提交。

## 结论

新增独立测试 **11 / 11 通过**，既有 mail-review **17 / 17 通过**，合计 **28 / 28 通过**，0 失败、0 跳过、0 TODO。本次发现的必修问题均已修复并复核，目前无遗留阻塞 P1/P2。

## 发现与修复

1. **Offer 正文提及面试被错分类。** 原全文面试优先导致“Offer 录用通知，感谢参加面试”判为 interview。最新以主题明确类型优先，Offer 主题保留 Offer 日期语义；独立用例通过。
2. **入职截止误作回复截止。** 原通用“截止”匹配可将入职/报到截止作为任务 due。最新 Offer 只将明确回复截止填入 proposal deadline/offerReplyDeadline；只有入职截止的邮件不生成回复截止。
3. **邮件更新表单清掉历史 Offer 日期。** 原所有字段从新 proposal 出发并提交空串，更新回复截止会擦掉旧发出/收到/入职。最新选择既有事件时回填已保存字段，同机构同类型才合并 proposal 明确时间；跟进邮件的服务器收件时间不替换原 Offer 收到时间。提取当前真实 mailConfirmation 函数、执行选中回填并调用真实 mail.confirm 的独立测试通过。
4. **同一个回复截止在编辑页要求改两遍。** 原通用 deadline 和专用 reply 同时保留，编辑专用日期会与旧 generic 冲突。最新 Offer 隐藏通用截止，使用单个回复截止，旧 generic 值先回填供核对，提交 generic deadline 空值；服务层仍拒绝显式矛盾的双截止。
5. **专用回复日期的取消/恢复历史丢失。** taskStatus 原历史只记 startsAt/deadline，calendar 在新 Offer 语义下找不到回复日。最新状态历史保存四个 Offer 日期；取消与恢复均在回复日显示历史，独立复现从 0 条变为正确 2 条。

## 日期语义已验证

- 邮件 Date 头仅为 sentAt；本地导入时 receivedAt 为空、receivedAtSource=unknown，importedAt 单独取导入时钟。不能把发件头或导入时间当收到时间。
- IMAP fetch 请求 internalDate，写 receivedAt 并标记 mail_server；发件、收件、导入三个不同时刻保持独立。Offer 草稿只有 mail_server 来源才预填收到时间。
- 旧 messages 只有 receivedAt 而没有 receivedAtSource 时，不升级成可信 Offer 收件。UI 标识为历史时间、来源未核验，不伪造来源。
- offerIssuedAt、offerReceivedAt、offerReplyDeadline、joiningAt 分别保存。Offer 任务 dueAt/plannedOn 只来自专用回复截止或明确通用操作截止；task.startsAt 为空，避免旧通用开始时间被用于入职/回复提醒。
- 仅发出、收到、入职或旧 event.startsAt，不生成 Offer 截止提醒；原事件字段可保留，不推断其新语义。
- 回复截止修改保留另三日期及地点/链接，更新任务 dueAt、日历新排期和旧日的变更历史。历史同时记录旧四日期与新 toSchedule。
- 非法日历日期、缺时区时间、无效文本、显式互相矛盾的回复/操作截止均拒绝，事件与任务不发生部分写入。

## 验证

`node --test desktop/tests/offer-dates-review.test.cjs desktop/tests/mail-review.test.cjs`

使用临时真实 SQLite、实际 mailparser、模拟 IMAP internalDate、可控时钟及当前 UI 函数的表单替身；未连接真实邮箱，未发送邮件或系统通知。

主实现者另报告实际 Electron offer-dates-smoke 通过选择既有事件更新、保留三日期、eventEditor 单字段修改回复截止；该证据来自主实现者，未计入上述独立测试数量。

## 历史与提取边界

历史未知时间不自动回填成已证实收件/签发/入职时间；已有历史数据没有被全量重新解释。明确 ISO 带时区标签可进入草稿，模糊或日期缺时区仍由用户核对。本次不意味着对任意中文自然日期、附件或历史邮件内容都能自动分辨四类日期，也不证明发件地址真实性。
