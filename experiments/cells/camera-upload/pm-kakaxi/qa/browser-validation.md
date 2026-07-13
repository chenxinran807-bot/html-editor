# Browser QA

Run from the repository root:

```bash
npm install --prefix experiments/cells/camera-upload/pm-kakaxi/qa/runtime
experiments/cells/camera-upload/pm-kakaxi/qa/run-browser-qa.sh
```

The replay script starts a loopback server when needed, runs the ten fixed camera-upload tasks plus three inferred recovery scenarios, captures screenshots, records browser/timing/per-task data, and saves stdout and the exit code. It does not request camera permission or contact a review service.

