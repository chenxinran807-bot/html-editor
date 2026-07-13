# Browser QA

Preview: http://127.0.0.1:43117/

Environment: Google Chrome headless, 430 × 932 viewport. The requested Playwright package was unavailable, so equivalent real-Chrome rendering was used. Browser stderr contained no `ReferenceError`, `TypeError`, or uncaught page error; only Chrome GPU/process diagnostics were emitted.

| Fixed task | Evidence | Result |
|---|---|---|
| switch-category | `screenshots/category.png`: 场景适配 selected; title/subtitle and feed cards changed | PASS |
| open-reason-card | `screenshots/detail.png`: reason-led outfit opens detail | PASS |
| read-guidance | `screenshots/detail.png`: 适合人群、搭配公式、避雷提醒 are present in journey order | PASS |
| open-product-or-alternative | `screenshots/product.png`: 相似平替, price, material, size are visible | PASS |
| enter-ai-styling-or-try-on | `screenshots/ai.png`: current look is carried into AI try-on upload entry | PASS |

Additional checks: back navigation preserves a coherent journey; feedback presents confirmation; loading/error/retry preview states render; all images are local assets; no network dependency is needed.

