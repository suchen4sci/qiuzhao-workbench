# S07 简历上传与网页回读独立审查

当前结论：第二轮修复已通过 13 项服务层回归，原 3 个 P1 已关闭；后续静态复核亦关闭 3 个 P2；真实浏览器 E2E 未覆盖。以下先保留首轮发现和复现记录，文末记录修复复核。审查范围为 `browser-workflow.cjs`、`main.cjs` 的上传/回读 handler、`workbench.js` 上传 UI，并追踪 `workflow.cjs` 的绑定与提交快照。未修改产品实现；未运行真实站点 E2E。

## P1 — 上传与回读没有独占运行状态，异步完成后仍可跨申请写入

位置：`desktop/src/main.cjs:141-146`；`desktop/src/services/browser-workflow.cjs:25-41`、`:46-52`。

handler 只检查进入时的 `busy`，未在 scan/upload/readback 开始时置忙，也未排除 teaching。上传检查 token/applicationId 后还有 `getPage`、控件扫描、`setInputFiles` 等 await。打开另一申请会 reset ticket，但最后一次控件扫描 await 之后不再检查 ticket、当前申请或页面。Playwright locator 还会在执行时重新解析目标。同 URL 的 SPA 更新、同模板控件、切换申请期间都可能把旧申请绑定的文件送往新页面，而成功记录仍写到旧申请。独立的 run handler 也能在上传未结束时开始 fill，此时尚无 selected 状态，绕过等待网站解析的门禁。回读同样可以把切换后的表单内容保存到原申请。

建议：上传/回读与网页填写共用操作锁，含教学互斥；捕获应用 revision、绑定 hash 和页面/document 世代，异步边界及持久化前再次验证。导航与申请切换使操作失效。同 URL reload/SPA 切换不能只靠 URL 和控件属性指纹。对发生网站副作用但回读失败的情况持久化“结果待核验”，避免无 selected 状态而可直接 fill。

隔离复现：在上传的第二次控件 evaluate 完成前切换 activeApplication、增加页面世代并调用 reset；upload 仍调用 setInputFiles，并把旧 asset 写入原申请 upload。`node /private/tmp/s07-review.cjs` 已通过这一复现断言。这是服务层模拟，未声称已在真实 Electron 页面复现。

## P1 — 重新绑定简历后保留旧上传确认，快照可同时声称两个文件版本

位置：`desktop/src/services/workflow.cjs:146-154`；`desktop/src/services/browser-workflow.cjs:21-30`、`:44`；提交快照 `workflow.cjs:138`。

bindAsset 只更新 assetId/assetHash，保留旧 upload/readback。上传 A 后再绑定 B，旧 `user_confirmed_received` 继续有效；如果 A 仅为 selected，acknowledgeUpload 也不检查 upload.hash 是否与绑定 hash 相同，会把旧 A 确认为接收成功。最终快照的 assetHash 为 B，upload.hash 可为 A。另扫描弹窗显示 A 后修改绑定为 B，旧 ticket 未绑定文件版本，实际上传时会默默采用 B，与用户看到的文件不同。

建议：ticket 包含 assetId/hash；变更绑定须清除或作废旧 ticket、upload/相关回读，并显式要求重新核验。确认上传和提交快照需核对上传所对应的文件版本，保留历史时明确标记“旧绑定的记录”。

隔离复现：把 application.assetHash 从 hash 改为 hash2，再调用 acknowledgeUpload({confirmed:true})，旧 upload.hash=hash 仍转为 user_confirmed_received。已通过断言。

## P1 — 回读敏感字段过滤只看优先展示 label，验证码会写入本地快照

位置：`desktop/src/services/browser-workflow.cjs:48`；`main.cjs:157-160`。

字段名 name=otp、autocomplete=one-time-code 的可见输入，只要有通用 label（如“输入六位数字”），name 就被 label 覆盖，而过滤器不检查 id/name/autocomplete，验证码明文落库。点击“显示密码”后 input type=text 且通用 label 时同样存在问题。回读涵盖所有 frame，并由登记提交自动触发，因此不要求用户显式点击回读也会保存这些数据。

建议：采集前基于 type、name、id、autocomplete、label 等联合排除认证/秘密字段；优先限定本次申请表单/已识别业务字段，提供实际采集范围。测试泛化 label + name=otp、autocomplete=one-time-code、显示密码、跨域登录 frame 等情形。

隔离复现：在 evaluateAll 中执行真实采集回调，输入 visible label=输入六位数字、name=otp、autocomplete=one-time-code，回读 fields 仍含验证码 731928。已通过断言。

## 已核查的正确行为与小问题

- assets.file 会验证实际文件 SHA-256、上限与普通文件属性；upload 对比 application.assetHash，未发现通常使用路径下绕过绑定哈希的问题。
- 控件选择结果只标为 selected；必须用户明确确认才能标为 user_confirmed_received，文案没有把 setInputFiles 等同于服务器接收；captureReadback 标注非服务器保存/提交证明。这些语义应保留。
- PDF accept/disabled 检查及已有 input.files 替换确认已具备；但网站先前已上传而 input.files 已清空的附件不会被检测到。当前替换确认框为可选，需在 UI 说明网页已有服务器附件可能无法检测。
- `siteMaxMB` 条件以真值判定，0/NaN 会当成未提供而跳过校验。UI number 输入未设置 step，浏览器默认 step=1，常见 0.5 MB 限制无法正常提交。建议区分 undefined/空值与非法数值，并设置 step=any、正数 min。
- 上传 UI 以 result.fields.length 判断是否提供提交按钮，但选项过滤 disabled；所有控件 disabled 时会显示空的必填 select 和提交按钮，而非“未找到可用上传控件”。

验证：`node /private/tmp/s07-review.cjs`，3 条复现断言通过。产品文件未修改；本报告没有替代真实浏览器 E2E、网站服务器接收与解析核验。

## 首轮修复后复核（同轮后续）

主代理随后加入主进程 busy/teaching 互斥、上传/回读 epoch + application revision 末尾检查、bindAsset 清除旧 upload/readback、acknowledgeUpload 比对绑定版本。静态复核确认这些修复已落入代码，原跨申请隔离复现现在预期会被拒绝；上文复现通过描述针对修复前版本。

仍需处理：

1. scan ticket 没有绑定 assetId/hash/revision；扫描展示 A 后重新绑定 B，旧 token 仍可上传 B。与用户看到的文件名不一致。
2. epoch 仅由 reset 增长，目前 guest 导航事件没有调用 reset。相同 URL 重载、相同模板 SPA/iframe 更换不能被当前 URL + 字段指纹稳定区分。建议以页面/各 frame 文档身份补强，并在导航事件失效 ticket。
3. 敏感值过滤仍仅检查优先显示的 label，上述 OTP 复现对应逻辑未变；需联合检查 name/id/autocomplete/type。
4. setInputFiles 后网站自动清空 input.files 或跳转会抛错，未持久化“上传结果待核验”；run 的等待门禁仅检查 selected，错误路径可立即普通填写。不要要求服务器接收必须以 input.files 持续存在为依据。
5. 大小限制字段和仅 disabled 控件时的 UI 问题尚在。


## 第二轮修复验收

主代理补齐扫描 revision/epoch 校验、导航事件 reset、回读多来源敏感字段过滤、发送附件前 pending_verification 持久化及普通填写门禁。静态复核与新增隔离测试确认原 P1 问题已关闭。

新增 `desktop/tests/browser-workflow.test.cjs`，执行 `node --test desktop/tests/browser-workflow.test.cjs`：13 passed / 0 failed。使用真实采集 callback 和带 expectedRevision 检查的 mock store；临时 PDF 每个测试隔离并清理。覆盖：

- 上传自身 revision 从 1 → pending 2 → selected 3，不被误认为外部冲突。
- 扫描后重新绑定、扫描时导航、最终扫描时切换申请、同 URL 导航 reset 均拒绝旧票据。
- 网站清空 input、setInputFiles 抛错、发送后导航均保留 pending_verification；错误后的票据不可重用。
- 上传期间外部修改 revision，不覆盖该更新，不写虚假的 selected。
- 确认接收需要显式确认且附件 hash 一致；pending 可以通过明确人工核验完成。
- generic label 无法遮蔽 name=otp、autocomplete=one-time-code/current-password、id= captcha、敏感 placeholder/第二个 label。
- 回读期间切换申请不保存内容；URL 查询参数移除；PDF 类型和正数网站上限在发送前检查。

仍有 P2：

1. getPage await 期间导航触发 reset 后，upload 仍直接读取 ticket.url，会抛 TypeError；安全上会拒绝发送，但用户无法获得明确重新扫描提示。建议保留本次 ticket 快照并显式 assertContext / token 校验。
2. siteMaxMB=0/NaN 仍因真值判定跳过验证，UI number 默认步进拒绝 0.5 MB。
3. 所有控件 disabled 时，空必填 select 与提交按钮仍显示。

限制：这些为服务层真实逻辑 + mock browser 回归；Electron 导航事件是否在各实际站点/iframe/SPA 情况触发，以及服务器接收状态，仍需浏览器 E2E。没有再修改产品实现。


## 最终静态复核：关闭全部已报问题

已核查第三轮 P2 修复：

- getPage 返回后先检查 ticket 存在与 epoch，再读取 URL，导航失效返回明确重新扫描提示。
- siteMaxMB 使用 !== undefined 区分未提供与非法值；0、NaN、非正数拒绝。UI 输入设置 step=any、min=0.001，可填写常见 0.5 MB。
- 提交按钮与可选控件列表统一检查 !disabled；全禁用时提供手工上传提示。

本轮审查已报告的 P1/P2 全部关闭。13 项服务回归此前通过，第三轮由主代理再次运行通过；本 reviewer 本轮仅静态复核上述修改。保留此前服务层与真实浏览器验证范围的区别，本地真实浏览器 E2E 后续补充。
