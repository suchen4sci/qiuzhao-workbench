# Desktop

Electron 主产品。建议从仓库根目录运行 `npm run setup`、`npm start`、`npm test` 和 `npm run pack`。

- `src/`：进程、填表执行器、UI 和业务服务；`src/services/` 包含本地数据库及外部服务客户端。
- `tests/`：单元/集成与 Electron 冒烟；`fixtures/`：隔离练习页面。
- `scripts/`：源码启动和兼容开发工具。
- `node_modules/`、`artifacts/`：本机依赖与测试证据，Git 忽略。

打包配置引用根目录的 dashboard、templates 和 examples，产物写入 release。工作区通过设置或环境变量选择，不存放在源码目录。
