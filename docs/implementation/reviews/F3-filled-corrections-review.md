# F3 已填字段纠错独立审查

日期：2026-10-03。范围：`src/ai-corrections.cjs`、main 的 `ai-correction` IPC、UI、dispatcher、preload 和入口注册。对照 Plan 的 F3、付费层级、网申抽屉与验收条目（126–129、188、275、465 附近）。未修改业务代码、未提交 Git。

复审结论：明确选定资料记录、局部替换、来源展示和采用前过期保护成立；本次复现的文本重试覆盖 P1 已修复并经真实 Chrome 验证。全局人工输入暂停与重新核对恢复也已在真实浏览器通过；托管付费集成仍是独立产品验收边界。

## P1（已修复）：文本重试覆盖执行期间的人工输入

位置：`src/control-dispatcher.cjs` text 分支调用 `fillTextControl`；`src/text-control.cjs` fill-and-blur / keyboard-and-blur 循环。

现值核对在 dispatcher 进入与分支执行前进行。fillTextControl 首次 fill 后等待 120ms 回读；这段时间人工输入会使回读不一致，随后自动使用全选、退格、键盘输入再次覆盖。重试未检查 expectedCurrent 或 cancelled，最终可报告 filled。用户的手改被丢弃，和 Plan 的手改优先要求相反。

真实 Chrome 定向复现：选第 2 条项目资料，首次 fill 完成后通过浏览器输入写入“执行期间人工输入”，随后仍被键盘重试改为“乙项目”。新增测试 `tests/filled-corrections-review.cjs` 的最后一个断言因此失败。修复建议：纠错路径在出现回读冲突后立即停止并提示核对，不以更激进输入覆盖；或为文本执行及每次重试传递有效的取消 / 人工接管守卫。普通填表策略不应因此失去原有兼容性。

## 已验证通过

- **真实 DOM 与真实 dispatcher：** 只勾选项目名称并选择第 2 条资料后，名称覆盖为乙项目，未选项目描述保持旧值，返回资料来源为第 2 条，内存资料完全不变。
- **外发范围：** mappingInput 只构造字段 metadata 和 catalog，不包含 observedValue、资料值、frame、selector。界面提示字段名称本身可能带个人信息。AI 只给 group/key，候选值由本机 confirmedRecordValue / valueForControl 生成，无法从模型任意文本创建事实。
- **采用前手改：** 生成建议后改动网页值，整批 choices 拒绝且人工值保留；资料 stamp 变化同样拒绝。
- **部分执行：** 首项成功后手动改变第二项，逐项重扫发现冲突，只第一项修改；新增全局守卫后第一项标为 needs_review 提醒核对，第二项 skipped；输出 saved:false，明确没有验证网站保存。
- **记录选择：** UI 默认无选择、无勾选，选择资料记录会清除采用勾选；服务只接受票据展示过的整数索引。
- **票据：** main 核对 token、phase、确认、到期时间、epoch、applicationId、profileStamp；票据被单次消费；url / 字段 fingerprint / frameIndex / observedValue / options 等再次比较。
- **来源：** 本机资料或当前申请快照单独说明；来源行列出分组、记录序号、字段以及本站确认口径。手工字段、登录敏感字段和不安全复合控件被排除。
- **无永久写入：** 该 apply 仅调用控件执行器，不调用资料保存或 confirmMappings，不产生永久字段规则；UI 结果仍要求用户自行核对、保存和提交。
- preload 已加入 ai-correction；index 注册脚本和按钮，普通填写不被此功能隐式调用模型。

## 产品验收边界

- 目前此入口是明确标注 BYOK 的纠错功能；未经过托管 AI 权益、额度确认和失败返还链路。因此不能将其单独计作 Plan 的完整“付费智能填写纠错”商业闭环。该事项归主 Agent 的托管功能集成范围。
- 已增加全 frame 的短期 trusted keydown / paste / input / change 监听，逐项执行前后与浏览器 compare/set 检查；finally 清理。真实未选字段人工输入会停止后续修改。自定义控件的可信自动事件可能保守触发暂停，须降级人工核对；未声称已验证全部网站控件或实际供应商。

## 验证命令

`node desktop/tests/filled-corrections-review.cjs`

隔离、无个人会话的 headless Chrome，所有网络页面由 route.fulfill 提供本地 HTML，未外发简历或调用模型。初审前三组通过、人工输入优先失败；最终修复后扩展为八组真实浏览器场景，全部通过。


## 修复复验

`fillTextControl` 的纠错路径增加 expectedCurrent，在单次浏览器任务内比较现值与写入；回读不一致立即抛错，不再进入键盘 fallback。dispatcher 将该 guard 传入，并对 guarded 模式禁用选项 / 遮挡重试。普通填写保留原策略。

真实 Chrome 六组测试全部通过：原三组、执行后回读前人工输入保留、dispatcher 检查之后实际写入之前人工输入拒绝、网站受控字段回滚时保留网站值并返回 needs_review。最后两项为复审追加，可防止只把竞态窗口移位或假报成功。通过真实 dispatcher 回读，没有仅模拟 filled 返回。

无新的该路径必修问题。原基础 `ai-corrections.test.cjs` 与普通 `text-control.test.cjs` 合计 5 / 5 通过。


## 人工接管最终复验

全 frame trusted 输入守卫落盘后，新增第七组：首项执行后编辑未选字段，确认后续选定字段不写；重新生成票据再次采用可成功，守卫不永久卡住。第八组：原生 select 与 date 连续纠错均返回 filled，原生 setter + 非可信 input/change 不会误触发自身守卫，最终全局守卫键清理为零。

最终命令运行成功，**8 组真实 Chrome 场景全部通过**。本报告不把普通模式全局手动暂停或托管纠错商业闭环一并标为通过；此次范围是新增已填字段纠错路径。

## 焦点 blur 误报修复复审

主 Agent 在桌面 GUI 发现原子写入后的 blur 会产生 trusted change。最新监听仅豁免 `input/change` 中“目标元素等于 expected.node 且当前值精确等于 expected.value”的事件；keydown / paste 仍无条件触发暂停。已核对 expected 在原子赋值前设置。

独立脚本新增两组，最终 **10 组通过**：

1. 对真实输入框先 click + pressSequentially 建立焦点和编辑状态，再采用，返回 filled；同时定向调用正在运行的监听器验证同一 node / value 的 trusted change 被豁免。本机 headless Chrome 的真实 blur trusted-change 计数为 **0**，因此这一分支的独立证据是监听函数定向测试，不冒称复现了桌面 Electron 的 native 事件；桌面触发证据来自主 Agent 的 GUI 验证。
2. 采用后真实按 ArrowRight，值仍精确等于目标，但 trusted keydown 使结果 needs_review；因此新豁免不吞掉键盘接管。

全部原先的真实不同值人工输入 race、guard 前改写、未选字段输入、监听清理和原生 select/date 回归继续通过。无需新增业务修复。
