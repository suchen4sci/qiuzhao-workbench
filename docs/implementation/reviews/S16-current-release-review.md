# S16 · 当前 Windows / macOS 测试发行包审查

日期：2026-10-03。主 Agent 指定代码基线：`527d394`；本 Agent 以当前源码逐文件核对，不执行 Git 操作。仅新增本报告，未修改产品或产物。

## 结论

Windows x64 NSIS 和 macOS arm64 DMG 构建产物存在，产品资源与当前源码一致；两平台 ASAR 整包 SHA-256 完全相同。Windows 是**构建与静态产物检查通过**，没有 Windows 真机安装、运行、升级、卸载、通知或系统钥匙串验证。本结论不将构建成功称为 Windows 功能测试通过。

两平台均为未完成开发者签名的测试产物；macOS 未公证。Windows 此次明确使用 `signAndEditExecutable=false`，同时跳过产品 EXE 图标/元数据编辑，不能称为正式品牌发行包。

## 独立比对结果

| 项目 | Windows | macOS |
|---|---|---|
| src/fixtures 源文件 | 80 文件逐字节一致 | 80 文件逐字节一致 |
| 模板/样例/看板 public 和 lib | 171 文件逐字节一致 | 171 文件逐字节一致 |
| 看板 server、LICENSE、THIRD_PARTY_NOTICES | 一致 | 一致 |
| 产品 JS/CJS/HTML/CSS/JSON 跨平台比较 | 无差异 | 无差异 |
| 应用执行文件架构 | PE32+ GUI x86-64 | Mach-O 64-bit arm64 |
| 安装容器 | NSIS EXE 存在，日志已生成 blockmap | DMG 存在，日志已生成 blockmap |

NSIS 安装器引导程序本身被 `file` 识别为 PE32 Intel 80386，而解包应用执行文件是 x86-64；这不构成应用 payload 架构错误，不应仅据引导程序将发行包标成 x86。

Windows ASAR 内五个生产依赖 package 均存在且版本与声明一致：imapflow 2.2.1、mailparser 3.9.33、mammoth 1.13.0、pdfjs-dist 6.3.289、playwright-core 1.63.0。整包与 macOS 相同；此处证明依赖资源存在，不证明 Windows 运行期解析/原生依赖行为已测试。

Windows ASAR 与 Resources 路径扫描未发现 `.env*`、`.local-workspace`、`.video_agent`、ai-settings.json、workspace-path.json、DevToolsActivePort、Cookies、metrics 或 .git。额外资源与受控模板及样例一致；不将有限路径扫描表述为完整秘密审计。

## 产物指纹

| 产物 | SHA-256 |
|---|---|
| 两平台 `resources/app.asar` | `0323b909bfef2cd39f0a2c7c36920ace8587cfeac377d4c85b16aa2f82728450` |
| `release/秋招工作台 Setup 0.1.0.exe` | `6bc49c6342b0b2b0ae9154895b25791340dbcd62569e7a9dbd55714f8d709ef6` |
| `release/秋招工作台-0.1.0-arm64.dmg` | `8906813dd705423af6479ab6815b8f303e878debf9cdaaa7dea08e1d2d76deeb` |

指纹仅对应本次检查时点。产品源码或构建选项改变后应重新构建并更新记录。

## 日志与发行边界

独立核读 `/tmp/qiuzhao-windows-current-build.log`：完成 win32 x64 包装、NSIS 构建及 blockmap；明确跳过可执行文件资源编辑和签名，安装器/卸载器无签名证书。构建日志中的重复依赖引用未对应本次缺失文件发现。

独立核读 `/tmp/qiuzhao-current-mac-build.log`：本地 Electron 分发目录包装 macOS arm64、跳过开发者签名、生成 DMG 与 blockmap，使用默认 Electron 图标。

后续发行仍须明确：Windows 真机安装/启动/升级/卸载；macOS DMG 挂载拖拽安装和下载隔离属性下首次启动；开发者签名、公证及品牌图标/元数据。此前 S16 报告中的旧 ASAR/DMG 指纹不再代表本次新产物。

## 后续 macOS 安装介质验证补充

本 Agent 已另核读主 Agent 本次执行日志：

- `/tmp/qiuzhao-current-packaged-smoke.log`：最新目录应用实际集成检查 PASS，涵盖来源与旧记录迁移/复核、邮件导入到事件确认、提醒设置读取、真实附件 input 上传/回读/隐私、受控原生对话框备份恢复。
- `/tmp/qiuzhao-current-dmg-verify.log`：当前 DMG checksum VALID。
- `/tmp/qiuzhao-current-dmg-mount.log`：DMG 实际挂载成功。
- `/tmp/qiuzhao-installed-smoke.log`：主 Agent 从只读挂载镜像复制应用到临时安装目录、卸载镜像后，由复制后的应用执行相同集成检查，结果 PASS。

因此 macOS 验证已扩展到**安装介质挂载、复制后独立启动及集成检查**。这不是 Finder 拖拽至 `/Applications` 的人工安装验收，也不是新设备、浏览器下载 quarantine、Gatekeeper 或公证验证。以上操作由主 Agent 执行，本 Agent 独立核读日志；Windows 运行验证范围仍未扩大。
