---
name: prd-demo
description: >-
  从 PRD / 截图 / 参考图 / Figma 导出稿生成高保真、可交互、可预览的产品原型。
  这个 skill 只做一件底座默认不做、但对做原型最关键的事：**生成前先与用户逐个确认关键设计决策——一次只问一个问题，关键项没拿到用户回答就不动手生成。**
  视觉还原本身信任 Aime 底座能力，skill 不规定还原手法（只保留"高保真、别退化成线框"这一句提醒）。
  EN triggers: prototype, high-fidelity prototype, mockup, interactive demo, build page from PRD,
  restore screenshot, restore design, Figma export to prototype, refine prototype, iterate on prototype.
  中文触发词：做原型、高保真原型、可交互原型、做demo、生成原型、根据PRD生成页面、还原截图、还原设计稿、
  Figma导出稿生成原型、改原型、精修原型、迭代原型。
author: chenxinran.25
---

# PRD → 高保真交互原型

这个 skill 的存在只有一个核心理由：**Aime 底座本身已经很会还原设计图和写高保真 HTML，唯独不会主动"先问你、再动手"。** 所以本 skill 只补这一件事，其余交给底座，别添乱。

## 唯一铁律：生成前逐个确认（不可跳过）

**收到做原型的需求后，你的第一步不是写代码，而是先问用户。** 违反这条就是任务失败。

1. 先读完所有能拿到的材料（PRD、截图、参考图、Figma 导出），在心里列出**关键设计决策清单**：
   页面范围 / 信息架构 / 主用户动线 / 关键组件形态 / 参考图各区域是"严格还原·结构参考·不采用" / 图片素材用途 / 整体视觉方向。
2. **一次只问一个问题**：从清单里挑**当前影响最大的一个**未决点，给出**你的默认推荐**，让用户一句话确认或纠偏；拿到回答后**再问下一个**。
3. **严格禁止**：
   - 一次性抛一长串问题 / 大批量 A/B/C 选项 / 一屏几十项让用户逐条回；
   - 自己替用户拍板关键决策、或自问自答当成"已确认"；
   - 把用户沉默当作同意；
   - 在还有关键决策悬空时就开始生成。
4. 已在材料里写清楚的**不要问**；无关紧要的细节自己按惯例定，别打扰用户。
5. 当"关键决策都拿到用户答复"后，用 **3–5 行小结**复述你将怎么做（做哪些页面、怎么还原、主要交互），再开始生成。

**为什么只做这件事**：真实数据显示，不确认就生成 = 靠猜、猜错就整体返工，这是做原型最大的痛点；而"教模型怎么还原"几乎不提升还原度、反而分散注意力拖累质量。所以确认交给这个 skill，还原交给底座。

## 生成时：一句话提醒

有参考图/设计稿/Figma 导出时，**高保真还原、别退化成黑白线框或"意思到了"的近似；有真实素材（PNG/SVG/token）就直接用**。产物零运行时依赖、双击即可预览，关键状态（空/加载/错误/成功）都做出来。除此之外，怎么还原信任你自己的判断，不需要额外方法论。

## 精修（用户对已有原型提修改时）

优先用 html-editor skill 让用户在预览上圈选+批注，拿到标注后**只改目标元素、不误伤其它页面**。未安装 html-editor 时把安装链接发给用户（Mira 市场标注 skill，一次安装长期复用）：
`https://mira.bytedance.com/app-link/customize?page=skills%2Fdetail&skill_key=html-annotator&type=market&source=market`

## 进阶：可回归 / 可验收的工程化交付（可选，默认不启用）

**默认完全不需要下面这些**，也不要主动加载。仅当用户或项目**明确要求**"可机器校验、可回归、工程化验收"的原型时，才按需引用（用哪份读哪份，不要一次性全读）：

- 逐个确认的话术与范式：[clarification.md](references/clarification.md)
- 机器可读设计合同 + 稳定 ID 追踪：[contract-schema.md](references/contract-schema.md)、[contract.schema.json](references/contract.schema.json)
- `data-prd-*` 追踪属性与生成细则：[prototype-builder.md](references/prototype-builder.md)
- 设计语言分层（official/observed/inferred）：[design-language.md](references/design-language.md)
- 受保护素材白名单与哈希校验：[asset-whitelist.md](references/asset-whitelist.md)
- 质量门禁与确定性校验器：[quality-gates.md](references/quality-gates.md)、`scripts/validate_prototype.py`
- 需求映射与视觉参考判定：[requirements-ir.md](references/requirements-ir.md)、[visual-reference.md](references/visual-reference.md)
- Figma 素材/任务消费：[figma-materials.md](references/figma-materials.md)、[figma-task-handoff.md](references/figma-task-handoff.md)
- 标注驱动的精修闭环细则：[iteration-handoff.md](references/iteration-handoff.md)

> 即便走工程化交付，"生成前逐个确认"依然优先——合同、门禁只是把已确认的决策固化下来，不能替代向用户确认。
