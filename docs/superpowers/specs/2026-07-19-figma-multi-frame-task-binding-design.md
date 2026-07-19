# Figma 多 Frame 任务绑定设计

## 目标

让用户在一个 Figma 文件中连续采集多个 Frame，将它们明确提交为一个不可歧义的设计输入任务。用户生成 Demo 时无需复制 PNG 或 manifest 路径，只需要求 `prd-demo` Skill 使用“最近完成的 Figma 采集任务”。

首版只允许一个任务绑定一个 Figma `fileKey`。检测到其他 Figma 文件时阻止采集并提示新建任务，避免跨文件串稿。

## 用户流程

1. 在 Chrome 中打开目标 Figma 文件。
2. 打开 Figma Capture Kit，点击“开始新任务”。
3. 输入任务名，例如“AI 试穿改版”。
4. 在同一个 Figma 文件中选中 Frame，逐个点击“采集当前 Frame”。
5. 面板展示任务名、已采集数量及 Frame 列表。
6. 点击“完成并绑定”。
7. 向 Agent 发送：“使用 prd-demo Skill，根据最近完成的 Figma 采集任务生成 Demo。”

仅选择 Frame 不触发下载。未点击“完成并绑定”的任务不能被 Skill 消费。

## 方案选择

采用扩展原生任务管理，不新增常驻 watcher：

- Chrome 扩展已经掌握 `fileKey`、`nodeId`、下载文件名和采集完成状态，可直接组织批次。
- 避免额外安装、后台进程权限和 watcher 未启动导致的隐性失败。
- 时间窗口自动分批不可靠，不采用。

## 文件结构

```text
~/Downloads/figma_export/
├── current-task.json
└── tasks/
    └── <task-id>/
        ├── task.manifest.json
        ├── <capture-stem>.png
        └── <capture-stem>.manifest.json
```

`task-id` 使用时间戳与随机短标识生成，不依赖中文任务名。任务名仅用于展示。

## 任务状态

扩展在 `chrome.storage.local` 中保存进行中的任务：

```json
{
  "taskId": "20260719-070000-a1b2c3",
  "taskName": "AI 试穿改版",
  "status": "collecting",
  "fileKey": "QhZYIMcaZ2Idd0uDTMZ1Kg",
  "frames": []
}
```

Chrome 重启后继续显示该任务。开始新任务时若存在未完成任务，要求用户继续或取消，不静默覆盖。

## 单 Frame 提交

每次采集只有在以下步骤全部成功后才加入任务：

1. Figma 产生新的 PNG；
2. PNG 下载完成；
3. 单页 manifest 下载完成；
4. 下载文件名、`fileKey`、`nodeId` 与当前任务一致。

相同 `fileKey + nodeId` 重复采集时，任务索引只保留最新记录；历史文件可保留，但 Skill 不消费旧记录。

## 完成并绑定

至少存在一个完整 Frame 时才允许完成任务。完成操作生成 `task.manifest.json`：

```json
{
  "schemaVersion": "1.0",
  "kind": "figma-capture-task",
  "taskId": "20260719-070000-a1b2c3",
  "taskName": "AI 试穿改版",
  "status": "completed",
  "fileKey": "QhZYIMcaZ2Idd0uDTMZ1Kg",
  "completedAt": "2026-07-19T07:10:00.000Z",
  "frames": [
    {
      "nodeId": "20:2679",
      "manifest": "QhZY...-20-2679-....manifest.json",
      "png": "QhZY...-20-2679-....png",
      "width": 1125,
      "height": 2436
    }
  ]
}
```

随后生成或覆盖稳定入口 `current-task.json`：

```json
{
  "schemaVersion": "1.0",
  "kind": "figma-current-task",
  "taskId": "20260719-070000-a1b2c3",
  "taskManifest": "tasks/20260719-070000-a1b2c3/task.manifest.json",
  "boundAt": "2026-07-19T07:10:00.000Z"
}
```

只在任务 manifest 成功生成后更新 `current-task.json`。因此该指针永远指向一个已完成任务。

## Skill 消费

当用户要求使用最近完成的 Figma 采集任务时，`prd-demo` Skill：

1. 读取 `~/Downloads/figma_export/current-task.json`；
2. 以该文件目录为基准解析 `taskManifest`；
3. 要求 `kind=figma-capture-task` 且 `status=completed`；
4. 逐项解析 Frame 的单页 manifest 和 PNG；
5. 校验任务级 `fileKey`、Frame `nodeId`、文件名和图片尺寸；
6. 按单页 manifest 的 `capabilities`、`constraints` 和降级规则生成设计执行合同；
7. 任一必需文件缺失或字段不一致时显式中止，不扫描目录猜测替代文件。

普通 PRD、单张截图和用户显式给定 manifest 的原有入口保持不变。任务入口只在用户明确说“最近完成的 Figma 采集任务”时触发。

## 一致性边界

- 身份键：任务使用 `taskId`，Figma 文件使用 `fileKey`，Frame 使用 `fileKey + nodeId`。
- 单文件限制：首版任务内所有 Frame 必须属于同一 `fileKey`。
- 完整性：PNG 与单页 manifest 成对成功后才登记。
- 可见提交：只有 `completed` 任务可消费。
- 稳定入口：Skill 只通过 `current-task.json` 找最近完成任务，不依赖浏览器当前标签页。
- 无静默降级：未知任务结构、缺文件或字段冲突都必须报错。

首版不引入文件哈希。Chrome 扩展无法在下载完成后可靠读取本机下载文件并计算哈希；以下载成功状态、文件名、`fileKey`、`nodeId`、PNG 尺寸和 manifest 内部绑定作为一致性依据。若后续引入本机 watcher，再增加 SHA-256 校验。

## 错误处理

- 无进行中任务：提示先开始任务。
- 任务名为空：禁止创建。
- 当前 Figma `fileKey` 与任务不一致：阻止采集，提示新建任务。
- PNG 渲染超时或下载失败：不登记 Frame，保留任务继续重试。
- 空任务完成：禁止完成。
- 任务完成后再次采集：提示开始新任务。
- Skill 找不到稳定入口或任务不完整：明确报告阻塞原因。

## 测试与验收

自动测试覆盖：

- 创建、恢复、取消和完成任务；
- 单文件限制；
- Frame 成对成功后登记；
- 重复节点保留最新记录；
- 空任务不能完成；
- `current-task.json` 只指向 completed 任务；
- Skill 路径解析与错误中止；
- 原有单 Frame、legacy 和普通截图消费回归。

真实验收使用目标 Figma 文件：开始任务后采集至少两个 Frame，完成绑定，再让 `prd-demo` Skill 仅通过稳定入口读取全部 Frame。确认未选中的 Frame、其他 Figma 标签页及未完成任务均不会混入。

## 后续 Step 2

多 Frame 任务链路通过后再启动 Figma Plugin 增强版。Step 2 继续产出相同单页 manifest，并把 `svg-assets`、`tokens`、`layer-metadata` 能力加入任务内 Frame；任务协议和 Skill 入口不再重新设计。
