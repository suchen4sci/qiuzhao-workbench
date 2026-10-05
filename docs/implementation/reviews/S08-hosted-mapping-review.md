# S08 托管字段映射独立审查

日期：2026-10-03。范围：`hosted-service/processors.cjs` 的 field-mapping、服务端价格白名单、`desktop/src/services/hosted.cjs` 的 quoteMapping/adoptMapping、main 的 ai-hosted/ai-confirm IPC、preload 白名单以及 ui/ai-reader.js。

结论：**本轮有限范围独立复审通过，无未关闭的必修阻断项。** 新增针对性测试 10/10 通过，既有范围确认回归 8/8 通过。审查代理仅写测试与报告，业务修复由实现方完成。本报告不代表真实模型效果、支付商户或 Electron 浏览器端到端验收通过。

## 发现与修复

1. **P1：申请切换后仍能确认旧票据。** 原 hosted result 生成的 aiTicket 不带 applicationId，ai-confirm 只检查扫描期间是否切换，不能拒绝进入确认前已经改变的申请。导航失败或未触发导航时，旧页面票据仍可能通过。实现方为 BYOK 与托管票据记录 applicationId，确认入场即比对；选择申请/演示页面开始时推进 epoch、清票据、取消旧识别，不再只依赖导航事件。测试通过真实 IPC 处理函数提取执行，模拟 result 发票后切换申请再确认，确认不会持久保存映射。
2. **P2：并发 start 旧快照可覆盖远端任务身份。** adoptMapping 原使用传入 local.remoteId 校验；两个同时提交的调用都可能捕获尚无 remoteId 的旧快照。现用最新 current.remoteId 验证。测试分别返回两个不同远端任务 ID，第二个被拒绝，本地保留首个身份。

既有 ai-scope-review 的票据 fixture 随新 applicationId 契约补齐；这只恢复原“扫描过程中发生变化”的测试入口，没有放松断言。

## 独立验证

执行：

`node --test desktop/tests/hosted-mapping-review.test.cjs desktop/tests/ai-scope-review.test.cjs`

共 18/18 通过，其中本次新增 10 项。使用临时 SQLite、fake 模型及 HTTP provider；main IPC 测试通过 vm 提取并执行实际处理函数，未启动 Electron。

| 检查 | 证据 |
| --- | --- |
| 外发范围 | 桌面 quoteMapping 与服务端 processor 仅传所选字段的 id/labels/headings/section/tag/type 和通用目录；测试注入的 PRIVATE_VALUE、页面 URL query、selector、recordIdentity、HTML 与个人事实均未进入请求 |
| 明示范围确认 | quote IPC 检查 confirmed、scope token、有效期和原 application；任何缺失或变化均不发报价请求 |
| 数据最小化 | mapping 测试将 facts.read 设置为直接抛错，正常报价仍成功，证明该路径无需读取个人事实；字段文字本身仍可能含个人信息，UI 已逐项展示并提示 |
| 建议有效性 | 空建议、全部低置信度、未知/重复 id、跨栏目、无效 key、手工敏感字段映射均拒绝 |
| 无建议不收费 | 空 mappings 的服务器任务失败，余额保持 20、reserved 回到 0；有效任务扣 5，同 requestId 重放不再调用 provider 或重复结算 |
| 页面/申请变化 | 报价前复扫发生 epoch 变化不发送；开始任务前申请改变或字段标签改变不预留；结果票据生成后切换申请不可确认 |
| 并发身份 | 本地刚建立 remoteId 后，第二个并发返回不同身份被拒绝 |
| 普通规则填写 | 直接执行实际 run IPC，未配置 workbench.hosted/AI 模型仍可调用本地 fillPage，任务结束 busy=false；不需要订阅或托管账号 |
| 既有回归 | 范围选择、未知/已填写/禁用字段过滤、字段指纹、取消和确认中的页面/申请变化等原 8 项全部通过 |

静态复核：托管报价界面将费用确认与字段发送确认分开；报价请求本身不预留；开始后展示任务列表，失败/取消/无建议有状态记录；刷新和取消操作可在任务进行时访问。生成的 suggestions 先留在本地任务，用户另行选择后经 ai-confirm 保存对应关系；不会自动填写表单，不生成个人事实。普通 run 路径无价格、余额或账号门禁。

## 验收限制

- 本轮没有真实联网模型或收款，没有执行真实 Electron UI 点击、网页导航和跨进程崩溃恢复；主实现方的回环 HTTP 集成应在主台账单独记录，不冒充本报告的独立执行结果。
- “不发送个人事实值”不等于字段元数据绝无个人信息。labels/headings 若本身含姓名等内容仍会按明确选定范围发送；UI 已显示即将发送的文字，用户需在选择时核对。
- 单个有效映射即可构成服务器定义的可用结果；对所有选中字段都有建议、语义一定正确并未得到保证。用户仍需逐项检查对应关系，服务端以目录、栏目、置信度和结构做约束。
- 部署、真实商户、真实模型质量、账户退款处置和系统钥匙串仍按 S13 报告验收边界执行。
