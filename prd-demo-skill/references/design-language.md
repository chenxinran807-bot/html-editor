# 设计语言分层（v2 §5.2）

修复 `observed` 与 `official` 混淆：把设计语言 token 分三层，**不同层能进入的约束级别不同**，避免把推断值包装成原设计精确事实。

## 三层定义

| 层 | 来源 | 可进入约束 | 说明 |
|---|---|---|---|
| `official` | manifest 中 `source=variable/style` 的命名 token | 可 `locked` | 精确事实，直接用，可引用 token 名 |
| `observed` | 截图/节点测量的裸值（`source=observed`，`name:null`） | 只能 `guardrail`，且**带 evidence + confidence** | 推断值，禁止升级成命名 token |
| `inferred` | 新增区域推导（参考图没有的新页面，如沿用 primary 派生新 CTA 色） | `guardrail` / `open`，**允许后续修订** | 用于参考图未覆盖处 |

## 合同中的表达

对应 [contract-schema.md](contract-schema.md) 的 `designLanguage`：

```jsonc
"designLanguage": {
  "official": { "color.primary": "#ff2d55", "radius.card": 12 },
  "observed": [
    { "id": "obs-1", "token": "space.gutter", "value": 16, "unit": "px",
      "evidence": "page-1@(x=16,y=88)", "confidence": 0.6 }
  ],
  "inferred": [
    { "id": "inf-1", "token": "color.new-cta", "value": "#ff2d55", "basis": "沿用 official color.primary 派生" }
  ]
}
```

- `official`：键值对即命名 token，可被 `visual/locked` 条款直接引用。
- `observed`：必须带 `evidence`（在哪张图哪个位置量到）与 `confidence`（0~1），只能被 `guardrail` 引用。**禁止**把 `observed` 的 `#FF2741` 自动升级成 `brand/primary`——命名权只属于原稿的 Variable/Style。
- `inferred`：必须带 `basis`（推导依据），落 `guardrail`/`open`，标明允许后续修订。

## 使用规则

1. 新页面视觉规范**优先用 `official`**；缺失处用 `observed`/`inferred`，并在合同标注层级与置信度。
2. 冲突裁决沿用 manifest 输入优先级：`official（manifest 确定值）> PNG/SVG > PRD > 内置设计语言 > 模型推断`（见 [figma-materials.md](figma-materials.md)）。
3. 缺失能力（如 manifest 无 tokens）显式标"未知"，**禁止**补成"原设计值"。
4. 生成后自检：每个采用的颜色/圆角/字号，能说清是 `official` 确定值还是 `observed`/`inferred` 推断值。
