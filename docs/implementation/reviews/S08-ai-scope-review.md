# S08 普通填写 / BYOK 智能字段识别独立审查

日期：2026-10-03。范围：`desktop/src/main.cjs`、`preload.cjs`、`ai-mapping.cjs`、`ui/ai-reader.js`，并查阅扫描引擎及 UI 面板生命周期。

结论：**本轮范围确认与元数据识别的有限范围复审通过**。审查发现的取消竞态和外发内容不可完整查看问题已由实现方修复。新增独立测试 8 项通过，相关既有服务测试 6 项通过。真实 Electron 操作与公共演示页 smoke 由主实现方另行验收；本报告不把服务测试等同于桌面端端验收，也不覆盖尚未实现的 S13 托管付费。

## 已关闭发现

1. 原 ai-confirm 在扫描前把票据移入局部变量，扫描期间取消只清全局，仍可在扫描结束后保存规则。实现已捕获页面 epoch 与申请 id，并在异步复扫后核对；停止与 ai-cancel 均改变 epoch。独立测试挂起复扫、取消后释放，确认没有持久化；同 URL 导航 epoch 变化及申请变化也拒绝保存。
2. 原 ai-scope 在本地扫描中停止后仍可创建范围票据。实现已使停止和取消改变 epoch，扫描结束前核对旧 epoch。独立测试挂起扫描、取消后释放，没有新票据。
3. 原范围确认仅显示首个字段 label 与栏目 code，但请求实际发送多项 labels 和 headings。实现现在返回并展示与模型请求相同裁剪上限的名称列表、标题列表、栏目与控件类型，新增“字段文字可能含个人信息”提示；复审确认仍保留服务商可能计费提示，默认不勾选。

## 已验证的边界

- 本地 ai-scope 不访问模型。ai-suggest 必须具有未过期票据、正确 token、`confirmed: true` 及相同申请 id；一个请求开始后消费票据，busy 阻止第二个扫描或识别。
- 选择范围强制为 1 至 60 个唯一字段；不存在 id、改变 URL、已填值、禁用、已有映射、标签/标题/选择器/记录身份变化均拒绝。
- 请求只包含选定字段的 id、labels、headings、section、tag、type 及通用目录。捕获真实 suggestMappings 请求体验证未选字段、observedValue、recordIdentity、URL 查询令牌、选择器和 API key 均不进入消息正文。API key 仅用于配置服务的认证头。
- metadata 自身可能含网站写入的个人文本；因此“不发送资料值”只能理解为不发送知识库值及控件 observedValue，不能扩展为绝不含个人信息。现 UI 对此明确提示并允许逐项查看外发字段文字。
- 模型仅建议映射。非法 key、人工核对字段、跨栏目、重复字段被拒绝；用户再次勾选确认后只保存本地规则，不直接写表单或提交申请。
- 网络失败和取消路径释放 busy；调用顺序不重新加载招聘页。失败保留已打开的招聘页与其已有值；服务商正文不回显，超时和 HTTP 错误转为可读提示。

## 验证命令与限制

`node --test --test-name-pattern='AI|model|confirmation|saved keys|settings permit|scope|rescan|cancel|suggestion|concurrent|same URL' desktop/tests/product-services.test.cjs desktop/tests/ai-scope-review.test.cjs`：**14/14 通过**。

新增 `ai-scope-review.test.cjs` 的 IPC 生命周期测试加载真实 main.cjs 对应 handler 段，在 VM 内注入可挂起的 scanPage 和持久化计数桩；不启动 Electron、不调用外部模型、不修改真实工作区。测试能覆盖跨 await 的取消与 busy 保护，不能验证 Electron 事件实际分发、网络栈取消延迟或视觉布局。

曾尝试运行完整 product-services.test.cjs，其无关 dashboard 监听测试在当前沙箱遇到 `listen EPERM 127.0.0.1`，其余 13 项通过；随后按本次范围运行上述 14 项全部通过。没有把该环境失败计为 S08 产品缺陷。

关闭范围面板只隐藏面板，不立即撤销服务端票据；此时不会发送请求，旧票据到期或被新扫描替换，实际发送仍需显式提交有效 token。当前不视为阻塞，但将来新增重开旧面板能力时应同步撤销或重新扫描。取消不保证模型服务商不会对已经收到的请求收费。
