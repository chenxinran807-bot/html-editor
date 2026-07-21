---
name: prd-demo
description: >-
  从 PRD、截图、参考图或 Figma 批量采集任务生成高保真、可交互、可预览且可标注回改的产品 Demo。
  使用场景包括：根据 PRD 做原型/交互 Demo、还原设计稿或截图、消费刚采集的 Figma Frame、精修或迭代已有原型。
  生成前必须一次只确认一个关键决策；页面范围、主用户动线和 Frame 用途与还原强度不可跳过。
  EN triggers: prototype, interactive demo, PRD to demo, Figma task to prototype, restore design, refine prototype.
---

# PRD → 高保真交互 Demo

## 核心目标

让用户负责产品意图和选择参考 Frame，让 Agent 负责发现、校验、映射、生成、注入和回归。不要让用户搬运 manifest、taskId、nodeId 或本机路径。

## 固定流程

### 1. 读取输入

先读取当前对话中的 PRD、截图、参考图和用户刚才的说明。

- 缺少 PRD：只要求用户补充 PRD，不同时追问设计细节。
- 只有普通截图或本地素材：按常规输入继续，不强行连接飞书。
- 用户提到“刚采集的设计 / Figma 任务 / 批量 Frame”：读取 [unified-workflow.md](references/unified-workflow.md) 和 [figma-task-handoff.md](references/figma-task-handoff.md)，执行 Figma 任务主路径。

### 2. 自动取得可信 Figma 任务

具备飞书云空间能力时，使用当前飞书用户身份发现唯一有效任务根目录。只把存在 `_COMPLETE.json` 的目录视为完成任务，并按 `_COMPLETE.json.completedAt` 选择最新候选；再校验 `ownerOpenId`、taskId、fileKey + nodeId、manifest capability、相对路径、字节数和 SHA-256。

下载后运行：

```bash
python3 scripts/figma_task_runtime.py --owner <当前用户 openId> <候选任务目录...>
```

- 最新完成任务损坏：说明时间与失败原因，只问一次是否检查上一条完整任务；未确认不得自动回退。
- 没有飞书能力：明确降级为任务文件夹链接或本地 ZIP，不得声称已自动读取。
- 没有完成任务：只提示用户回到 Figma 批量采集。

### 3. 逐个确认三个核心问题

创建或恢复 `workflow-state/{sessionId}.json`，严格按顺序一次只问一个：

1. `pageScope`：本次生成哪些页面和状态；给出材料支持的推荐清单。
2. `primaryFlow`：用户如何进入、操作、看到结果并返回；用一句可观察路径表达。
3. `frameBindings`：每个 Frame 用于基础框架、严格还原、组件参考、交互状态还是不采用，并确认还原强度。

三个问题不可跳过。材料已经明确时，不要求用户重新描述，只给出推荐并让用户一句话确认。仅当存在会改变核心结果的歧义或冲突时，才在三问后追加一个问题。完整话术和状态规则见 [clarification.md](references/clarification.md)。

每次回答后立即保存状态。授权、下载或工具中断后从下一未确认项继续，不重复提问。PRD 改变时重新计算 `prdFingerprint`，只重开受影响决策；无法判定影响范围时明确说明并从 `pageScope` 重新确认。

### 4. 生成并直接交付

全部关键项确认后，用 **3–5 行**复述页面范围、主流程、Frame 绑定和关键状态，然后直接生成，不再问“是否开始”。

- 有参考设计时高保真还原，禁止退化成线框或“意思到了”的近似。
- 直接复用已提供 PNG/SVG；遵守 manifest capabilities、locked/editable/prohibited 约束。细则见 [figma-materials.md](references/figma-materials.md)。
- 缺失 capability 表示未知，不等于设计中不存在。
- 产物零运行时网络依赖，关键空/加载/错误/成功状态可操作。
- 需要工程化追踪时读取 [contract-schema.md](references/contract-schema.md)、[prototype-builder.md](references/prototype-builder.md) 和 [quality-gates.md](references/quality-gates.md)。

### 5. 自动注入标注层

生成成功后必须用 `html-editor` 包装器注入标注层，并传入 taskId、sessionId 和 prdFingerprint。注入失败时 Demo 不算完整交付；修复后再交付，或明确提供未注入版本和失败原因。

用户完成标注并粘贴回当前对话后，读取 [iteration-handoff.md](references/iteration-handoff.md)：只修改 `targetClauseId` / target-only 范围，回归所有受影响条款，并证明未受影响页面没有变化。

### 6. 写独立消费回执

Demo 与标注层均成功后，构造并上传 `consumption/{sessionId}.json`。不得修改 `task.json` 或 `_COMPLETE.json`。回执失败不影响已生成 Demo 的文件可用性，但必须明确提示“回执未写入”并允许重试，不能声称完整闭环成功。

## 按需参考

- 逐题确认与冲突处理：[clarification.md](references/clarification.md)
- 云端任务发现、校验与降级：[unified-workflow.md](references/unified-workflow.md)、[figma-task-handoff.md](references/figma-task-handoff.md)
- Figma manifest 与能力降级：[figma-materials.md](references/figma-materials.md)
- 标注驱动的局部回改：[iteration-handoff.md](references/iteration-handoff.md)
- 工程化合同与回归：[contract-schema.md](references/contract-schema.md)、[quality-gates.md](references/quality-gates.md)
