# F5 托管邮件解析独立审查

日期：2026-10-03。范围：后端 mail-parse payload / processor / validator / 定价与结算，桌面 hosted quoteMail / mailJob / mailResult / start / adoptMail，mailScope / assertMailScope，workbench 路由与服务选择、报价确认、任务历史和逐项采用 UI。未修改业务代码、未提交。

结论：托管邮件解析功能通过本次独立验证。初审发现的未采用 review 副本账号隔离绕过已修复并回归。未发现未关闭的业务必修项；报价中的模糊日期文案也已澄清。

## 初审问题与修复

**未采用本机副本的账号隔离：** 原 mailResult 创建 `kind=mail-parse` 副本时未保存 server/accountId，通用 mailAI.list/adopt 可绕过 hosted mailJob 的账号检查。修复后副本保存账号和服务归属，mailAI 的 get/list 对 hosted 副本检查当前连接、服务地址和账号；adopt 经 get 验证。独立真实 HTTP 测试切换账号后确认历史隐藏、直接采用旧 reviewId 拒绝。已经采用进入本机确认草稿的内容仍属本机工作数据。

## 独立测试

新增 `hosted-service/tests/mail-client-review.test.cjs`，**4 / 4 通过**。主测试使用真实 HTTP、真实客户端 / SQLite / 账号与额度账本，processor 为测试替身，额度由测试运营授予；无真实模型或支付。

1. **范围和付费前保护：** 未确认、非原文片段、旧确认版本、旧账号 fingerprint 均拒绝。quote 不调用模型、不扣款。服务 payload 精确只有选定 text / offset；不含邮件前后文、标题、发件人、附件、凭据或个人资料。
2. **正常交付和并发：** 初始 30 单位，同一报价并发 start 两次只调用一次 processor，交付一次结算 4 单位。mailResult 创建供人工核对的副本，不改原确认草稿、不创建事件。
3. **失败与返还：** 空输出、原文不支持的改写值、仅包含不能独立确认的模糊日期、处理器异常均 failed；余额保持 26、reserved 归零。
4. **取消与退款：** 长任务运行期间预留 4 单位，取消释放；迟到有效结果不结算。对已交付任务退款两次仅返还一次，余额恢复 30，客户端同步 refunded。
5. **恢复与隔离：** 关闭 / 重开工作区后六条托管任务及原 review 副本可恢复；副本 id 幂等，普通 mapping 历史隔离。新账号的托管历史为空，hosted result 和通用本机 review list/adopt 都不能访问原账号未采用结果。
6. **开始前过期：** 修改 confirmation 后，对旧报价调用 start 在处理器调用前拒绝，调用数与余额不变；旧交付结果也不能绕过确认版本进入核对。
7. **采用仍待确认：** 新版本重新生成并只采用地点，原手改标题保留；confirmation 仍 pending，proposal.confidence 为 needs_review，events/tasks 均为空。没有将解析或采用冒充事件已确认。
8. **真实 processor 输入：** 独立调用 createProcessor，确认实际模型输入只有 text + fields；额外附件、profile、password 被 payload validator 丢弃。offset 供服务端 / 本机日期规范化，不传入模型自由补全。
9. **独立定价：** mail-parse 没有默认价格，未显式配置时报未定价 / 未开放。

## 静态审查

- 至少一项 adoptable 字段才允许 settle；quote/value 必须来自授权片段，日期、轮次、链接按既有独立校验器处理。type/action 只能从枚举取值且必须有原文引文，但分类含义仍需用户核对，不将“存在引文”视为语义必然正确。
- quote 前确认账号 fingerprint，quote 返回后再次 assertMailScope；付费 start 前核对 pending confirmation 的 revision、来源消息及原文片段。处理结果恢复可保留，但旧确认范围不可直接采用。
- adoptMail 校验远端 kind、units、UUID、remoteId 与状态；本机再次 validateMailResult。远端未交付或无可采用字段不会变成可核对副本。
- UI 先选 BYOK / 托管、原文片段与时区，再确认发送；托管报价后单独勾选额度确认。状态页支持刷新 / 取消 / 已交付核对，异步完成有面板 generation 守卫。
- 托管结果进入原 mail-parse 逐项采用流程，保存引用与采用历史，关联变化仍需复核，不直接触发自动事件处理。

## 文案建议与验证边界

报价成功定义已改为“仅返回无法确认的日期等不可采用字段”不结算，与至少一项有依据且可采用字段才结算的实际规则一致。

此次 UI 为独立静态审查；根 Agent 负责完整 Electron 点击链路。未验证真实支付商或外部模型生产部署。执行命令：`node --test hosted-service/tests/mail-client-review.test.cjs`。


## 持久结果可读性复审

- 邮件原文页新增 AI 解析 / 历史入口。已采用结果、confirmation 非 pending、revision 变化时 mailAIReview 强制只读：所有采用复选框 disabled，无提交按钮；即使直接触发回调也拒绝。新增测试提取实际 UI 函数在 VM 执行，验证上述三种分支，API 调用数为零。
- 托管历史在范围过期时只传已验证 job.changes 给只读展示，不调用 mailResult 生成可采用副本。后端 assertMailScope / adopt 的原版本守卫保持不变。
- mailJobs 断连返回空列表，通用 mailAI.list 对托管副本也不可见。真实 HTTP 主测试追加“账号仍记录但 token 不可用”的断连场景，通过。
- 最终独立测试 **4 / 4 通过**；没有放宽采用边界。Electron 已确认事件后的邮件原文 → AI 历史 → 只读浏览点击链路由根 Agent 验证，本审查不冒称独立执行该 GUI 流程。
