# 高保真原型生成（v2 §6，移植+升级）

> 定义阶段② 如何照合同与真实素材生成高保真交互原型。本文件是 `data-prd-*` **追踪载体**契约的 source of truth。相较旧"界面工坊"，**删除低保真约束**（黑白+单强调色、不追求视觉、零框架、pixel-perfect 措辞），改为**素材驱动的高保真 + 两种交付模式**。

## 目录（Table of Contents）

- [1. 交付形态：两种模式，一条红线](#1-交付形态两种模式一条红线)
- [2. `data-prd-*` 追踪载体契约（AUTHORITATIVE）](#2-data-prd-追踪载体契约authoritative)
  - [2.1 条款回指（新增，核心）](#21-条款回指新增核心)
  - [2.2 页面级（根节点）](#22-页面级根节点)
  - [2.3 模块级（容器）](#23-模块级容器)
  - [2.4 字段级 → category=field](#24-字段级inputselecttextarea展示项--categoryfield)
  - [2.5 动作级 → category=behavior](#25-动作级buttonlinkcheckbox--categorybehavior)
  - [2.6 联动级 / 状态级](#26-联动级--状态级)
- [3. 生成流程（单页）](#3-生成流程单页)
- [4. 生成后自检（每次迭代都做，预览前）](#4-生成后自检每次迭代都做预览前)
- [5. 最小结构范例（含条款回指）](#5-最小结构范例含条款回指)

## 1. 交付形态：两种模式，一条红线

**共同红线：零运行时依赖**——不依赖 CDN、包管理器、开发服务器或在线接口，双击/解压即可预览。

| 模式 | 形态 | 适用 | 素材处理 |
|---|---|---|---|
| **默认·可携带模式** | 单个 HTML | 素材体量小、便于飞书分享 | PNG/字体 Base64 内联；SVG 内联为 `<svg>` |
| **大素材模式** | `index.html + assets/`（文件夹或 zip） | 素材多/大，内联会导致文件臃肿 | 素材放 `assets/`，相对引用 |

生成过程**允许** Tailwind/组件化提升一致性，但最终产物必须**编译/打包**为上述两种模式之一（Tailwind→普通 CSS、组件→打包进产物）。仅当用户明确要求工程化交付时才输出多文件工程，且仍需附可直接预览的构建产物。不要再把两种模式都叫"单文件"。

文档类型始终 `<!DOCTYPE html>` + `<html lang="zh">` 或 `"en">`（按界面语言）。多页需求产出 N 个页面 + 一个索引。

## 2. `data-prd-*` 追踪载体契约（AUTHORITATIVE）

每个受约束节点携带对应属性，**回指合同条款**。这些属性只是追踪载体，履约由质量门禁按 `verify.method` 判定（见 [contract-schema.md](contract-schema.md)、[quality-gates.md](quality-gates.md)）。

### 2.1 条款回指（新增，核心）

| Attribute | 含义 | 必填 | 示例 |
|---|---|---|---|
| `data-prd-clause` | 回指合同 `clauseId` | ✅（受约束节点） | `data-prd-clause="cl-014"` |
| `data-prd-asset-id` | 回指受保护素材 `assetId` | ✅（素材节点） | `data-prd-asset-id="asset-1"` |

### 2.2 页面级（根节点）

| Attribute | 含义 | 必填 | 示例 |
|---|---|---|---|
| `data-prd-page` | 页面名，与合同页面一致 | ✅ | `<html lang="zh" data-prd-page="穿搭Tab首页">` |

### 2.3 模块级（容器）

| Attribute | 含义 | 必填 |
|---|---|---|
| `data-prd-module` | 模块名（与合同模块一致） | ✅ |
| `data-prd-module-role` | 面向角色（逗号分隔） | 推荐 |
| `data-prd-module-entry` | 模块入口位置描述 | 推荐 |

### 2.4 字段级（input/select/textarea/展示项）→ category=field

| Attribute | 含义 | 必填 |
|---|---|---|
| `data-prd-field` | 字段名 | ✅ |
| `data-prd-required` | 是否必填 `true`/`false` | ✅ |
| `data-prd-type` | `text`/`number`/`date`/`datetime`/`select`/`multi-select`/`file`/`boolean` | ✅ |
| `data-prd-options` | 枚举选项（select/multi-select 必填） | 条件 |
| `data-prd-default` / `data-prd-format` / `data-prd-data-source` | 默认值/格式约束/数据来源 | 推荐 |

### 2.5 动作级（button/link/checkbox）→ category=behavior

| Attribute | 含义 | 必填 |
|---|---|---|
| `data-prd-action` | 动作名（与合同 behavior 条款一致） | ✅ |
| `data-prd-primary` | 是否主操作 `true`/`false` | ✅ |
| `data-prd-precondition` / `data-prd-confirm` | 触发前置/二次确认 | 推荐 |

### 2.6 联动级 / 状态级

| Attribute | 含义 |
|---|---|
| `data-prd-depends-on` / `data-prd-depends-rule` | 依赖字段 / 依赖规则 |
| `data-prd-state` | `empty`/`loading`/`error`/`success` |
| `data-prd-copy` | 展示文案（category=copy） |

## 3. 生成流程（单页）

1. **读合同+能力清单**：从合同取该页 clauses、designLanguage、assets；从 manifest 能力清单确认可用素材（见 [figma-materials.md](figma-materials.md)）。
2. **布局骨架**：按 `layout` 条款还原区块顺序/层级/栅格/固定吸底。`fidelity=strict` 区域严格按结构；`editableRegions` 按业务开放区设计。
3. **视觉落地**：`official` token 直接引用；`observed`/`inferred` 在 guardrail 范围内使用并对齐 [design-language.md](design-language.md)。
4. **素材直接引用**：受保护素材按 [asset-whitelist.md](asset-whitelist.md) 引用登记素材、带 `data-prd-asset-id`，禁止重画；缺失素材标"待补"。
5. **字段/动作/联动**：逐节点带齐 §2 属性，回指对应 `clauseId`。
6. **行为实现**：为每个 `behavior` 条款实现运行时交互（如点击加购→角标+1+toast），使其 `interaction-test` 可通过；用占位数据展示满/空/loading/error 多状态。
7. **打包为零依赖产物**：按 §1 选模式，编译/内联，确保双击/解压即可预览。

## 4. 生成后自检（每次迭代都做，预览前）

在交付预览前，对照合同与门禁 B 自检：

1. `<html>` 带 `data-prd-page`；受约束节点带 `data-prd-clause`（追踪覆盖率 100%）。
2. 每个 `field` 节点带齐 `data-prd-field/required/type`，select 类带 `data-prd-options`。
3. 每个 `behavior` 节点带 `data-prd-action/primary`，且对应行为可触发、`interaction-test` 通过。
4. 每个受保护素材节点带 `data-prd-asset-id`，哈希匹配，子树无未登记绘制。
5. 产物零运行时依赖（无 CDN/外链 JS/在线接口），双击/解压可预览。
6. 对 `fidelity=strict` 区域在指定 viewport/browser 做截图对比，达到 clause 的结构化 metric（SSIM 值 ≥ `minimum`，默认 0.95；或 pixel-diff 值 ≤ `maximum`，默认 0.02）；不可消除差异登记结构化 `knownDiffs`（`region` 必填、禁止整页豁免）。此项为运行时校验，见 [quality-gates.md](quality-gates.md) B-2。

自检失败 → 补齐后再预览，不把不完整原型交给用户。完整门禁指标见 [quality-gates.md](quality-gates.md)。

## 5. 最小结构范例（含条款回指）

```html
<!DOCTYPE html>
<html lang="zh" data-prd-page="穿搭Tab首页">
<head><meta charset="UTF-8"><title>穿搭Tab</title>
  <style>/* Tailwind 编译后 / 手写 CSS，内联，无外链 */</style>
</head>
<body>
  <section data-prd-module="顶部导航" data-prd-clause="cl-001">
    <button data-prd-clause="cl-014" data-prd-asset-id="asset-1"
            data-prd-action="加入购物车" data-prd-primary="true">
      <svg><!-- 内联登记素材，哈希匹配 asset-1 --></svg>
    </button>
  </section>
  <div style="display:none" data-prd-clause="cl-020" data-prd-state="empty"
       data-prd-copy="暂无搭配，去逛逛">暂无搭配，去逛逛</div>
</body>
</html>
```
