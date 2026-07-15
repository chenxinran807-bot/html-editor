# Editorial Outfit Tab debug prototype

This directory is reserved for a debug prototype of the new Douyin Mall standalone “穿搭” Tab. It does not modify or extend the formal design-language assets.

## Goal and scope

The product goal is editorial browsing, saving, and product discovery through editor-curated image-and-text outfit stories. The approved scope covers the outfit feed, editorial feature cards, story detail, the story/product dual view, saving, product selection, and prototype-only purchase feedback.

This task only completes the context contract in `demo-context.json`. It does not implement UI, production integrations, checkout, authentication, recommendation, inventory, cart, or payment behavior.

## Soft open questions

- Which production API supplies product data, inventory, and prices?
- What are the final position and icon for the outfit Tab in the production bottom navigation?

Both questions are soft: they affect production integration or final navigation visuals, but do not block the static prototype.

## Explicit prohibitions

- Do not invent real sales, reviews, discounts, or lowest-price claims.
- Do not present editor-curated content as ordinary user-generated content.
- Do not implement real payment, login, or cart integrations.
- Do not claim pixel-level fidelity without a source design.
- Do not read from or reuse older same-topic designs or implementation plans.
- Do not modify formal design-language assets from this debug prototype.

## Run the current context contract

From the repository root, run:

```sh
node --test qa/editorial-outfit-static.test.mjs
```

## Design-language sources

The following absolute paths are the design-language source locations on the current machine. In another environment, resolve the same logical files again from that environment's installed `ecommerce-design-language` skill root; do not assume these machine-specific absolute paths are portable.

- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/全局通用规则.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/设计资产目录和映射.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/token/设计 Token.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/标签栏Tab.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/商品卡.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/按钮.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件/货币／价格.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/布局.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/颜色.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/文字.md`
- `/Users/bytedance/.codex/skills/ecommerce-design-language/assets/design-assets/common/md/组件元素/圆角.md`
