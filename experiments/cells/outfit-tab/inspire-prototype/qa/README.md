# Replaying browser QA

Run this in the Codex Browser Node environment. The script selects the browser from the remote preview URL and creates its own tab; it does not require an implicit pre-bound `tab`.

```js
var replay = await import('file:///Users/bytedance/Documents/prd-demo/.worktrees/native-skill-experiment/experiments/cells/outfit-tab/inspire-prototype/qa/replay-browser-qa.mjs');
var session = await replay.connect('https://6a54c06f0355ab02671022c5-prototype.inspire.bytedance.net');
nodeRepl.write(session.documentation);
// Read the complete emitted browser documentation before continuing.
var result = await replay.runFromPreview(session, '/Users/bytedance/Documents/prd-demo/.worktrees/native-skill-experiment/experiments/cells/outfit-tab/inspire-prototype/qa');
nodeRepl.write(JSON.stringify(result.tasks.map(({ id, status }) => ({ id, status })), null, 2));
```

The run overwrites `01-entry.png` through `04-product-ai-actions.png` and `browser-qa.raw.json`. Every task records locator count, before/after URL and DOM SHA-256. The selected browser exposes console logs but not a separate page-error event stream, so that capability gap is recorded explicitly instead of being represented as an empty page-error list.
