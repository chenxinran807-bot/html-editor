# 对抗性验收报告

运行命令：`node --test workflow/test/adversarial.e2e.test.mjs`

| # | 风险 | 权威证据 | 预期 |
|---|---|---|---|
| 1 | 任务创建时间误导 | `figma_task_runtime.select_latest_task` | 只按 `completedAt` |
| 2 | 上传一半被消费 | `_COMPLETE.json` 门禁 | 半成品不可见 |
| 3 | 账号串用 | `ownerOpenId` 校验 | 拒绝 |
| 4 | 素材被篡改 | SHA-256 校验 | 拒绝 |
| 5 | 跳过页面范围确认 | `WorkflowState.confirm` | 阻止 |
| 6 | 授权中断丢进度 | 状态落盘/重载 | 从 `frameBindings` 恢复 |
| 7 | 多个 Figma 标签混淆 | `fileKey + nodeIds[]` | 稳定区分 |
| 8 | editor 元数据注入 | wrapper 转义与控制字符校验 | 阻止 |
| 9 | 局部改动污染其他页 | 页面规范化哈希 | 两个保护页不变 |
| 10 | 无飞书能力却假称自动读取 | Skill 降级文案 | 要链接或 ZIP |
| 11 | 新答案覆盖旧确认 | `Conflict` | 必须显式 replace |
| 12 | 回执失败污染任务 | 前后 task/completion 哈希 | 不变 |
| 13 | 两个合法根目录被擅自合并 | `AmbiguousRoot` | 要用户选择 |
| 14 | PRD 变化导致全量重问 | 定向 invalidation | 仅清除受影响项 |

所有用例直接调用生产脚本或检查其正式交付文档，没有在测试里复制一套业务校验器。
