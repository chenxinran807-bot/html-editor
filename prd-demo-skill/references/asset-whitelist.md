# 受保护素材白名单校验（v2 §5.3）

替换"grep 不到重画"这类不可验证承诺，改为**素材白名单 + assetId + 哈希校验**：登记的受保护素材必须被直接引用、内容哈希一致，且其节点子树内不得出现未登记的替代绘制。

## 白名单登记（合同 `assets[]`）

每个受保护素材在合同里登记一条稳定记录：

```jsonc
"assets": [
  {
    "assetId": "asset-1",          // 稳定 ID，DOM 用 data-prd-asset-id 回指
    "file": "assets/icon-cart.svg", // 相对产物根目录（大素材模式）；可携带模式下内联
    "sha256": "…",                 // 素材内容哈希，来自 manifest 提供的原始素材
    "type": "svg",                 // svg | png | image
    "boundNode": "20:2679"         // 绑定的 Figma nodeId（可追溯来源）
  }
]
```

`assetId` / `sha256` 与 [contract-schema.md](contract-schema.md) 的 `assets[]` 及 `category=asset` 条款一一对应。

## DOM 侧要求

- 对应 DOM 节点**必须声明 `data-prd-asset-id="<assetId>"`**。
- 该节点引用的素材内容哈希须与合同 `sha256` 一致：
  - 大素材模式：`assets/` 下文件哈希匹配。
  - 可携带模式：内联的 SVG / Base64 PNG 的解码内容哈希匹配登记值。
- **禁止**在该节点子树内出现**未登记的替代素材**：CSS 画的图形、额外 `<svg><path>`、`<canvas>`、背景图（`background-image`）等。发现未登记绘制即判不合格。

## 校验方法（对应门禁 B · 素材项）

由 asset 门禁按 `hash-check` 扫描：

1. **覆盖率**：每个受保护 `assetId` 都能在 DOM 中找到 `data-prd-asset-id` 引用节点（覆盖率 100%）。
2. **哈希匹配**：引用素材内容哈希 == 合同 `sha256`（匹配率 100%）。
3. **无未登记绘制**：扫描受保护素材节点子树，无 CSS 图形 / 额外 path / canvas / 背景图等替代绘制。

任一不满足即门禁不通过。精修回归时受保护素材哈希须复校（见 [iteration-handoff.md](iteration-handoff.md)）。

## 与通用视觉底线的关系

白名单校验是"提供了素材必须直接用、不许重画"的可验证实现；通用底线（禁 Emoji 冒充图标、禁无依据占位素材）仍作为 `prohibited` 条款，两者叠加。缺失素材标"待补"，不凭空仿造品牌图标（见 [figma-materials.md](figma-materials.md)、[visual-reference.md](visual-reference.md)）。
