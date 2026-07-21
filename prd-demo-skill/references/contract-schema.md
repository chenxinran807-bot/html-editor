# 机器可读设计合同 Schema（v2 §4）

合同是带 schema 与版本的 **JSON**，不是散落的自然语言。它是整条流水线的唯一事实源：阶段② 照它生成、阶段③ 回写它。目的（回应"映射有损、grep 不能验证"）：用**稳定 ID + 分类 + 每条款的机器校验方法**替代"grep 可验证履约"的旧承诺。

## 目录（Table of Contents）

- [顶层结构](#顶层结构)
- [clause（条款）字段规范](#clause条款字段规范)
  - [约束级别（type）](#约束级别type)
  - [分类（category）](#分类category)
  - [校验方法（verify.method）](#校验方法verifymethod)
    - [screenshot-diff 结构化 params](#screenshot-diff-结构化-params可被程序解析)
- [clause 示例](#clause-示例)
- [knownDiffs（结构化）](#knowndiffs结构化)
- [合同 ↔ DOM 追踪](#合同--dom-追踪)
- [来源可追溯（承接 Figma manifest）](#来源可追溯承接-figma-manifest)

## 顶层结构

```jsonc
{
  "contractSchemaVersion": "1.0",      // 合同 schema 版本，升级时消费方按此路由
  "contractId": "ct-20260719-ab12",    // 稳定合同 ID，全流程不变
  "version": 3,                        // 合同内容版本；每次精修 +1，配合 changelog
  "changelog": [                       // 每次 version 变更追加一条
    { "version": 3, "at": "2026-07-19T08:00:00Z", "reason": "标注 ann-2：购物车角标交互补齐" }
  ],
  "source": {
    "manifest": "prd-demo-tasks/u123__t456/xxx.manifest.json",
    "prd": { "ref": "wiki://...", "hash": "sha256:..." },
    "capturedAt": "2026-07-19T06:49:01.251Z"
  },
  "designLanguage": {                  // 三层 token，详见 design-language.md
    "official": { "color.primary": "#ff2d55", "radius.card": 12 },
    "observed": [
      { "id": "obs-1", "token": "space.gutter", "value": 16, "unit": "px",
        "evidence": "page-1@(x=16,y=88)", "confidence": 0.6 }
    ],
    "inferred": [
      { "id": "inf-1", "token": "color.new-cta", "value": "#ff2d55", "basis": "沿用 official color.primary 派生" }
    ]
  },
  "assets": [                          // 受保护素材白名单，详见 asset-whitelist.md
    { "assetId": "asset-1", "file": "assets/icon-cart.svg", "sha256": "…", "type": "svg", "boundNode": "20:2679" }
  ],
  "clauses": [ /* 见下 */ ],
  "knownDiffs": [                      // 结构化差异记录，见下"knownDiffs（结构化）"
    { "page": "page-1", "region": "顶部状态栏时间区", "reason": "字体抗锯齿差异不可消除",
      "evidence": "iOS Safari 与 Chromium subpixel 渲染不同", "effectiveVersion": 3 }
  ]
}
```

## clause（条款）字段规范

每条款是一条**可机器校验**的约束。字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `clauseId` | ✅ | 稳定 ID（如 `cl-001`），全流程不变，是 DOM `data-prd-clause` 的回指目标 |
| `type` | ✅ | `locked` / `guardrail` / `open` / `prohibited`（见下"约束级别"） |
| `category` | ✅ | `layout` / `visual` / `field` / `behavior` / `asset` / `copy`（见下"分类"） |
| `region` | ⭕ | `{ page, nodeId }`，定位到 manifest 页面/节点 |
| `source` | ✅ | `{ kind, ref }`，来源 ID（manifest / prd / user-confirm），保证**合同—来源**可追踪 |
| `assetId` | ⭕ | 关联受保护素材，形成**合同—来源—素材**追踪 |
| `assertion` | ✅ | 用户可观察的断言文本（做什么、看到什么变化、如何返回） |
| `verify` | ✅ | `{ method, params }`，决定该条款如何被机器校验（见下"校验方法"） |

### 约束级别（type）

- `locked`：必须按确认结果执行，不得改写、删减或自行发挥；每条 `locked` 必须有 `source`。
- `guardrail`：允许设计，但不能越过的边界（含 `observed`/`inferred` token 的采用范围）。
- `open`：宿主模型可按平台惯例设计（如业务开放区 `editableRegions`）。
- `prohibited`：明确不得出现，至少含通用底线（Emoji 冒充图标、无依据占位素材、图文语义不符、盲目嵌入参考图标注、重画已提供素材）。

> `locked` **不再等同表单属性**。`category` 已扩展到含运行时行为，`locked` 可作用于 layout/visual/asset/copy 等任何类别。

### 分类（category）

| category | 覆盖 | DOM 表达 |
|---|---|---|
| `layout` | 区块顺序/层级/栅格/固定吸底 | 结构节点 `data-prd-clause` |
| `visual` | 颜色/圆角/字号/间距（分层来源） | 受约束节点 `data-prd-clause` |
| `field` | 表单/展示字段属性 | `data-prd-field/required/type/options/...` |
| `behavior` | **运行时行为断言**（点击后角标+1、toast 等） | `data-prd-action` + `data-prd-clause` |
| `asset` | 受保护素材直接引用 | `data-prd-asset-id` |
| `copy` | 文案/空态/错误提示 | `data-prd-copy` |

### 校验方法（verify.method）

| method | 用途 | params 示例 |
|---|---|---|
| `screenshot-diff` | layout/visual 截图差异 | 见下"screenshot-diff 结构化 params" |
| `attr-check` | field/copy 属性存在与取值 | `{ "attr":"data-prd-required", "equals":"true" }` |
| `hash-check` | asset 内容哈希一致 | `{ "assetId":"asset-1" }` |
| `interaction-test` | behavior 运行时断言 | `{ "trigger":"click@data-prd-action=add-cart", "expect":["badge+1","toast.visible"] }` |

#### screenshot-diff 结构化 params（可被程序解析）

`screenshot-diff` 的 `params` 必须是**结构化、可判定**的 metric，不再用模糊的 `threshold` 数字。两种模式**字段互斥、不混用**：

**SSIM 模式**（结构相似度，越大越严；达标条件 **值 ≥ `minimum`**）：

```json
{
  "method": "screenshot-diff",
  "params": {
    "metric": "ssim",
    "minimum": 0.95,
    "viewport": { "width": 375, "height": 812 },
    "browser": "chromium"
  }
}
```

**像素差模式**（像素差异率，越小越严；达标条件 **值 ≤ `maximum`**）：

```json
{
  "method": "screenshot-diff",
  "params": {
    "metric": "pixel-diff",
    "maximum": 0.02,
    "viewport": { "width": 375, "height": 812 },
    "browser": "chromium"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `metric` | ✅ | `"ssim"` 或 `"pixel-diff"`，决定用哪套判定字段 |
| `minimum` | SSIM 必填 | SSIM 下限，达标条件 值 ≥ `minimum`（仅 `metric:"ssim"` 使用） |
| `maximum` | 像素差必填 | 像素差异率上限，达标条件 值 ≤ `maximum`（如 `0.02` 表示 ≤2%，仅 `metric:"pixel-diff"` 使用） |
| `viewport` | ✅ | `{ "width": <px>, "height": <px> }` 对象，明确视口尺寸 |
| `browser` | ✅ | 渲染浏览器（如 `"chromium"`） |

默认值：SSIM `minimum=0.95` / pixel-diff `maximum=0.02`，为**默认值，可按 clause 覆写**。`minimum` 与 `maximum` 不同时出现。

## clause 示例

```jsonc
{
  "clauseId": "cl-001",
  "type": "locked",
  "category": "layout",
  "region": { "page": "page-1", "nodeId": "20:2679" },
  "source": { "kind": "manifest", "ref": "pages[0]" },
  "assertion": "顶部导航区块顺序与层级与参考帧一致",
  "verify": { "method": "screenshot-diff", "params": { "metric": "ssim", "minimum": 0.95, "viewport": { "width": 375, "height": 812 }, "browser": "chromium" } }
},
{
  "clauseId": "cl-014",
  "type": "guardrail",
  "category": "behavior",
  "source": { "kind": "prd", "ref": "3.2 购物车" },
  "assertion": "点击加入购物车后，购物车角标数字+1 且出现 toast",
  "verify": { "method": "interaction-test",
    "params": { "trigger": "click@data-prd-action=add-cart", "expect": ["badge+1", "toast.visible"] } }
}
```

## knownDiffs（结构化）

`knownDiffs` 记录**不可消除的环境差异**，是**结构化数组**而非自由文本，以便程序核对与版本追踪。每条字段：

| 字段 | 必填 | 说明 |
|---|---|---|
| `page` | ✅ | 差异所在页面（与合同页面一致） |
| `region` | ✅ | **明确区域**描述（如"顶部状态栏时间区"）。**只允许排除明确区域，禁止整页豁免**；不接受 `"whole-page"` / `"*"` / `"全页"` 等通配或整页值 |
| `reason` | ✅ | 差异原因（如字体抗锯齿、OS/浏览器渲染差异） |
| `evidence` | ✅ | 支撑证据（测量/环境说明），避免凭空豁免 |
| `effectiveVersion` | ✅ | 该差异生效的合同 `version`（整数） |

```jsonc
"knownDiffs": [
  { "page": "page-1", "region": "顶部状态栏时间区", "reason": "字体抗锯齿差异不可消除",
    "evidence": "iOS Safari 与 Chromium subpixel 渲染不同", "effectiveVersion": 3 }
]
```

> 设计意图：整页豁免会让"视觉门禁"形同虚设，因此 `region` 必填且不接受通配值——只有具体、有证据的区域差异才允许登记，其余仍须过门禁。

## 合同 ↔ DOM 追踪

生成的每个受约束节点携带追踪属性回指条款：

```html
<button data-prd-clause="cl-014" data-prd-asset-id="asset-1" data-prd-action="add-cart">加入购物车</button>
```

`data-prd-*` 只是**追踪载体**，履约由质量门禁按 `verify.method` 判定，不作验证依据本身。旧工坊的 `data-prd-field/required/options/depends-*` 作为 `field/behavior` 类条款的 DOM 表达保留，详见 [prototype-builder.md](prototype-builder.md)。

## 来源可追溯（承接 Figma manifest）

- `variable/style` token → `official`，写入 `locked` 类 visual 条款。
- 素材文件与节点/用途的绑定 → `locked`（category=asset）；**重画已提供素材** → `prohibited`（对应 `constraints.prohibited: redraw-provided-assets`）。
- `observed` 值 → `guardrail` 且标推断（见 [design-language.md](design-language.md)）。
- 区域锁定只锁 `constraints.lockedRegions`；`editableRegions` 落 `open`。`fidelity=strict` 只是还原强度，不等于整页锁死。
- 每条 `source.ref` 对 Figma 来源统一可写 `manifest:<nodeId>`，保证回取原文。详见 [figma-materials.md](figma-materials.md)。
