# Figma Capture Manifest 消费规则（新增，不覆盖现有流程）

> 本文件**只在存在 Figma Capture Manifest 时生效**。没有 manifest 时，PRD / 截图 / 参考图的现有消费流程完全不变（见 [requirements-ir.md](requirements-ir.md) 与 [visual-reference.md](visual-reference.md)）。
>
> manifest 由 `figma-capture-kit` 采集器产出，默认落在 `~/Downloads/figma_export/incoming/`。

---

## 1. 双解析：先探测 manifest 形状

读到 `*.manifest.json` 时，先判断结构，再决定解析方式：

| 形状 | 判据 | 处理 |
|---|---|---|
| **统一协议**（新） | 存在 `exporter` **且** `pages` 数组 | 按 §2–§5 完整消费 |
| **旧扁平**（legacy） | 存在顶层 `captureMethod` | **只读兼容**：仅取 `source.nodeId` / `dimensions` / `file` 当作单张 `frame-png` 参考；不再期望 capabilities/tokens/assets |
| 未知 | 两者皆无 | **显式报告"不支持的 manifest 结构"，不得静默降级/忽略** |

> 旧结构只读兼容，**不再作为新产物生成**；新产物一律统一协议（`exporter.version ≥ 1.2.0`）。

## 2. 路径解析：以 manifest 所在目录为基准

所有 `pages[].png` / `assets[].file` 都是**相对 manifest 目录**的路径：

```
resolve(dirname(manifestPath), pages[0].png)
```

- Chrome 扩展：PNG 与 manifest 并列 → 相对路径就是裸文件名。
- Figma Plugin：PNG/SVG 可能在 `pages/`、`assets/` 子目录 → 同样以 manifest 目录为基准拼接。
- **不要**假设固定目录名或绝对路径，一律 `dirname(manifest) + 相对路径`。

## 3. 能力降级：只信 `exporter.capabilities`

`capabilities` 是"本次到底提供了什么"的唯一依据，**不得**用"某数组是否为空"来猜。

| 能力 | 提供时 | 缺失时（必须显式标注） |
|---|---|---|
| `frame-png` | 用 `pages[].png` 建页面骨架与视觉基准 | 无视觉基准，仅凭 PRD/内置设计语言，标注"无参考图，不承诺像素级一致" |
| `svg-assets` | 直接引用 `assets[]`（`usage:reference-directly`），禁止重画 | 缺失 icon/素材标"待补"，不凭空仿造品牌图标 |
| `tokens` | 把 `source=variable/style` 的命名值写进合同 `locked` | 标"未知"，走 PRD → 内置设计语言，**禁止**补成"原设计值" |
| `layer-metadata` | 用 `pages[].children` 理解结构与组件边界 | 结构只能从 PNG 视觉推断，且标"结构为推断" |

### 未知 vs 确定为空（关键歧义，靠 capabilities 消歧）

- `capabilities` **含** `tokens` 但 `tokens:{}` → **确定这份稿子无可提取 token**，明确记"无 token"。
- `capabilities` **不含** `tokens`（`tokens:{}`）→ **本通道没采集（未知）**，标"未知"，不得补成原设计值。

## 4. Token 处置：命名值 vs 匿名观测值

| `token.source` | 处置 |
|---|---|
| `variable` / `style` | ✅ 确定命名值，写入合同 `locked`，可直接引用 token 名 |
| `observed`（`name:null`） | ⚠️ 仅观测参考；若采用必须标注"从设计稿观测的裸值，非正式 token"，**禁止**升级成 `brand/primary` 之类命名 |

## 5. 输入优先级（含 manifest 后的统一裁决顺序）

```
1. manifest 确定值（tokens.source=variable/style、assets 文件）
2. 提供的 PNG / SVG 文件
3. PRD 明确要求
4. Skill 内置设计语言 / 通用视觉底线
5. 模型自行推断（最低，必须显式标注"推断"）
```

高优先级存在时低优先级不得覆盖；仅当 1–4 未覆盖某决策点，才允许第 5 项推断并标注来源。

## 6. 落进设计执行合同

- `pages[]`（png + nodeId + role + fidelity）→ 页面骨架与 `参考图逐区域绑定`。`fidelity=strict` 仅表示**还原强度**，不等于整页锁死。
- `assets[]` → 素材直接引用；**素材文件与节点/用途的绑定关系**落 `locked`，**重画已提供素材**落 `prohibited`（对应 `constraints.prohibited: redraw-provided-assets`）。
- `tokens`（variable/style）→ `locked`；`observed` → `guardrail` 且标推断。
- 区域锁定：**只有 `constraints.lockedRegions` 落 `locked`**；`constraints.editableRegions`（如 `content-area`）为业务开放区，落 `open`，允许新设计/业务新增。缺省时按"锁定基础框架、业务区可编辑"处理，不得因 `fidelity=strict` 把整页写入 `locked`。
- `constraints.prohibited` → 合同 `prohibited`。
- 每条来源标注 `manifest:<nodeId>` 以保证可追溯。

## 7. 三态自检（生成前必须能回答）

- [ ] 是否先探测了 manifest 形状（unified / legacy / unknown）？
- [ ] 素材路径是否以 manifest 目录为基准解析？
- [ ] 缺失能力是否显式标"未知"，而非补成原设计值？
- [ ] `observed` 值是否被标为推断、没有伪装成命名 token？
- [ ] 提供的 SVG 是否直接引用、没有被重画？
