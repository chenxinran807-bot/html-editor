# Browser validation

Preview tested: `http://localhost:8289/opendesign/mockups/outfit-tab/index.html`

Browser: Chrome, real local HTTP navigation. The captured run contains no console/page error, but this does not establish full stability: assertions are mostly text-presence checks and the harness hard-codes `tasksPassed: 5` rather than deriving the count from assertion outcomes. Babel also emits its expected prototype-only precompile warning.

## Fixed-task evidence

| Task | Actions and observed result | Status |
|---|---|---|
| `switch-category` | Opened entry, clicked “场景适配”, observed active category and unique feed reason “通勤不刻板”. | PASS |
| `open-reason-card` | Clicked “看为什么适合我”, observed the detail region and “为什么适合你”. | PASS |
| `read-guidance` | Confirmed unique headings and content for “为什么适合你”, “配色公式”, and “避雷与尺码”. | PASS |
| `open-product-or-alternative` | Clicked “看平替”, observed “水洗短款丹宁外套”, ¥199, material/size data, and “比同款省 ¥159”. | PASS |
| `enter-ai-styling-or-try-on` | Clicked “进入 AI 试穿”, observed loading state “正在准备试穿间”, then result entry “上传正面全身照”. This does not cover a successful similar-style AI result. | PASS_WITH_CONCERNS |

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

The script launches an isolated headless Chrome, clears storage, follows all five fixed tasks continuously from entry, exercises AI failure/retry, refreshes the page, checks restored category/screen state, captures screenshots, and overwrites `qa/browser-qa-raw.json`. Its evidence is limited: it verifies retry only by seeing loading reappear, never verifies a terminal state after retry, relies mainly on visible-text presence, and hard-codes `tasksPassed: 5`.

## Additional interaction coverage

- Like produces positive recommendation feedback.
- Dislike removes the card and shows a recoverable empty state.
- Same-item and lower-cost alternative both open product sheets.
- AI styling exposes loading, failure, and retry controls, but retry remains permanently loading because the effect does not restart after the internal phase change. AI try-on has a result; similar-style styling has no success state.
- Active category and current screen persist through `localStorage`; “重置演示” clears demo state.
- Several menu, primary-tab, recommendation, bottom-nav, and album controls only emit a toast rather than opening a substantive state.

## Visual QA

- Mobile shell remains centered and usable at desktop browser width.
- Visual language broadly matches supplied references, but using the reference screenshot as in-product imagery nests old UI inside new UI and produces ghosting/cropping.
- Hover treatment and animated transitions are incomplete relative to the interactive-prototype requirements.
- Required condition coverage is incomplete: the UI does not expose three distinct condition classifications.
