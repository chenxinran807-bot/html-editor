# Figma 任务交接（飞书云空间）

当 Figma 素材不是零散文件，而是由 Figma 插件**多选 Frame 批量导出并上传飞书云空间**形成的"任务"时，按本文件消费。目的——让用户能稳定地把"一批页面"作为一个任务交给 skill，浏览器 Agent 侧只需触发 prd-demo，由 skill 自动取当前用户最新任务再进 Grounding。

> 依赖隔离：所有云空间操作以**意图声明**表达——"使用 lark-drive skill 完成云空间列目录 / 下载"——不在本文件写死具体 MCP 脚本路径，也不穿透调用其实现。

## 端到端链路

```
Figma 插件多选 Frame 批量导出
   → 上传飞书云空间统一任务目录，返回 taskId
   → 浏览器 Agent 调 prd-demo
   → skill 用 lark-drive 读当前用户最新 completed 任务
   → 下载 manifest / PNG / SVG
   → 进阶段① Grounding
```

## 固定任务目录

飞书云空间下固定路径：

```
/prd-demo-tasks/{userId}__{taskId}/
├── task.json            # 任务元信息
├── *.manifest.json      # 统一 Figma Capture Manifest（schema 1.0）
└── <素材>               # PNG / SVG，路径以 manifest 目录为基准解析
```

### task.json 字段

| 字段 | 说明 |
|---|---|
| `userId` | 任务所属用户，用于筛选"当前用户"的任务 |
| `taskId` | 任务唯一 ID |
| `fileKey` | Figma 文件 key |
| `nodeId[]` | 本次批量导出的 Frame nodeId 列表 |
| `status` | `pending` / `completed`（两段式，见下） |
| `createdAt` | 创建时间（ISO8601），取最新一条的依据 |
| `manifest` | 关联的 `*.manifest.json` 文件名（可多份） |
| `schemaVersion` | 任务协议版本 |
| `consumedAt` | 被 skill 消费后回写的时间戳 |

`*.manifest.json` 沿用统一 Figma Capture Manifest schema 1.0（`exporter/capabilities/pages/assets/tokens/constraints`），消费规则完全复用 [figma-materials.md](figma-materials.md)。

## 两段式 status（避免读到半成品）

上传方**先传素材，最后才写 task.json 并置 `status=completed`**。因此：

- skill **只消费 `status=completed`** 的任务，忽略 `pending`（素材可能还没传完）。
- 在 `completed` 任务中取 `createdAt` **最新一条**消费。
- 消费完成后**回写 `consumedAt`**，便于区分已处理任务、避免重复消费。

## 消费流程（skill 侧）

1. **列目录**：使用 lark-drive skill 列 `/prd-demo-tasks/` 下属于当前用户（`userId` 前缀匹配 `{userId}__`）的任务目录。
2. **选任务**：读各 `task.json`，筛 `status=completed`，按 `createdAt` 取最新一条。
3. **下载素材**：使用 lark-drive skill 下载该任务目录的 `*.manifest.json` 与其引用的 PNG/SVG 到本地工作目录；素材相对路径以 manifest 所在目录为基准解析（`resolve(dirname(manifestPath), pages[].png)`）。
4. **回写消费标记**：使用 lark-drive skill 在该 `task.json` 写入 `consumedAt`。
5. **进 Grounding**：把下载的 manifest 交给 [figma-materials.md](figma-materials.md) 探测形状 / 能力降级，再进阶段① 建立映射与合同。

## 边界

- 找不到 `completed` 任务：告知用户当前无可消费任务，或回退到常规"用户直接上传 PRD/截图/manifest"的输入流程（SKILL.md 阶段①）。
- 当前用户信息可从环境变量 `AIME_CURRENT_USER` 获取，用于匹配任务目录的 `userId`。
- 本文件只处理"云空间任务"这一输入来源；无任务时不改变其他输入（PRD/截图/本地 manifest）的既有流程。
