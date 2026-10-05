# F3 普通填写人工接管独立审查

审查范围：`src/fill-execution.cjs`、`src/main.cjs`、`src/ui/fill-takeover.html`、`src/ui/app.js`、`src/ui/index.html`。审查方式：源码检查与独立 Node 回归测试；本审查 Agent 未修改生产实现。

## 最终复审结论

**通过：本轮发现的 1 项 P1 与 3 项 P2 均已修复并复查。** 代理取消通过真实 Electron/Playwright 在途动作测试，不再只依赖 API 替身。原生视图命中和跨平台输入仍有下文列出的验证边界。

原生 sibling WebContentsView 屏障加每轮 AbortController，避免通过鼠标事件猜测人工/CDP 来源。屏障覆盖 guest 相同 bounds，在自动化期间接住物理输入；接管事件不重放，等待 run 返回后才撤去。取消后重新检查页面并标记 paused，继续会重新进入 fillPage 扫描。

### 真实环境发现并修复的 P1

实际 Playwright 1.63 构造器为 `_Page`、`_Locator`，原代理白名单只有 `Page`、`Locator`，导致真实 API 对象未被包装。独立 Electron 实测 26 字符、每字 50 ms 的 pressSequentially，140 ms 后 abort 仍输入完整字符串。原隐藏字段 fill 的拒绝实际来自 4 秒 timeout，而非取消：这是只验证“发生拒绝”不足以证明取消的具体例子。

实施者已统一去除构造器名前导下划线，再匹配 API 类型。复测 `tests/fill-execution-review-smoke.cjs` **通过**：

- 不可见字段 fill 取消及时拒绝（校验取消原因，且总用时小于 1.5 秒），字段随后显示并手填后无迟到覆盖。
- disabled button 的阻塞 click 取消后，再启用按钮不会发生迟到点击。
- 连续键盘输入中途取消，返回后再等待 350 ms 值保持不变，未输入完全部 26 字符。
- async evaluate 无法中止时，run 等其完成才返回 paused；没有提前开放人工操作的信号。
- 真实 JSHandle.getProperties Map 中的 ElementHandle 取消后拒绝写入。
- run 开始后新建的真实 srcdoc iframe，经 FrameLocator 填写成功后取消；随后从 frames() 取得的 Frame 不能再写入。跨域 iframe 尚未单独验收。

该独立 smoke 补齐动态 iframe 后最终实际耗时约 1.80 秒。初次沙箱内无法启动本地 Electron，改用获准的本地测试窗口后完成验证，未连接外部招聘网站。

## 初审发现与关闭记录

1. **已关闭 · P2：JSHandle.getProperties() 返回 Map 可取得未包装 ElementHandle。** `abortablePage.wrap` 仅处理 Array 和指定 API 对象，Map 直接返回。预先取出属性 handle，再 abort 后仍能调用 `fill`。独立测试已复现。需包装 Map 内容或拒绝这条 API；同理应处理返回的对象容器。修复已递归包装 Map 和普通对象，并通过独立测试。当前普通适配器未发现使用该路径，但原实现违反“递归 Handle 受同一 signal 保护”的接口保证。
2. **已关闭 · P2：page.context() 可返回未包装 BrowserContext，进而取得原始 Page。** 在 abort 前调用 `page.context().pages()[0]` 后可绕过 run 信号继续写入，独立测试复现。建议普通填写封装直接拒绝 context/browser/newCDPSession 等不需要的能力；若允许，则必须连同返回 Page 与事件回调参数一起封装。修复直接拒绝 context/browser/request、事件订阅及私有接口，独立测试通过。不要把本代理宣称为面对任意代码的安全沙箱。
3. **已关闭 · P2：主进程屏障初始化在 try/finally 之外。** `busy=true` 后调用 `takeoverView.setVisible(true)` 和 `webContents.focus()` 才进入 try。视图已销毁或原生调用抛错时不会清理 busy/controller。应将整个 run 生命周期的 setup 放入 try，finally 安全检查并恢复状态。修复已将 setup 移入 try，静态复查确认；未对运行中的真实应用强行销毁视图。

## 已确认的正确行为

- 同一次 run 的嵌套 Locator、Frame、ElementHandle、Keyboard/Mouse 等已列入对象按 WeakMap 复用包装，旧包装不会借用新 run 信号。
- 每个异步方法调用前检查取消，支持的 Playwright 动作注入 signal；Promise 完成后再次检查。取消被 adapter catch 吞掉后，随后调用代理仍会失败，因此不会进入真实键盘重试或恢复点击。
- evaluate 不声称可强行中断；当前调用仍被 await，屏障直到其完成才消失。此保证依赖引擎等待已启动动作：不应在适配器新增 fire-and-forget、异步事件回调写入、或 Promise.all 首次拒绝后仍存活的写动作；若需支持这些，run 必须登记并 drain 所有在途 Promise。
- 新发现的 iframe 由 `page.frames()` 返回时同样受 run token 保护，本方案依靠原生视图屏障，不依赖为每个 iframe 安装 DOM 人工事件 guard。导航事件触发整轮取消。
- guest 原生 before-input-event 的备用拦截覆盖焦点竞争；主界面与屏障均提示首次按键/点击只用于暂停，后续需重新输入。
- 暂停结果由 inspectPage 得到，已取消的写入不会冒充已验证 filled；UI 显示继续前重新扫描。独立测试确认这一点。

## 测试证据与边界

新增 `desktop/tests/fill-execution-review.test.cjs`，运行 `node --test desktop/tests/fill-execution-review.test.cjs`：初审 **2/4 通过**，两项失败分别为上述 Map 和 BrowserContext 逃逸。修复后独立测试 **4/4 通过**，与实施者测试合跑 **9/9 通过**（包含新加的下划线类名回归）。这部分使用 API 替身验证代理边界；真实 API 由独立 Electron smoke 补充。

原实施者报告 `fill-execution.test.cjs` 4 项通过、实际 Electron public-smoke 通过；这属于实施者证据。本审查未重复运行正在并行执行的 native 接管 smoke，不能据此宣称已独立验证原生输入路由。

原生验收仍应涵盖：点击/键盘/显式停止、同一控件重复点击、菜单粘贴与 IME、动态跨域 iframe、导航、窗口尺寸变化、隐藏再显示浏览器、setup/renderer 错误、暂停完成后人工改值再继续不覆盖。自动化 CDP 点击屏障不等同于操作系统真实鼠标点击；`sendInputEvent` 至少验证原生事件通路，人工或 OS 级事件才能补齐实际窗口命中测试。

本轮仅新增独立测试与审查报告，无生产代码修改、无 Git 操作。
