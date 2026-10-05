# S05 / S12 · 可选搜索连接独立审查

日期：2026-10-03。范围：`src/services/search.cjs`、`services/workbench.cjs` 接线、`ui/workbench.js` 搜索/选链接/简报预填流程及 `ui/app.js` 面板生命周期。本 Agent 只新增本文和 `desktop/tests/search-review.test.cjs`，未修改实现。

## 结论

服务层确认边界、秘密隔离、请求幂等、取消和结果范围检查通过。初审发现“关闭搜索面板仍继续执行、结果不可恢复但提示已保存”的问题，主 Agent 已修复，复核通过。8 个搜索测试全部通过（现有 2 个 + 独立补充 6 个）。本次使用模拟供应商响应，没有实际 Brave Key 或付费调用，不代表供应商账号已上线。

官方接口已查阅：[Brave Web Search GET 文档](https://api-dashboard.search.brave.com/api-reference/web/search/get)。实现使用固定 Web Search 端点及 subscription-token 请求头；count=10、不提供 offset，限定第一页。200 字符限制比供应商文档上限更严格，是本产品约束，不是供应商限制。

## 行为验证

| 范围 | 验证与结果 |
|---|---|
| 确认前零网络 | 初始化/config/configure 不触发 fetch；缺少 confirmed、无效/超长/多行 query 拒绝且调用计数为 0 |
| 外发范围 | 仅显式 query 进入固定端点 URL；不发送调用参数中的 profile/email/browser；无请求 body；重定向禁止 |
| 秘密保存 | search config 仅公开 hasKey；Key 通过已有 safeStorage vault 存取；持久 discoveryRuns 无 Key 或原始关键词；错误不透出供应商 body |
| 同请求复用 | 同 requestId+hash 在运行内返回缓存不再 fetch；同 ID 不同 query 拒绝；重启后的原请求拒绝自动重发；running 启动时改 interrupted |
| 次数限制 | 24 小时内 20 条运行记录（含失败），第 21 次不发请求；这是工作区本地软限制，不是不可绕过的供应商配额 |
| 取消/配置切换/关闭服务 | 三种动作均 abort；模拟忽略 abort 的迟到 response 仍被丢弃，不写 ready 或缓存 |
| 响应及链接 | 1 MB body 上限、最多首 10 个结果；只允许公开 HTTPS 形式，拒 IP/凭据/javascript/file；URL 去 fragment 后去重 |
| 持久化 | 保存 requestHash、时间、状态、计数等，结果仅内存；失败/取消仍提示供应商可能收费，不自动重试 |

测试命令：`node --test desktop/tests/search.test.cjs desktop/tests/search-review.test.cjs`，结果 8 passed / 0 failed。独立测试采用内存 store/vault 和 Response stub，明确不会实际联网。

## UI 静态审查

- 搜索入口只有显式表单 submit 才调用 search-run；Key 保存和开启连接不触发搜索。公司名可预填为可编辑关键词，用户仍需勾选确认并提交；没有自动读取个人资料、邮件或浏览器正文。
- 结果 query/title/url/description 经 `escapeHtml` 转义进入 HTML；标题和摘要中的标签不作为可执行内容。链接通过数组索引选择，不拼入可执行 href/脚本。
- 面试路径读取选中的结果索引，要求 1–5 个链接；之后只打开 BYOK 或 hosted 表单，预填 URL 经转义，仍须单独勾选正文/模型发送范围并确认费用或报价。没有把搜索费确认等同于模型费确认。
- 普通机会路径只打开 `sourceEditor` 预填 URL，需再点读取；source-preview 生成待确认草稿，不自动 source-confirm，不直接认为仍在招聘。
- 关闭、Escape、切换面板和切换路由现通过 workbench-panel-change 对 pendingSearch 发送 search-cancel；已收到结果存入 lastSearch，可在本次运行重新打开且不联网。通用后台结束提示已移除“结果已保存”的错误承诺。服务层 epoch/closed 检查覆盖迟到结果。

以上 UI 结论来自代码路径检查，并非真实浏览器的完整 XSS 注入/键盘/导航自动化报告。服务层测试特意返回恶意标题和摘要，证明其保留为字符串；UI 的转义证据来自渲染代码，未声称测试完成全部 DOM sink。

## 残余边界

- 限额按当前工作区的 discoveryRuns 计算，最初 UI “本机每 24 小时”文案应改为“当前工作区每 24 小时”，已反馈主 Agent；不能宣称跨工作区或防篡改配额。
- 取消无法收回供应商已接受的付费请求；界面已明确。关闭应用后无持久结果，需新 ID、新的显式提交才可重试。
- requestHash 绑定 ID 与关键词，不禁止用户用新 ID 再搜索同样关键词；后者是新确认的新调用，不是幂等重放。
- URL 语法检查不等于已核验官网或招聘状态；后续正文读取另有 DNS 公网检查，来源真实性仍需用户核验。搜索不构成自动发现全网覆盖或高召回效果验证。
- 尚无真实 Brave 账号计费/额度/地区语言检索效果测试，也未建立真实来源召回率和成本样本；不应由本审查宣称这些外部验证已完成。
