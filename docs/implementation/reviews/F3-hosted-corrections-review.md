# F3 托管已填字段纠错独立审查

日期：2026-10-03。范围：main ai-correction 的 config/list/quote/start/result/apply，UI provider/quote/history，本机 hosted-correction 服务，远端 processors/jobs/server 的 field-correction。仅新增测试和本报告；未改业务代码或提交。

结论：本次新增的托管纠错闭环通过独立审查，未发现未关闭的必修项。原 BYOK 纠错报告的“未接入托管额度”边界在本路径已补齐；实际运营部署、真实定价和支付商联调不由此次本机假额度测试证明。

## 独立验证

新增 `hosted-service/tests/correction-client-review.test.cjs`，**4 / 4 测试通过**，其中主 HTTP 测试覆盖多个连续生命周期场景。使用真实 loopback HTTP、真实账号 / SQLite / 客户端持久化、假 processor 和运营授予的测试额度，不调用真实模型或支付渠道。

- **范围及隐私：** HTTP 服务只收到 fields / allowedMappings。处理器实际输入为字段 metadata、catalog 和允许的 group/key；未含网页现值、个人事实或邮箱值。相同现值对应的事实不列为可用纠错目标，缺少资料的分组返回空 targets。
- **报价不扣费：** 显式配置纠错价 3 单位，初始 30 单位，quote 后仍为 30。未配置独立纠错价格时直接拒绝，无默认价格。
- **有效交付与幂等：** 同一作业并发 start 两次仅调用一次 processor、只结算 3 单位；重复 start 和工作区重启后再次 start 不重复结算。
- **无效结果不结算：** 空 mappings、已知字段但不在 allowedMappings 内的映射、processor 异常分别落 failed，账户保持 27，reserved 回到 0。
- **运行中取消：** 延迟 processor 期间预留 3 单位，取消立即释放；之后即使 processor 返回有效结果，仍为 cancelled，不结算。
- **报价阶段离线取消：** 用必定抛错的 fetchImpl 确认 quoted 作业可以纯本机取消；再次 start 返回 cancelled，不发请求、不生成付费任务。这里为状态拒绝启动，而非一定抛异常。
- **重启与账号隔离：** 关闭 / 重开工作区后原 ready 建议与五条纠错历史仍可读取；普通 mapping 历史为空，类型互访拒绝。切换新账号后历史为空，本机访问原任务拒绝，实际 HTTP 访问另一账号远程任务非 200。
- **循环对象持久化：** scope 的 frame 使用自引用对象，quote 成功且持久化候选没有 frame，证明不会再因 Playwright frame 循环引用导致报价无法保存。
- **付费前现值 / 资料守卫：** 从 main 文件提取实际 ai-correction handler 在隔离 VM 中运行；网页当前值变化或 profileStamp 变化均在 hosted.start 之前拒绝，调用数为 0；恢复原范围才调用 start。此项是实际 handler 级验证，不只是测试 selected 工具函数。

## 静态核查

- quote 消费有效 scope 票据并验证用户确认、过期时间、epoch、applicationId、profileStamp、URL、候选现值与指纹；无可用资料 targets 时在报价前拒绝。
- start/result 回到原申请、原范围与资料后才允许继续；result 生成新的短期 review 票据。apply 沿用既有逐项现值检查、人工接管暂停与 profileStamp 复核，不写个人事实或永久规则。
- 远端 validateResult 先要求至少一项高置信有效映射，再检查全部可用目标范围，校验发生于 settle 之前。结算和结果保存同事务，失败或取消释放预留。
- UI 明确区分 BYOK / 托管服务，确认先外发 metadata 取报价，再确认预留额度；可从纠错专属历史刷新 / 取消 / 返回原范围核对。报价展示服务返回的成功交付定义、额度与有效期，明确生成、采用与网站保存的区别。
- 账号 / 服务地址 epoch 保护沿用 request 层，拒绝连接切换后的结果落入新账号。

## 限制

此次未执行真实支付扣款、真实外部模型或托管部署。桌面 UI 点击链路由主 Agent 的 GUI 验证覆盖；本次 UI 仅独立静态审查。已有真实网页字段执行验证见 F3-filled-corrections-review.md，不因托管模型返回有效映射而自动代表网站已保存。

验证命令：`node --test hosted-service/tests/correction-client-review.test.cjs`。
