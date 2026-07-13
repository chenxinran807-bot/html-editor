# Native VNE run evidence

All paths below are workspace-relative. Personal absolute paths and authorization material were removed from this report; exit codes and error semantics are preserved.

## Evidence persistence boundary

- The commands and exit values below were observed in the active execution session. Original terminal streams were not redirected to files at execution time, except for the final browser QA stdout and exit file.
- Therefore the environment/init/install/dev/build entries below are field-level, path-sanitized transcriptions, not independently replayable raw logs. Their original timestamps were not persisted and are explicitly **unavailable**; no timestamps were reconstructed.
- The VNE `session_start`, four `step_complete`/artifact calls, and `session_end` telemetry commands were invoked and returned no visible error, but raw responses, command timestamps, and per-call exit files were not persisted. They cannot be independently audited; for scoring this is treated as an unverified/missing native-flow evidence deviation, not asserted as proven telemetry completion.

## Environment gate

Command:

`[VNE skill root]/scripts/check_env.sh`

Stdout:

`✓ vne-prototype skill 环境门禁通过：bytedcli 0.100.0, 已登录`

Exit: `0`.

Timestamp: not persisted.

## Official scaffold initialization

Command:

`[VNE skill root]/scripts/init_project.sh experiments/cells/camera-upload/vne-prototype/artifact/camera-upload`

Stdout/stderr:

`>> Running pnpm install ...`

Exit: `1`. The script suppressed the underlying package-manager error, so the exact install was replayed inside the generated scaffold.

Timestamp: not persisted.

Diagnostic command: `pnpm install`

Relevant stderr (workspace path and authorization header sanitized):

`[ERR_PNPM_FETCH_404] GET https://registry.npmjs.org/@cloud-materials%2Fcommon: Not Found - 404`

`@cloud-materials/common is not in the npm registry, or you have no permission to fetch it.`

Exit: `1`.

The VNE build-pitfalls reference requires an internal registry and `legacy-peer-deps=true`; the distributed scaffold did not contain `.npmrc`. A project-local `.npmrc` was added with `registry=http://bnpm.byted.org` and `legacy-peer-deps=true`.

Retry: `pnpm install`

Result: 519 packages downloaded, then pnpm 11 stopped with `ERR_PNPM_IGNORED_BUILDS` and requested `pnpm approve-builds` for six dependencies. Exit: `1`.

Approval and retry:

`pnpm approve-builds @cloud-materials/charts-common @cloud-materials/common core-js-pure es5-ext esbuild fsevents && pnpm install`

Result: all six reported install scripts completed; lockfile supply-chain policy passed; install reported `Already up to date`. Exit: `0`.

Install timestamps: not persisted.

## Official preview

Command:

`[VNE skill root]/scripts/dev_demo.sh experiments/cells/camera-upload/vne-prototype/artifact/camera-upload --background`

Result: preview started at `http://localhost:5173`. Exit: `0`.

Timestamp: not persisted. The background preview was not used as clean-checkout evidence.

## Official build

First command: `[VNE skill root]/scripts/build_demo.sh experiments/cells/camera-upload/vne-prototype/artifact/camera-upload`

Result: TypeScript rejected an `id` prop passed directly to Alert. Exit: `2`. The identifier was moved to a wrapping div without changing behavior.

Final command: same official build command.

Stdout summary:

- TypeScript and Vite completed.
- 5,336 modules transformed.
- Final `dist/index.html`: 1,458,241 bytes (gzip 285.02 kB) after the Proto Edit anchor completion rebuild.
- Official ≥500KB single-file gate passed.

Exit: `0`.

Build timestamps: not persisted. No fresh-checkout install/build was performed.

### Output topology caveat

The official script labels the result a “single-file demo”, but the final HTML contains runtime references to `assets/camera.png` and `assets/captured.png`, and `dist/assets/` contains those files. The deliverable is therefore HTML plus two images, not a strictly standalone HTML file.

## Browser QA

Command:

`pnpm exec playwright test qa/browser-qa.spec.cjs --reporter=line --workers=1`

The first replay completed all ten task assertions but found one missing-favicon 404 and exited `1`. A data favicon was added, the official build was rerun successfully, and the final replay passed.

Final stdout and exit are preserved verbatim in `artifact/camera-upload/qa/browser-qa.stdout.txt` and `browser-qa.exit-code.txt`. Structured evidence records 10/10 task passes, zero console errors, and zero page errors.

QA used a `1280×900` desktop viewport and a hard-coded `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` executable. It did not validate a mobile viewport. The embedded full-screen source images are object-fit cropped under generated controls, yielding black/cropped areas and a visually mixed desktop/mobile UI.

### Wrong-working-directory attempt

After one successful official rebuild, a chained QA command was accidentally invoked from the worktree root instead of the scaffold directory. The observed error was `[ERR_PNPM_NO_PKG_MANIFEST] No package.json found`, exit `1`. Its original stdout/stderr file and timestamp were not persisted, so this is narrative evidence only. Recovery was to rerun the same Playwright command from `artifact/camera-upload/`; the final persisted stdout and exit `0` are the authoritative QA evidence.
