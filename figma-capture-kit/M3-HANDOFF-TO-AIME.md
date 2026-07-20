# M3 交接给 Aime / prd-demo Skill

M1 与 M2 的任务事实源已经固定。Aime 不读取浏览器当前 Figma 标签，也不读取用户 Downloads；只读取飞书个人空间 `/prd-demo-tasks/`。

## 选任务

1. 使用当前飞书用户身份列 `/prd-demo-tasks/*/`。
2. 只保留存在 `_COMPLETE.json` 的任务目录。
3. 读取 `task.json`，要求 `ownerOpenId` 等于当前用户 openId。
4. 按 `createdAt` 降序取最新任务。
5. 下载完整任务目录到本会话工作区的 `figma_export/incoming/<taskId>/`。

## 校验

- `taskSchemaVersion` 必须为 `1.0`。
- `figma-export.manifest.json` 必须是 `schemaVersion: "1.0"` 且含 `exporter + pages[]` 的 unified 结构。
- `_COMPLETE.json.taskId`、目录名和 `task.json.taskId` 必须一致。
- `_COMPLETE.json.manifestSha256` 必须等于下载后的 manifest SHA-256。
- `task.json.files[]` 中每个路径必须为相对路径，不得包含空段、绝对路径或 `..`。
- 每个文件大小和 SHA-256 必须逐项匹配；任一失败则跳过该任务，不静默使用旧文件替代。

## 消费

- `frame-png`：`pages[].png` 作为页面视觉基准。
- `svg-assets`：直接引用 `pages[].svg` 和 `assets[].file`，禁止重画。
- `tokens`：只有 `source=variable/style` 的值进入合同 `locked`；`observed` 仅为观测参考。
- `layer-metadata`：优先读取 `pages[].children`；TEXT 节点包含 `characters/fontSize/fontName/fontWeight/lineHeight/letterSpacing`，用于恢复文字语义，避免依赖 SVG outline。
- capability 缺失表示“本次未采集/未知”，不能解释成原设计确定为空。

## 消费记录

生成成功后新增 `consumption/<sessionId>.json`；不得修改 `task.json` 或 `_COMPLETE.json`。记录至少包含 `sessionId`、`agentUserOpenId`、`consumedAt`、`result` 和输出地址。

