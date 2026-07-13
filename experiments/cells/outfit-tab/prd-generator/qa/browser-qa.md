# Browser QA

Preview: http://127.0.0.1:43117/

Environment: Google Chrome CDP, 430 × 932 viewport. `run-fixed-journey.mjs` starts the local artifact, opens one entry, clicks the journey in order, asserts every destination, records JSON and captures each state. `journey-log.json` reports empty `consoleErrors` and `pageErrors`.

| Fixed task | Evidence | Result |
|---|---|---|
| switch-category | `screenshots/category.png`: 场景适配 selected; title/subtitle and feed cards changed | PASS |
| open-reason-card | `screenshots/detail.png`: reason-led outfit opens detail | PASS |
| read-guidance | `screenshots/detail.png`: 适合人群、搭配公式、避雷提醒 are present in journey order | PASS |
| open-product-or-alternative | `screenshots/product.png`: 相似平替, price, material, size are visible | PASS |
| enter-ai-styling-or-try-on | `screenshots/ai.png`: current look is carried into AI try-on upload entry | PASS |

Additional checks: back navigation preserves a coherent journey; feedback presents confirmation; loading/error/retry preview states render; all images are local assets; no network dependency is needed.

## Calibration concerns

The automated journey verifies only the five required happy-path tasks plus upload entry. It does **not** establish complete coverage for like/dislike feedback, purchase completion, menu/search destinations, continue-styling, or the loading/empty/error/retry state matrix. Several responses are toast-only or shallow affordances. Chrome CDP substituted for Playwright. Reference collage assets also create nested UI imagery in rendered screens.
