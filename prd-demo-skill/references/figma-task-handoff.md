# Figma 任务交接协议

本文件用于消费 Figma 插件多选 Frame 后形成的一批设计任务。云空间操作使用宿主 Agent 已有的飞书云空间能力；不要把具体 MCP 名称、私有脚本路径或凭证写死在 Skill 中。

## 目录

```text
/prd-demo-tasks/
├── _PRD_DEMO_ROOT.json
└── {taskId}/
    ├── task.json
    ├── figma-export.manifest.json
    ├── pages/
    ├── assets/
    ├── _COMPLETE.json
    └── consumption/
        └── {sessionId}.json
```

任务目录必须是 `/prd-demo-tasks/{taskId}/`。用户身份不编码进目录名，而由根标记和 `task.json.ownerOpenId` 双重校验。

## 根目录发现

按精确名称搜索 `prd-demo-tasks`，只接受包含以下不可变 `_PRD_DEMO_ROOT.json` 的目录：

```json
{
  "rootSchemaVersion": "1.0",
  "kind": "prd-demo-task-root",
  "ownerOpenId": "<当前飞书用户>",
  "createdBy": "figma-capture-helper"
}
```

- 忽略其他用户的根目录。
- 当前用户只有一个合法根目录时继续。
- 当前用户存在多个合法根目录时停止，让用户选择；不得合并任务或按更新时间猜测。

## 完成信号与最新任务

`_COMPLETE.json` 是唯一完成信号。不存在该文件的目录是半成品，直接忽略。

在所有完成任务中按 `_COMPLETE.json.completedAt` 降序选最新候选，不得按 `task.json.createdAt`。最新候选损坏时拒绝，并询问一次是否检查上一条完整任务；未经用户确认不得静默回退。

## 下载后的强校验

将候选下载到会话隔离目录，再运行：

```bash
python3 scripts/figma_task_runtime.py --owner <当前用户 openId> <候选任务目录...>
```

校验必须覆盖：

1. 目录名、`task.json.taskId` 和 `_COMPLETE.json.taskId` 一致。
2. `ownerOpenId` 等于当前飞书用户。
3. manifest 是 `exporter + pages` 的 unified 结构，capabilities 显式声明。
4. `task.files[]` 的相对路径、`bytes` 与逐文件 SHA-256 一致。
5. `_COMPLETE.json.manifestSha256` 与真实 manifest 一致。
6. manifest 引用的 PNG/SVG 均已登记且位于任务目录内。
7. fileKey + nodeId[] 与本次任务一起进入生成会话，防止同名 Frame 或多个 Figma 标签串稿。

任何一项失败都不得进入生成。

## 消费规则

校验通过后，把 manifest 交给 [figma-materials.md](figma-materials.md) 解析：

- capability 缺失表示“未知”，不能推断成“原设计没有”。
- `variable/style` token 才能作为正式 locked 值；`observed` 仅作参考。
- 素材文件绑定关系进入 locked；`redraw-provided-assets` 进入 prohibited。
- `fidelity=strict` 不等于锁死整页；只锁 `lockedRegions`，`editableRegions` 保持可设计。

## 不可变消费回执

生成与 html-editor 注入成功后，新增 `consumption/{sessionId}.json`。不得修改 `task.json` 或 `_COMPLETE.json`；`consumedAt` 只存在于独立回执中。

```json
{
  "consumptionSchemaVersion": "1.0",
  "sessionId": "<生成会话>",
  "taskId": "<设计任务>",
  "prdFingerprint": "sha256:<PRD 摘要>",
  "agentUserOpenId": "<当前用户>",
  "consumedAt": "<ISO-8601>",
  "result": {
    "status": "completed",
    "demoUrl": "<可选>",
    "artifact": "<产物定位>"
  },
  "decisions": {
    "pageScope": [],
    "primaryFlow": "",
    "frameBindings": []
  }
}
```

回执上传失败时保留本地待重试文件，明确提示用户；不能改写原任务或声称完整闭环成功。
