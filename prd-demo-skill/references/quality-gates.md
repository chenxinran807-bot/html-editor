# 验收门禁：双套（v2 §8）

拆成两套，`quick_validate.py` 只承担第一套。**结构校验通过 ≠ 原型质量合格**，两者不可互相替代。

## A. 技能结构校验（quick_validate.py）

由 skill-creator 的 `quick_validate.py` 承担，只校验**技能包本身**：

- frontmatter 格式与允许字段（name/description/author…）
- 引用完整性（SKILL.md 引用的 references 文件都存在）
- 文件存在性、行数限制、依赖隔离规则

运行（路径按实际调整）：

```bash
cd inner_skills/aime-skill-creator && python3 scripts/quick_validate.py ../../user_skills/prd-demo
```

**A 不代表原型质量**——它不看生成出的 HTML 是否还原、交互是否可用。

## B. 原型质量门禁（按 clause 跑）

对阶段② 产出的原型逐条款量化校验。每条款按其 `verify.method` 判定（见 [contract-schema.md](contract-schema.md)）。门禁 B 分两类执行载体，**不可混为一谈**：

### B-1 确定性自动校验（`scripts/validate_prototype.py`）

以下项可**静态判定**，由 `scripts/validate_prototype.py` **确定性自动校验**，有违规即退出码非 0：

| 门禁 | 指标（量化） | 方法 |
|---|---|---|
| 合同结构 | 合同 JSON 通过 `contract.schema.json`（字段/类型/枚举/必填），含 knownDiffs 结构与 region 非通配 | JSON Schema 校验 |
| 追踪（DOM） | 有 DOM 目标的 clause 都能在 HTML 找到对应 `data-prd-clause`；每个 `data-prd-clause` 都能映射到合同 clauseId | `data-prd-*` 静态解析 |
| 素材 | 受保护素材 `sha256` 与 assets[] 登记值一致；带 `data-prd-asset-id` 的节点引用已登记 assetId | `hash-check`（静态） |
| 零外部依赖 | 无外部 http(s)/CDN 引用、`<script src=外部>`/`<link href=外部>`、包管理器/开发服务器痕迹 | 静态扫描 |

运行方式（直接用 bash 执行）：

```bash
python3 scripts/validate_prototype.py --contract <合同.json> --html <原型.html|目录>
```

### B-2 运行时校验（需 headless，当前不由本脚本执行）

以下项需**运行时（headless 浏览器）**才能判定，**当前由宿主模型自检 + 可选运行时校验器**完成，`validate_prototype.py` 对这些项输出 `SKIPPED: requires runtime (headless browser)`，并列出各 clause 期望的 metric/minimum(或 maximum)/viewport 供运行时校验器消费——**绝不输出伪造的通过**：

| 门禁 | 指标（量化） | 方法 | 执行载体 |
|---|---|---|---|
| 视觉 | `locked/layout`·`visual` 条款截图差异达标（SSIM 值 ≥ `minimum` 或 pixel-diff 值 ≤ `maximum`），在指定 viewport/browser | `screenshot-diff` | 运行时（headless），当前宿主模型自检 |
| 交互 | 每个 `behavior` 条款 `interaction-test` 通过；每个 `data-prd-action` 有对应行为 | `interaction-test` | 运行时（headless），当前宿主模型自检 |
| 视觉环境 | 记录 viewport/字体/浏览器；`knownDiffs` 已登记（结构化、region 非通配）的差异不计不合格 | 环境记录 | 运行时记录 |

> 收紧说明：门禁 B 的"确定性、可回归"仅覆盖 **B-1**（合同结构/DOM 追踪/素材哈希/零外部依赖）；**B-2（视觉/交互）需运行时执行，当前不由脚本自动完成**，不得宣称"已自动通过"。

### metric 说明

- 视觉判定用结构化 `verify.params`（见 [contract-schema.md](contract-schema.md)）：SSIM 模式 `metric:"ssim"` + `minimum`（值 ≥ minimum 达标）；像素差模式 `metric:"pixel-diff"` + `maximum`（值 ≤ maximum 达标）。默认 SSIM `minimum=0.95` / pixel-diff `maximum=0.02`，可在 clause 覆写，二者字段互斥。
- 交互测试执行载体：优先可运行的行为断言校验（如轻量 headless 触发 `data-prd-action` 后检查 `expect`）；不具备时降级为"行为断言清单半自动核对"，但断言必须逐条记录通过/不通过，不得默认通过。
- 视觉环境差异（字体抗锯齿、OS/浏览器渲染）登记入合同 `knownDiffs`（结构化，`region` 必填且禁止整页豁免），不计入不合格。

## 阶段① 交接门槛（合同完整性）

进入阶段② 前，合同须过以下检查（承接旧三门槛）：

- **映射**：原始材料读完（建索引），信息都有来源与去向；PRD 产品要求与背景资料分开；每张参考图核心区域有使用方式/还原级别/去向/排除项。
- **确认**：只问会改变核心结果的缺口；先给推荐并用 Mermaid/字符线框/色块降低理解成本；用户能用编号短指令回答。
- **合同**：页面/状态/层级/动线/空间关系/素材绑定完整；`locked/prohibited/guardrail/open` 分类正确；每条款有稳定 ID、`source`、`verify.method`；无关键未决项。

阶段① 只检查合同完整性，不验收最终原型质量（那是门禁 B）。
