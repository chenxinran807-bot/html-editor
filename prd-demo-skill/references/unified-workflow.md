# PRD → Figma → Demo 统一 Workflow

## 用户主路径

首次只做安装和飞书授权。日常只有两个主动动作：

1. 在 Figma 多选参考 Frame，运行批量采集。
2. 在当前 Agent 对话提供 PRD，并说“根据当前 PRD 和刚采集的设计生成交互 Demo”。

Mira、Aime 或其他兼容 Agent 自动发现、下载和校验设计任务；`prd-demo` 逐个确认三个核心问题；确认后直接生成并注入 html-editor。

Agent 品牌不属于任务一致性键。切换 Agent 时仍以 `ownerOpenId + taskId + fileKey/nodeId + prdFingerprint` 为事实依据，并为每次消费创建新的 `sessionId`。

## 三种能力模式

### 完整自动模式

条件：宿主 Agent 能以当前用户身份读取和写入飞书云空间。

- 自动发现唯一合法任务根目录。
- 自动选择最新完成任务并下载。
- 自动写入独立消费回执。
- 用户日常保持两步，不接触 taskId、manifest 或路径。

### 任务文件夹链接模式

条件：Agent 能访问用户明确提供的飞书任务文件夹，但不能搜索个人云空间。

- 只读取用户提供的文件夹。
- 仍需本地执行完整哈希与身份校验。
- 多一个用户动作：粘贴任务文件夹链接。

### 本地 ZIP 模式

条件：Agent 没有飞书能力，但能读取用户上传文件。

- 用户上传 Figma 插件产生的任务 ZIP。
- 解压到会话隔离目录后校验和消费。
- 无法写云端回执时，输出本地 receipt 文件随 Demo 交付。

缺少飞书能力时，必须说明当前采用哪种模式；不得声称已经自动读取“刚采集”的任务。

## 一致性键

| 键 | 作用 |
|---|---|
| `ownerOpenId` | 任务属于当前飞书用户 |
| `taskId` | 一次批量采集 |
| `fileKey + nodeId` | 真实 Figma 文件和节点 |
| `sessionId` | 确认、生成、标注和回执属于同一会话 |
| `prdFingerprint` | 确认答案对应当前 PRD 内容 |

任一键不一致就停止；禁止拼接不同任务、不同用户或不同 PRD 的材料。

## 中断恢复

确认进度保存在 `workflow-state/{sessionId}.json`。授权或工具中断后：

1. 重新取得相同 taskId。
2. 重新计算相同 prdFingerprint。
3. 读取已确认项。
4. 从 `next_question` 继续。

不得要求用户重复已经确认的问题。

## 失败原则

- 缺 PRD：只要 PRD。
- 没有完成任务：只提示回 Figma 采集。
- 最新任务损坏：拒绝并说明原因，是否检查旧任务由用户决定。
- 多个合法根目录：让用户选择，不能猜。
- html-editor 注入失败：交付未完成。
- consumption 回执失败：Demo 可用，但闭环未完成，允许重试。
