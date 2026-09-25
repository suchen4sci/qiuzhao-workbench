# 秋招工作台 · AI Agent 求职演示版

Windows 桌面填表助手 + 本地投递看板 + 完整虚构知识库 + 空白模板。

**内置资料全部虚构，仅用于学习、开发和本地练习。真实学校、公司名称不表示人物曾就读或任职。不得把演示资料提交给招聘方。**

## 能做什么

- 内嵌浏览器：输入招聘网址或中文关键词搜索。
- 左侧资料栏：按教育、实习、项目、奖励、语言等分类，展开完整正文、点击复制。
- 快速填写：字段语义和记录身份匹配，再按原生、Layui、Ant、Element、北森等控件分支执行，回读检查。
- AI读取：使用本机已登录的 Codex 读取页面、修正规则、重新快速填写并验证。默认关闭，按[说明](docs/AI读取.md)开启。
- 投递看板：本地记录公司、岗位、阶段和下一步；本人确认已投递后导入，不把草稿当提交。
- 完整示例：林知远，2027届中国大陆研三学生，求职 AI Agent/大模型应用开发；含高中、本科、硕士、实习、5个项目、5项荣誉、语言、技能、家庭和求职意向。

这不是“任意网站一键必过”工具。未知事实、登录验证码、选项不匹配、附件和声明需要人工处理。现有站点适配是参考实现，不保证招聘网站更新后仍有效。

## 快速开始（Windows PowerShell）

安装 Node.js 22.12+ 或 24、Git。下载仓库ZIP解压或执行：

```powershell
git clone https://github.com/suchen4sci/qiuzhao-workbench.git
cd qiuzhao-workbench
npm run setup
npm start
```

第一次启动会把虚构示例复制到 `.local-workspace`，打开本地练习页。点击“快速填写”，查看结果；左侧点击不同资料分类查看全文。`npm run setup` 安装 npm 依赖，首次启动可能继续联网下载 Electron 二进制；下载失败可在 `秋招桌面助手` 目录执行 `npx install-electron --no` 后重试。

投递看板可在程序中打开，也可执行 `npm run dashboard` 后访问 http://127.0.0.1:33210 。发布版使用本地JSON存储，不依赖私有表格运行库。

## 换成自己的资料

```powershell
$env:QIUZHAO_WORKSPACE = 'D:\我的求职资料'
npm run init:blank
# 编辑 D:\我的求职资料\知识库\profile.json
npm start
```

初始化命令拒绝覆盖已有目录。请从示例拷贝需要的记录结构，再填写自己的真实信息；保持 `demo:false`。**运行时唯一数据源是 `知识库/profile.json`**。历史确认、来源、原件及技术经验按对应目录保存，更新后同步到该文件，避免多份数据互相覆盖。

参阅[知识库指南](docs/知识库建立.md)、[全部字段](docs/字段参考.md)、[虚构知识库](examples/demo-workspace/知识库)、[空白模板](templates/blank-workspace/知识库)。示例包含原知识库分类对应的74份资料；文件对应清单说明了哪些内容被替换、哪些运行产物没有发布。

## 测试

```powershell
npm test
npm run test:smoke
```

单元测试覆盖匹配、导航、回读等逻辑；smoke测试实际启动隔离的桌面应用，在本地页面填写虚构资料，并测试看板新增/更新。不登录招聘网站、不提交申请。

## 目录

| 路径 | 用途 |
|---|---|
| 秋招桌面助手/ | Electron、Playwright及控件规则 |
| 秋招看板/网页看板/ | 本地投递看板 |
| examples/demo-workspace/ | 完整虚构身份与对应知识库 |
| templates/blank-workspace/ | 同结构空白模板 |
| skills/qiuzhao-assistant/ | 可复用求职工作流及上游许可证 |
| .local-workspace/ | 首次启动生成的私人工作区，不入Git |
| docs/ | 使用、AI权限、数据模型和发布说明 |

## 数据与权限

常规快速填写不调用模型。AI读取会把相关页面内容、资料和代码发送给所配置的 Codex 服务，并能修改本地文件，因此必须显式开启。浏览器登录数据在本机独立 `QiuzhaoWorkbench` 配置目录；不要上传该目录或 artifacts。

公开仓库不包含原用户的真实知识库、简历、证件、成绩单、投递名单、Cookies、令牌或运行截图。示例电话是无效占位，邮箱使用 `.invalid` 保留域，证件号留空。使用者应自行审核代码与结果。

本项目包含 MIT 许可的上游 job-application-copilot 工作流，出处与许可见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
