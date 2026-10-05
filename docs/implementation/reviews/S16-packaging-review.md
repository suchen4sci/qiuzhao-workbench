# S16 · macOS 打包独立审查

日期：2026-10-03（Asia/Shanghai）。审查对象：`release/mac-arm64/秋招工作台.app`，Apple Silicon arm64。审查 Agent 仅读取产物、源码和日志，运行依赖装载验证；唯一新增文件为本文。

## 结论

**目录应用包的源码资源一致性、必要依赖装载和有限私人数据隔离检查通过；发行验收部分通过。** 未发现本次审查范围内阻断本地试用的打包缺陷。产物仍缺少开发者签名和公证，不能称为已完成公开发行验证。Windows、Intel Mac、拖拽安装、隔离属性/Gatekeeper 首次启动未在本轮验证。

主 Agent 后续已生成 DMG，本文核读其构建及校验日志确认成功；此项不等于已独立挂载安装测试。

## 独立检查证据

| 检查 | 结果 |
|---|---|
| ASAR 对应源码 | 使用本地 `@electron/asar` 逐文件字节比对 `src/` 和 `fixtures/`，共 79 文件，无差异、无缺失 |
| 额外资源 | 空模板、演示工作区、看板 public/lib 共 171 文件逐一字节比对，无差异、无缺失；看板 server、LICENSE、THIRD_PARTY_NOTICES 另外逐一一致 |
| 生产依赖存在性 | imapflow、mailparser、mammoth、pdfjs-dist、playwright-core 均包含于 app.asar |
| 生产依赖装载 | 使用产物自身 Electron 二进制的 `ELECTRON_RUN_AS_NODE=1` 实际加载上述五个依赖成功；PDF 模块为 `pdfjs-dist/legacy/build/pdf.mjs`，回报 6.3.289 |
| 私人运行文件隔离 | app.asar 及 Resources 中未发现 `.local-workspace`、`.video_agent`、`.env*`、ai-settings.json、workspace-path.json、DevToolsActivePort、Cookies、metrics 或 .git 命中路径 |
| 明显凭据模式 | 对应用 src/fixtures 及 Resources 中有限文本格式扫描常见密钥/私钥特征，无命中。未声称完成全部供应链或历史秘密审计 |
| 工作区性质 | 打包空模板 profile 的 demo=false、姓名为空；演示 profile 的 demo=true；两套资源分别保存，与源码一致 |
| 平台/签名 | `codesign -dv` 显示 Mach-O arm64；继承 Electron 的 adhoc/linker-signed，无 TeamIdentifier、无 Sealed Resources，并非开发者身份签名或公证 |

最初审查 app.asar SHA-256：`6c9ad9889a72b47ad761e66adf13fc62555e43a3d698574148064ccc914e3221`。摘要仅标识此时产物，后续源码或构建更新应重新核验。

依赖装载过程 stderr 有 Electron 的 `codesign_util.cc` / `task_name_for_pid` 系统诊断，进程退出码 0，五个模块均成功装载；不将该日志隐藏，也不将模块加载测试解释为 Gatekeeper 发行认证。

## 已核读的主 Agent 验证

- `/tmp/qiuzhao-pack-offline.log`：本地 Electron 分发目录打包成功；显式跳过 macOS 开发者签名；使用默认 Electron 图标。
- `/tmp/qiuzhao-packaged-smoke.log`：实际 packaged integrations smoke 报告来源及旧 JSON 迁移/复核、邮件导入与事件确认、提醒设置读取、真实 file input 上传/回读/隐私、受控原生对话框备份恢复通过。本 Agent 核读日志，未重复完整 UI 场景。
- `/tmp/qiuzhao-dmg.log`：生成 `release/秋招工作台-0.1.0-arm64.dmg` 及 blockmap。
- `/tmp/qiuzhao-dmg-verify.log`：`hdiutil verify` 报告 DMG checksum VALID；本 Agent 另确认 DMG 文件存在，约 147 MiB。

## 仍需保留的发行边界

1. macOS Developer ID 签名、公证及用户下载后的首次启动仍未验证；adhoc 不能替代这些环节。
2. DMG 已构建并通过校验和验证，尚无本轮独立的挂载、拖拽安装和从安装位置启动证据。
3. Windows NSIS 构建/安装/升级和 Windows 真机未验证；不能用本次 macOS 结果代替。
4. 当前使用默认 Electron 图标，正式产品品牌图标仍需配置。这不阻断开发试用，但不应描述为完成品牌发行资产。
5. 源码资源一致和依赖装载不证明真实邮箱账号、生产支付、云端持续服务或所有真实招聘站点已连通；这些由对应子功能审查确认。
6. 产物含明确演示工作区是设计行为；实际首次运行选择空白资料、演示数据与真实投递的隔离仍应由首次引导/浏览器功能审查负责。

本报告不修改签名、产物、代码或 Git 状态，不建议将本地运行数据和 release 目录直接混入源码提交。若需分发安装包，应以明确的未签名测试版本说明及独立附件发布流程管理。
