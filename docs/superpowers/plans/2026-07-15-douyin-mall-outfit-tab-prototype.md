# Douyin Mall Outfit Tab Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate and verify a high-fidelity, interactive Inspire Prototype for the Douyin Mall standalone app's outfit inspiration tab.

**Architecture:** Use the approved design specification as the single product source, route generation through the official `inspire-prototype` CLI, and select a visible Inspire business skill only when it clearly matches Douyin Mall mobile commerce or outfit-content design. Wait for the remote generation terminal state, then verify the asset metadata, preview, captures, and private-inbox handoff.

**Tech Stack:** Inspire Prototype CLI/OpenAPI v1, Markdown design specification, NDJSON generation output.

---

### Task 1: Validate Inspire access and generation schema

**Files:**
- Read: `docs/superpowers/specs/2026-07-15-douyin-mall-outfit-tab-design.md`
- Create: `runs/inspire-outfit-tab-preflight.json`

- [ ] **Step 1: Verify the authenticated Inspire identity**

Run:

```bash
inspire-prototype whoami --json
```

Expected: exit code 0 and JSON containing the current user's `email`, `name`, and `type`.

- [ ] **Step 2: Inspect the prototype generation schema**

Run:

```bash
inspire-prototype schema 'generate prototype'
```

Expected: command documentation containing `--prompt`, `--name`, `--skill`, `--wait`, and `--fail-on-generation-error`.

- [ ] **Step 3: Query visible business skills**

Run:

```bash
inspire-prototype skills visible --json
```

Expected: valid JSON listing the user's currently visible built-in, public, or workspace skills.

- [ ] **Step 4: Record the preflight result**

Write `runs/inspire-outfit-tab-preflight.json` with:

```json
{
  "spec": "docs/superpowers/specs/2026-07-15-douyin-mall-outfit-tab-design.md",
  "identityValid": true,
  "schemaValid": true,
  "visibleSkillChecked": true,
  "selectedSkill": null,
  "selectionReason": "Set to an exact source:skillKey only when one visible skill is a high-confidence match; otherwise remain null."
}
```

Update `selectedSkill` and `selectionReason` with the exact visible skill and reason if a high-confidence match exists.

### Task 2: Generate the interactive prototype

**Files:**
- Read: `docs/superpowers/specs/2026-07-15-douyin-mall-outfit-tab-design.md`
- Modify: `runs/inspire-outfit-tab-preflight.json`
- Create: `runs/inspire-outfit-tab-generation.ndjson`

- [ ] **Step 1: Build the generation prompt from the approved design**

Use this complete prompt:

```text
为抖音商城独立端 App 生成「穿搭」Tab 的高保真可交互移动端原型，目标视口 390×844。核心定位是穿搭灵感社区，首页采用双列灵感瀑布流，视觉采用抖音原生活力风格：白底、抖音黑主色、玫红作为克制的选中和反馈色。首页包含标题、搜索、消息、推荐/关注/通勤/约会/小个子/旅行频道，卡片使用真实感穿搭摄影、交替 3:4 与 4:5 比例，并展示标题、达人、点赞数、商品数、视频或图集角标。完整实现频道切换、下拉刷新、加载更多、点赞、收藏、关注、长按菜单及状态反馈。点击卡片进入 Look 详情，展示达人、穿搭说明、话题、单品锚点、收藏整套和查看同款。查看同款打开约 72% 高的底部商品抽屉，支持单品高亮、颜色和尺码选择、单品加购、勾选多件整套加购、成功反馈及购物车角标更新。支持抽屉下滑/遮罩关闭，返回首页保持频道、滚动位置及互动状态。覆盖骨架屏、图片失败、空频道、网络异常、加载更多失败、商品售罄和登录拦截状态。所有主要入口必须可点击，不允许死按钮。
```

- [ ] **Step 2: Generate without a business skill when preflight selectedSkill is null**

Run:

```bash
inspire-prototype generate prototype --prompt "<the exact prompt from Step 1>" --name douyin-mall-outfit-tab-v1 --fail-on-generation-error --wait
```

Expected: NDJSON beginning with `started` and ending with `done`; the final status is successful.

- [ ] **Step 3: Generate with the selected visible skill when preflight selectedSkill is set**

Run the same command with the exact recorded value appended:

```bash
inspire-prototype generate prototype --prompt "<the exact prompt from Step 1>" --name douyin-mall-outfit-tab-v1 --skill <exact-selectedSkill> --fail-on-generation-error --wait
```

Only one of Step 2 or Step 3 is executed. Preserve the complete NDJSON output in `runs/inspire-outfit-tab-generation.ndjson`.

### Task 3: Verify the generated asset

**Files:**
- Read: `runs/inspire-outfit-tab-generation.ndjson`
- Create: `runs/inspire-outfit-tab-verification.md`

- [ ] **Step 1: Extract the new asset ID and terminal status**

Read the first and last NDJSON records. Confirm that the first contains `assetId`, `inboxCanvasId`, and `inboxDeepLink`, and that the last contains a successful `status` plus preview information.

- [ ] **Step 2: Re-query the prototype asset**

Run:

```bash
inspire-prototype prototype <assetId-from-generation> --wait --json
```

Expected: the same asset reaches a successful terminal state and provides `previewUrl` and/or `captures`.

- [ ] **Step 3: Write the verification record**

Create `runs/inspire-outfit-tab-verification.md` containing:

```markdown
# Inspire Outfit Tab Verification

- Asset name: douyin-mall-outfit-tab-v1
- Asset ID: value returned by generation
- Generation status: successful terminal value
- Skill: exact source:skillKey, or none
- Preview URL: value returned by Inspire
- Captures: values returned by Inspire
- Inbox deep link: value returned by Inspire
- Interaction scope requested: channels, like, collect, follow, Look detail, product drawer, variant selection, add to cart, cart badge, and failure states
```

### Task 4: Report the result to the user

**Files:**
- Read: `runs/inspire-outfit-tab-preflight.json`
- Read: `runs/inspire-outfit-tab-generation.ndjson`
- Read: `runs/inspire-outfit-tab-verification.md`

- [ ] **Step 1: Report the generation outcome**

Provide the asset name, asset ID, selected skill and reason, terminal status, preview/captures, and inbox deep link. State that the result is stored in the user's private Inspire inbox and can be added to a canvas from the Web UI.

- [ ] **Step 2: Avoid unsupported completion claims**

Only claim that the requested interactions are present when the returned preview or capture metadata supports that claim. Otherwise describe them as the generation requirements supplied to Inspire and invite visual review of the preview.
