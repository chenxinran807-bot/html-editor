---
name: prd-demo
description: >-
  从 PRD、截图、参考图或可选的 Figma 批量采集任务生成高保真、可交互、可预览、自动验收且可标注回改的产品 Demo。
  使用场景包括：根据 PRD 做原型/交互 Demo、探索视觉方向、还原设计稿或截图、确认用户动线、精修或迭代已有原型。
  生成前必须一次只确认一个关键决策，并在完整原型前确认用户动线图；无明确视觉目标时先给恰好三个真实视觉方向；生成后自动执行有上限的三层 QA。
  EN triggers: prototype, interactive demo, PRD to demo, Figma task to prototype, restore design, refine prototype.
---

# PRD → 高保真交互 Demo

## 核心目标

让用户只负责产品意图和关键选择，让 Agent 负责分析、探索、映射、生成、验收、注入和回归。Figma 采集是可选增强，不是进入主流程的前提；不要让用户搬运 manifest、taskId、nodeId 或本机路径。

## 对用户隐藏内部实现

用户界面和对话只说用户正在确认什么、系统正在完成什么、下一步需要什么。不得展示脚本名、不得展示命令名、不得展示内部状态键，也不得用英文阶段名、文件路径、Schema、哈希、P0/P1 或工具调用过程解释进度。内部执行可以保留完整机器证据，但对外改写为“已记录页面范围”“正在生成动线图”“正在检查视觉与交互”“原型已通过验收”等自然语言。只有失败且用户需要采取行动时，才说明必要原因和操作。

## 固定流程

## 确认阶段禁止提前准备后续环节

读取输入后，先提出当前唯一需要用户确认的问题并立即停下。三个核心问题全部确认前，不得检查浏览器、不得探测 QA 环境、不得寻找或安装运行依赖，也不得读取生成、验收或标注阶段的实现文件。用户确认阶段只允许读取当前问题所需的输入与确认规则；浏览器检查、原型生成、视觉验收和标注注入必须等到各自步骤真正开始时再执行。

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

### 4. 确定视觉方向

核心问题确认后，按 [visual-exploration.md](references/visual-exploration.md) 决定路径：

- 已有明确视觉目标且用户未要求重设计：沿绑定参考直接还原，不强制探索。
- 没有明确视觉目标，或用户要求重设计：生成**恰好三个**真实关键页视觉方向，保存最终 PNG 并实际运行 `prototype_pipeline.py validate-visual` 校验真实尺寸；门禁通过后才等用户选定或组合。不得用文字卡片或模型自报“已通过”冒充校验。

没有明确视觉目标时不得提供跳过三个视觉方向的选项。三个方向通过门禁后，只确认三个方向采用哪一个或如何组合；不能退回“直接生成、不做三选”的捷径。

用户确认视觉方向或参考图时，立即记录该文件的 SHA-256 与确认消息 ID。确认后的视觉基准只读冻结；Agent 不得覆盖、重生成，或用实现截图反向替换参考图。确需改变基准时必须重新让用户确认。

### 5. 生成并确认用户动线图

按 [flow-confirmation.md](references/flow-confirmation.md) 生成 `flow.json` 和可打开的横向用户动线图 `flow/flow.html`，展示页面/状态缩略图、进入与返回、分支、PRD 条款以及页面/区域/组件级 `visualBindings`；不得用表格代替动线图。一条用户消息只允许确认一个节点，必须写入独立 `confirmationEvents` 后立即停下；所有纳入范围的节点确认前，不得生成完整原型。

每次确认只运行 `prototype_pipeline.py confirm-flow`，直接使用返回的 `nextNode` 展示下一节点；禁止重新读 Skill、手改 `flow.json` 或额外写状态。最后运行一次 `prototype_pipeline.py validate-flow`，不要通过 Python import 调用内部函数。

### 6. 生成完整原型

视觉方向和用户动线图都确认后，用 **3–5 行**复述页面范围、主流程、视觉方向、绑定关系和关键状态，然后直接生成，不再问“是否开始”。

- 有参考设计时高保真还原，禁止退化成线框或“意思到了”的近似。
- 直接复用已提供 PNG/SVG；遵守 manifest capabilities、locked/editable/prohibited 约束。细则见 [figma-materials.md](references/figma-materials.md)。
- 缺失 capability 表示未知，不等于设计中不存在。
- 产物零运行时网络依赖，关键空/加载/错误/成功状态可操作。
- 需要工程化追踪时读取 [contract-schema.md](references/contract-schema.md)、[prototype-builder.md](references/prototype-builder.md) 和 [quality-gates.md](references/quality-gates.md)。

### 7. 自动执行三层 QA

生成后按 [automatic-qa.md](references/automatic-qa.md) 固定环境，真实渲染并保存实现截图，再检查视觉一致性、需求忠实度、交互与流程。优先使用 Agent 已有浏览器能力；shell 启动浏览器前先运行 `prototype_pipeline.py check-browser`。浏览器探测只允许一次；探测失败后不得继续寻找其他 Chromium、不得尝试 LD_LIBRARY_PATH、不得搜索已有系统库，也不得临时安装浏览器或系统依赖。此时立即停止验收并报告环境不可用，不得用 jsdom 冒充真实浏览器 QA。先把预注入证据写入 `qa/qa-result.json`，但此时**不得调用最终 QA 门禁或声称通过**。DOM/结构检查不能代替视觉比较。按轮批量修复，最多三轮。仍有 P0/P1 时阻断交付并报告，不得假装通过。默认不展示大块验收摘要，也不生成 `qa/design-qa.md`。

### 8. 自动注入标注层

生成成功后必须用 `html-editor` 包装器注入标注层，并传入 taskId、sessionId 和 prdFingerprint。注入失败时 Demo 不算完整交付；修复后再交付，或明确提供未注入版本和失败原因。

注入后必须在标注工具可见的真实交付状态重新执行保存、提交、返回等核心交互，保存证据截图，并把结果写入 `qa/qa-result.json.postInjection`。随后才调用 `validate_qa_report`；门禁通过后才能进入回执与最终交付。静态 DOM、Schema 或依赖检查不能替代这次注入后交互回归。

用户完成标注并粘贴回当前对话后，读取 [iteration-handoff.md](references/iteration-handoff.md)：只修改 `targetClauseId` / target-only 范围，回归所有受影响条款，并证明未受影响页面没有变化。

### 9. 写独立消费回执

Demo 与标注层均成功后，构造并上传 `consumption/{sessionId}.json`。不得修改 `task.json` 或 `_COMPLETE.json`。回执失败不影响已生成 Demo 的文件可用性，但必须明确提示“回执未写入”并允许重试，不能声称完整闭环成功。

### 10. 校验最终交付

最终回复前，把原型和用户动线图的真实 URL 写入 `{"prototypeUrl": "...", "flowUrl": "..."}` 并调用 `validate_delivery`。禁止输出 `#`、缺失链接或仅在历史消息中可见的临时占位；校验失败时重新上传对应产物后再交付。

## 按需参考

- 逐题确认与冲突处理：[clarification.md](references/clarification.md)
- 条件视觉探索与三方案校验：[visual-exploration.md](references/visual-exploration.md)
- 用户动线确认与视觉绑定：[flow-confirmation.md](references/flow-confirmation.md)
- 自动三层 QA 与停止条件：[automatic-qa.md](references/automatic-qa.md)
- 云端任务发现、校验与降级：[unified-workflow.md](references/unified-workflow.md)、[figma-task-handoff.md](references/figma-task-handoff.md)
- Figma manifest 与能力降级：[figma-materials.md](references/figma-materials.md)
- 标注驱动的局部回改：[iteration-handoff.md](references/iteration-handoff.md)
- 工程化合同与回归：[contract-schema.md](references/contract-schema.md)、[quality-gates.md](references/quality-gates.md)
