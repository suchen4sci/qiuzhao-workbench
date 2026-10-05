# F5 BYOK 复杂邮件 AI 路径独立审查

日期：2026-10-03。范围：mail-ai.cjs、ai-client.cjs、Workbench mail-ai 命令及生命周期、mailAIOpen/mailAIReview UI。审查者仅新增 tests/mail-ai-review.test.cjs 与本报告，未修改业务代码或提交。

## 结论

新增独立测试 **18 / 18 通过**，与实现方 mail-ai.test.cjs 3 项组合 **21 / 21 通过**，无失败、跳过或 TODO。发现 1 项外发供应商确认竞态，已由主实现修复并独立验证；当前本路径无遗留阻塞 P1/P2。本审查只覆盖自带 Key 的复杂邮件解析草稿，不表示托管收费路径或全部 F5 已完成。

## 发现与修复

**确认时显示的供应商可能与调用时供应商不一致。** 原 UI 在打开片段选择时显示 baseUrl/model，run 随后读取最新 settings；若这期间设置变化，用户确认的供应商与实际接收片段的供应商可能不同。已报告主实现并修复：公开 config 返回配置指纹，UI 提交指纹，run 与最新配置比较后才允许调用，幂等 scopeHash 也绑定指纹。独立测试分别更换 baseUrl、model、API key，均在零调用、零任务写入时拒绝，重新读取配置指纹后可运行。

## 独立验证

- 必须明确 consent；发送内容必须是 subject + 换行 + text 的连续原文子串，非空且不超过 20000 字符。改写片段、超限、非法 offset、过期 confirmation revision 均调用前拒绝。
- 模型用户输入只有选中的 text 与字段定义；无附件、邮箱凭据、发件人、其他邮件、片段外正文或个人档案。供应商配置中的 API key 只交给模型客户端鉴权，不进入用户输入、公开 config 明文或持久任务。实际 ai-client 静态检查为 POST JSON，禁止重定向，有请求超时与响应体上限。
- 同 requestId 同作用域在 running/ready 时重用原任务，不重复调用；相同标识不同片段拒绝。
- 字段白名单、唯一 key、value/quote 长度、quote 属于所选原文、普通值属于 quote 的原文连续子串均受校验。虚构值、虚构引文、未知 key、重复字段和非法枚举导致失败，不改草稿。
- 年月日时分完整的原文日期仅在用户明确 offset 后转换。缺年份、相对日期、未确认时区、无效日历日期保留原文并禁止直接采用。显式 ISO 时区可直接转换。Offer 发出、回复截止、入职使用各自字段；无模型推断的 offerReceivedAt 字段。
- 不安全链接和无法解析的轮次仍展示原文及提示，但 adoptable=false。
- 取消会 abort；即使供应商忽略 signal 并晚回有效结果，也不会 ready 或改 confirmation。关闭时中止控制器，不尝试写已关闭 store；残留 running 任务在重启变 interrupted，提示可能已计费，绝不自动重试。
- 调用期间 confirmation 被忽略/处理或改版本会拒绝结果；ready 草稿采用前也核对 confirmation revision。过期任务不能覆盖用户更改。
- 采用需确认、非空且不重复的已知 adoptable IDs；只把所选字段放入 pending proposal，保存原 proposal 历史与原文证据，设置 needs_review、structuredUpdate=false。未选字段保持原值，不创建/修改事件、任务、申请或完成 Activity；同任务不能重复采用。
- 改机构/编号/岗位时重新计算申请关联，清空既有 eventId；跨机构编号冲突不会关联。未知机构和最后 job 状态写入故障均同事务回滚 confirmation 和证据。
- 改 type/action 也清空旧线程目标，要求重新核对既有事件。

## UI 与人工判断边界

静态检查 UI 展示供应商、模型、片段、费用及失败/取消可能计费说明；时区默认未知；显式确认后才运行。结果按字段展示原文值、转换值、quote、warning，checkbox 默认未勾选，不可采用项禁用；采用后返回邮件事件确认表单。运行中可停止，关闭/切换面板后不把异步结果插入错误面板，历史中可找回 ready 结果。

type/action 是受限枚举，引用存在校验不等于语义正确性证明；日期字段的“属于哪类时间”也仍需读原文人工核对。该路径依靠逐项人工确认及后续事件确认，不应宣传为自动执行通知或无需核对的准确解析。供应商调用被取消也不保证免计费。

## 验证记录

`node --test desktop/tests/mail-ai-review.test.cjs desktop/tests/mail-ai.test.cjs`：21 通过。独立测试使用临时真实 SQLite、合成邮件记录、注入模型返回与可控延迟；未向真实供应商发送数据，未连接邮箱，未产生收费。本报告的独立 UI 检查为源码复核。主实现另提供真实 Electron + 本机 HTTP 假模型 mail-ai-smoke.cjs 通过结果：初始零调用，只发送所选片段与字段（无私人段），用户选择 offset，展示 quote/转换值，勾选采用只修改 pending 草稿且零事件，第二次 mail-confirm 才创建 1 个事件、零完成 Activity。此烟测由主实现执行，不计入独立 18 项测试；后续中文日期/类型标签显示优化由主实现复跑 UI。
