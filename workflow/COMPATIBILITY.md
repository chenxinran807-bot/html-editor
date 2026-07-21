# 跨 Agent 兼容规则

采集协议不限定 Aime。任何能读取文件、理解 unified manifest 并运行 `prd-demo` 的 Agent 都能消费；区别只在任务如何交给 Agent。

| 模式 | Agent 能力 | 用户动作 | 能否保持日常两步 |
|---|---|---|---|
| 完整自动 | 当前用户飞书云空间读写 + `prd-demo` + `html-editor` | Figma 批量采集；发 PRD 并说一句话 | 是 |
| 文件夹链接 | 能读取用户提供的飞书文件夹，但不能搜索个人云空间 | 额外粘贴任务文件夹链接 | 否，多一步 |
| 本地 ZIP | 无飞书能力，但能读取上传文件 | 额外上传任务 ZIP | 否，多一步 |

## 兼容 Agent 必须遵守

- 只消费存在 `_COMPLETE.json` 的任务。
- 校验当前用户、taskId、PRD 指纹、文件大小和 SHA-256；任一不一致就停止。
- 按 `_COMPLETE.json.completedAt` 选择最新任务，不按文件名或创建时间猜。
- 生成前逐个确认页面范围、主要流程和 Frame 绑定；不得替用户回答。
- 标注回改必须携带相同 taskId、sessionId 和 PRD 指纹，只改声明的目标。
- 消费记录写入新的 `consumption/{sessionId}.json`；不修改 task、manifest 或完成标记。

没有当前用户飞书访问能力时，Agent 必须明确切换到链接或 ZIP 模式，不得声称已经自动读到“刚采集”的设计。
