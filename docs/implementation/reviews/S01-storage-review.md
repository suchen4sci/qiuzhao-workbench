# S01 数据层独立审查

日期：2026-10-03（Asia/Shanghai）。范围：`desktop/src/services/store.cjs`、`tests/store.test.cjs`；对照 Plan 的版本保护、恢复与一致性要求。审查 Agent：review_s01_storage。未修改实现，未执行 Git 操作。

结论：**数据层本次范围最终复审通过。** 已发现的版本复用、顶层异步逃逸、嵌套异步部分提交均已修复。以下保留历史审查证据，不代表这些问题仍然存在。

## 最终复审

- Node v25.9.0 与 Electron 44.4.3 内置 Node v24.21.0 均运行 `tests/store.test.cjs`，**6/6 通过**。
- 每层事务使用独立 savepoint/生命周期，async 函数在执行前拒绝；普通函数返回 Promise 时回滚对应作用域，延迟继续执行无法读写。嵌套失败被外层捕获后，外层有效写入保留且内层写入回滚，语义明确。
- 独立重跑原嵌套 async 复现：顶层抛错，prefix/suffix 均未入库。
- 额外验证恢复空备份后关闭重开，再恢复旧备份：修订高水位仍保留，旧编辑器写入被拒绝。
- 未发现本次审查范围内其他阻塞项。此结论仅针对本地数据层，**不等于备份/附件整包 UI、完整迁移或跨平台发布完成**；下文范围限制仍适用。

## 第一次复审

Node 与 Electron 内置运行时更新后测试均 **5/5 通过**。持久 audit 高水位覆盖删除/恢复后的版本复用；AsyncLocalStorage 已阻止顶层失败事务的延迟读写。上述两个原始复现不再成立。

**仍需修复（P1）：`store.cjs:51` 的 `if (depth) return fn()` 绕过 async 预检和 Promise 返回检查。** 在顶层同步事务内调用嵌套 async 事务、但不返回其 Promise 时，顶层成功提交 async 回调在 await 前的写入；await 后操作报过期上下文，导致业务部分完成。

```js
let nested;
store.transaction(() => {
  nested = store.transaction(async () => {
    store.put('tasks', { id: 'prefix' });
    await Promise.resolve();
    store.put('tasks', { id: 'suffix' });
  });
}); // 实际返回成功并提交 prefix
await nested; // 实际拒绝：事务已结束，不能继续异步写入
// tasks 中仍有 prefix
```

建议：将 async 回调预检移到 depth 分支之前；嵌套普通函数返回 Promise 也需要同样检查。嵌套失败后若调用者捕获异常，需明确整个事务中止或 savepoint 回滚语义，避免仍提交嵌套回调前半部分写入。补充嵌套 async 和嵌套 Promise 回调测试，断言顶层不成功、微任务完成后没有部分落盘。

## P1：恢复遗漏记录后再次恢复，旧编辑器能覆盖恢复结果

位置：`store.cjs:116–119`，以及新建时 `store.cjs:73`。

恢复仅根据当前仍存在的记录计算最大修订号。删除或被较早备份清除的记录丢失版本高水位，再恢复时可以重复使用过去的修订号。普通删除后同 ID 重建也会复用修订号。

已在临时工作区复现：

```js
const empty = store.exportData();
const v1 = store.put('notes', { id: 'same', text: 'v1' });
const backup = store.exportData();
const stale = store.put('notes', { ...v1, text: 'v2' }, { expectedRevision: 1 });
store.restoreData(empty);
store.restoreData(backup);
// 恢复后的版本为 2，旧编辑器 stale.revision 也是 2。
store.put('notes', { ...stale, text: '旧编辑器覆盖恢复结果' },
  { expectedRevision: stale.revision }); // 实际成功；预期冲突
```

建议：使用不会随删除/恢复重置的持久化版本高水位、全局单调提交序列或工作区代际令牌；创建、恢复和删除后的复活都必须更新同一保护机制。增加“连续恢复两份备份”和“删除后同 ID 重建”的冲突测试，并跨关闭/重开验证。

## P1：拒绝异步事务之后，异步回调仍能继续落盘

位置：`store.cjs:46–50`。

事务在调用回调之后才检测 Promise，回滚无法取消回调在 await 后的继续执行；后续 `put` 会自行开启新事务。嵌套事务路径更直接跳过 Promise 检查。因此调用者收到“事务失败”，实际仍可能产生部分数据。

已复现：

```js
try {
  store.transaction(async () => {
    store.put('tasks', { id: 'before' });
    await Promise.resolve();
    store.put('tasks', { id: 'after' });
  });
} catch (error) { /* 数据事务不能包含异步操作 */ }
await new Promise(resolve => setImmediate(resolve));
store.list('tasks'); // 实际只有 after；预期没有记录
```

建议：在执行前拒绝 async 回调，同时考虑普通函数返回 Promise/启动异步工作的逃逸；以事务作用域令牌或等效方式使已结束/失败作用域的后续写入失效，或收窄 API 为同步命令批次。对顶层和嵌套路径增加微任务完成后的无写入断言，避免只检查同步异常。

## 已验证

- 系统 Node v25.9.0：`node --test tests/store.test.cjs`，3/3 通过。
- 本地 Electron 44.4.3 内置 Node v24.21.0：使用 `ELECTRON_RUN_AS_NODE=1` 执行同一测试，3/3 通过。
- 同一 Electron 运行时成功加载 `node:sqlite`，内存数据库查询 SQLite 3.53.4 成功。当前安装运行时未发现 sqlite 不兼容；这不等于 macOS/Windows 打包后真机验收。
- 不完整备份拒绝、普通版本冲突、同步多记录失败回滚、持久化重开、重复备份 ID 拒绝已有测试覆盖。

## 范围与未验收项

该模块提供数据库 JSON 数据导出/恢复，不是完整工作区备份产品。备份文件和附件整包导出 UI 尚待接入；没有将其标记为完成。`profile.json` 事实源、受管附件、恢复前持久化备份、后续 schema 迁移和跨平台安装升级需要各自验证。当前 `user_version=1` 只覆盖初建与拒绝更高版本，不能据此宣布已有完整升级迁移能力。
