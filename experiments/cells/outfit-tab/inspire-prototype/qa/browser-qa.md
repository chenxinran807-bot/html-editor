# Inspire Prototype browser QA

- Asset: `6a54c06f0355ab02671022c5`
- Preview: https://6a54c06f0355ab02671022c5-prototype.inspire.bytedance.net
- Browser viewport wrapper: iPhone 12 Pro, 390 × 844
- Platform compile/runtime report: compile success, 5/5 generated captures, no reported runtime errors
- Live browser console warnings/errors: none
- Observed task states: `browser-qa.raw.json`; replay implementation: `replay-browser-qa.mjs`
- Separate `pageerror` capture is unavailable in the selected browser API. This is recorded as an evidence gap in the raw JSON; the original platform result reported `runtimeErrors=[]`.

## Fixed tasks

| Task | Result | Evidence |
| --- | --- | --- |
| `switch-category` | PASS | Clicking `场景适配` changed the feed from blogger cards to `通勤 / 轻正式` and `约会 / 显气色` cards. See `02-category-scene.png`. |
| `open-reason-card` | PASS | Clicking `西装+长裤，办公友好` navigated to `/detail?id=5`. See `03-detail-guidance.png`. |
| `read-guidance` | PARTIAL | `适合人群` and `配色公式` are visible. No avoidance guidance, size reminder, or fabric reminder is present. |
| `open-product-or-alternative` | FAIL | Product names, prices, and rating are visible in the detail page, but clicking `购买` produces no route, modal, or state change. |
| `enter-ai-styling-or-try-on` | FAIL | Clicking `试穿` and the AI styling card produces no route, modal, or state change. AI suggestions are displayed statically. |

## Visual and product observations

- The category hierarchy, compact feed, detail information grouping, and mobile shell are coherent.
- Feed/detail imagery is semantically unrelated to outfits (railway, bridge, sky, mountain), despite five product-solution fixture images being attached.
- The main product card exposes prices and rating, but purchase is a dead control.
- Like/dislike controls and AI continuation content are visible, but the required product and AI destination flows are not implemented.
- No relevant empty, loading, failure, retry, or fallback states are available for the tested paths.

## Native deviations

1. Inspire rejected all 13 fixture images before creating an Asset because the platform maximum is 10. The recovery kept the frozen PRD body unchanged and attached only this cell's five product-solution images (`009`–`013`).
2. Platform-generated captures passed, but live browser testing found dead product and AI controls; scores use live behavior rather than generated capture count.
