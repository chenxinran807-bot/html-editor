# 真实三 Frame 端到端验收

日期：2026-07-21（Asia/Shanghai）

## 结论

真实的“视频 tab、穿搭 feed（无形象）、穿搭详情页”采集、云端原子完成、下载、98 文件哈希校验、三问状态、html-editor 身份注入和独立消费回执均已跑通。浏览器运行时因安全策略禁止打开本机 `file://` 产物，因此可视浏览器 smoke 未执行；本轮不把 jsdom 回归冒充浏览器实测。

## 证据

| 要求 | 观察值 | 结果 |
|---|---|---|
| 采集助手版本 | 2.0.2；42 项测试与语法检查通过 | PASS |
| prd-demo 版本 | 当前 vendored workflow 版；29 项测试通过 | PASS |
| html-editor 版本 | 1.2.0；19 Node + 4 Python 测试通过 | PASS |
| 真实任务 | `5e7d001d-a4ce-47c2-85cc-75ab257f84d0` | PASS |
| 三个 Frame | `10:15108`、`20:1239`、`46:4897` | PASS |
| 云端完成信号 | `_COMPLETE.json.completedAt = 2026-07-19T17:53:55.349Z` | PASS |
| 完整性 | 3 PNG + 3 整页 SVG + 91 素材 SVG；task 清单 98 项全量校验 | PASS |
| 采集能力 | `frame-png / svg-assets / tokens / layer-metadata` | PASS |
| 页面视觉抽查 | 视频页、无形象穿搭 feed、穿搭详情页均为真实设计内容且边界正确 | PASS |
| 三问顺序 | pageScope → primaryFlow → frameBindings；同 session 持久化 | PASS |
| 标注注入 | 产物包含相同 taskId、sessionId、prdFingerprint | PASS |
| 局部回改隔离 | 脱敏三页面回归中两个非目标页规范化哈希不变 | PASS |
| 消费回执 | `consumption/941c72e0-9b11-4866-a091-87c942e58b52.json` 上传并回读同哈希 | PASS |
| 原任务不可变 | 写回执前后未覆盖 task 或 `_COMPLETE` | PASS |
| 浏览器可视 smoke | Browser 安全策略拒绝本机 `file://` | BLOCKED（非代码失败） |

## 已知 MVP 边界

- 该历史真实任务由 exporter 2.0.0 产生，`source.fileKey` 与 `task.figma.fileKey` 为 `null`。本轮仍可由 taskId、nodeId 和全量哈希闭环，但多副本溯源能力弱于 2.0.2 目标契约。
- 当前会话生成的是受控三页面验收 HTML，用来验证 workflow identity、标注和回执，不作为新一版视觉设计交付。此前消费侧已用同一任务生成业务 Demo；本报告不重复宣称本轮做了新的 95+ 视觉重建。
- 浏览器可视 smoke 应在允许打开本机或 localhost 产物的受控测试环境补跑；在此之前，正式发布结论标记为“工程验收通过，浏览器可视验收待补”。

## 对抗性结论

14/14 场景通过，详见 `ADVERSARIAL-REPORT.md`。其中包括半上传、错账号、素材篡改、跳题、中断恢复、双根目录、定向失效和回执失败不污染原任务。
