# F2 显式链接参数与路由保留独立审查

日期：2026-10-03。范围：public-page.cjs、workflow 组织官网/岗位链接、sources.extractJobs 及首次/更新确认、event-context.meetingUrl、旧版 dashboard/legacy 兼容。审查者仅新增 tests/explicit-links-review.test.cjs 和本报告，未改业务实现、未提交代码。

## 结论

新增独立测试 **11 / 11 通过**；连同来源更新 13、旧版 dashboard 2、legacy 独立 8，共 **34 / 34 通过**，0 失败、0 跳过、0 TODO。首次来源确认和后续仅采用 url 字段均完整保留 query 与 SPA hash，无遗留阻塞 P1/P2。

## 发现并复核修复

1. **P2 非字符串 JSON-LD url 被制造为链接。** 原 `new URL(v.url, page)` 会把数字、布尔、数组、对象强制转换为 `/123`、`/true`、`/[object%20Object]` 等，并作为有效岗位 URL。最新只接受非空 string；其他值回退真实抓取页。不擅自支持 `@id` 对象，也不捏造目标。
2. **P2 旧版 HTTP 迁移回归。** 原调用链为 legacy.read → dashboard.safeUrl（接受 HTTP，预览成功）→ legacy.migrate → workflow.opportunity → 新 publicLink（仅 HTTPS）报错，导致整批迁移回滚。最新分开 explicitWebLink 与 publicLink；人工组织/岗位录入用 explicitWebLink，恢复原有 HTTP/HTTPS 兼容；真实旧版 HTTP 文件迁移通过，原记录完整留存。

## 最终策略与证据

|入口|校验/保留行为|验证|
|---|---|---|
|人工组织 website / 岗位 url|explicitWebLink：有界非空字符串、仅 HTTP/HTTPS、拒绝用户名密码；保留 query/hash 和原有自定义端口兼容|组织/岗位真实 workflow 写入一致；HTTP 8080 样例保留；危险协议/凭据拒绝|
|JSON-LD 显式岗位 url|publicLink：在字符串校验基础上保持公开 HTTPS URL 的原限制，同时保留 query/hash|相对路径、query、hash 路由、首次 confirm 完整保留|
|来源更新 url|差异核对后只勾选 url，保留完整目标；旧 URL 进入 source_update 快照|真实 review/confirm 更新及 previous/patch 验证|
|会议链接|meetingUrl 继续委托 publicLink，保留房间参数/hash，仍拒绝 HTTP/私网字面量等|会议 workflow 写入与 helper 边界验证|
|公开页自动读取|publicUrl/readPublicPage 仍仅 HTTPS，去掉不发送给服务器的 hash，保留 query；DNS 公网限制保持原实现|HTTP/自定义端口不因人工链接兼容而获准抓取|
|旧 dashboard 导入|safeUrl 原脱敏策略不变：去 query/凭据，仅保留原允许的简单 hash 路由|独立断言与原 dashboard 测试通过|

缺失、危险或非字符串的 JobPosting.url 回退到实际 page.url；用户提交给抓取器的未执行 SPA hash 不会被伪装成已提取岗位 URL。明确提供的合法相对 hash（如 `#/job/42?mode=apply`）则按当前页正确解析并保留。

publicLink 边界覆盖 javascript/data/file/http、凭据、IPv4/IPv6/数字/十六进制回环字面量、单标签 localhost、`.local` 和非默认端口；非字符串/空串/超 8192 字符也拒绝。explicitWebLink 的较宽网页链接策略仅用于保存用户明确给出的链接，不自行发起网络请求，也不替代抓取前 DNS 校验。

## 验证命令

`node --test desktop/tests/explicit-links-review.test.cjs desktop/tests/source-update-review.test.cjs desktop/tests/dashboard-import.test.cjs desktop/tests/legacy-review.test.cjs`

临时真实 SQLite 与注入读页器，无真实外网访问；本次不是独立 Electron UI 验收，也不改变来源覆盖实验门槛。
