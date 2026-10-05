# Dashboard

JSON 投递记录兼容看板。桌面主入口使用 SQLite 工作台，本组件仍用于兼容与回归验证。

从仓库根目录运行 `npm run dashboard`，默认地址为 `http://127.0.0.1:33210/`。桌面应用也可在内部启动本组件。

默认读取仓库根目录 `.local-workspace/投递记录.json`；`QIUZHAO_WORKSPACE` 可指定独立工作区。`lib/` 负责存储，`public/` 提供界面，`server.mjs` 提供本机 HTTP 服务。Windows 可使用 `launch-dashboard.ps1`。

测试由仓库根目录 `npm test` 和 `npm run test:smoke` 覆盖；此目录不包含独立测试套件。打包时只复制 server、lib 和 public。
