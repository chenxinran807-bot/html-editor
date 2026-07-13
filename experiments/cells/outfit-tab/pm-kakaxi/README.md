# PM Kakaxi · 穿搭 Tab 原生实验

- 预览：直接打开 `index.html`
- QA：先执行 `npm install` 与 `PLAYWRIGHT_BROWSERS_PATH=.browsers npx playwright install chromium`，再执行 `npm run qa`
- 证据：`qa/feed.png`、`qa/detail.png`、`qa/ai-entry.png`、`qa/playwright-report.json`
- 结构化上下文：`demo-context.json`

原型包含顶部场景选择器，正常、空态、加载、错误与边界态均可人工切换。
