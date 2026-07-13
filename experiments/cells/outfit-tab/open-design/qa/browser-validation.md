# Browser validation

Preview tested: `http://localhost:8289/opendesign/mockups/outfit-tab/index.html`

Browser: Chrome, real local HTTP navigation. Console/page errors: 0. Babel emits its expected prototype-only precompile warning; this is captured in the raw log and treated as a handoff concern rather than an application error.

## Fixed-task evidence

| Task | Actions and observed result | Status |
|---|---|---|
| `switch-category` | Opened entry, clicked “场景适配”, observed active category and unique feed reason “通勤不刻板”. | PASS |
| `open-reason-card` | Clicked “看为什么适合我”, observed the detail region and “为什么适合你”. | PASS |
| `read-guidance` | Confirmed unique headings and content for “为什么适合你”, “配色公式”, and “避雷与尺码”. | PASS |
| `open-product-or-alternative` | Clicked “看平替”, observed “水洗短款丹宁外套”, ¥199, material/size data, and “比同款省 ¥159”. | PASS |
| `enter-ai-styling-or-try-on` | Clicked “进入 AI 试穿”, observed loading state “正在准备试穿间”, then result entry “上传正面全身照”. | PASS |

## Screenshots

- `qa/screenshots/01-entry.png` — entry/feed state.
- `qa/screenshots/02-detail-guidance.png` — intermediate detail/guidance state.
- `qa/screenshots/03-ai-try-on-result.png` — result/AI try-on entry state.
- `qa/screenshots/04-react-entry.png` — React entry from the reproducible CDP run.
- `qa/screenshots/05-react-detail.png` — React guidance state from the reproducible CDP run.
- `qa/screenshots/06-react-ai-result.png` — React AI result from the reproducible CDP run.

## Reproduction

With the artifact served on port 8289, run:

`node experiments/cells/outfit-tab/open-design/qa/run-browser-qa.mjs`

The script launches an isolated headless Chrome, clears storage, follows all five fixed tasks continuously from entry, exercises AI failure/retry, refreshes the page, checks restored category/screen state, captures screenshots, and overwrites `qa/browser-qa-raw.json` with raw console/page events and assertions.

## Additional interaction coverage

- Like produces positive recommendation feedback.
- Dislike removes the card and shows a recoverable empty state.
- Same-item and lower-cost alternative both open product sheets.
- AI styling provides a disabled loading task, a failure state, and retry; AI try-on provides disabled loading and a destination state.
- Active category and current screen persist through `localStorage`; “重置演示” clears demo state.
- All primary mobile controls meet or exceed the 44 px target.

## Visual QA

- Mobile shell remains centered and usable at desktop browser width.
- Visual language matches supplied references: white/pale gray surfaces, ink controls, lime suitability highlights, dense commerce hierarchy, no decorative gradients.
- Entry, content detail, and bottom-sheet result remain readable without overlaps at the tested viewport.
