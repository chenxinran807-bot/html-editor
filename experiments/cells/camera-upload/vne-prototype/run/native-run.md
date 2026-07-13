# Native VNE run evidence

All paths below are workspace-relative. Personal absolute paths and authorization material were removed from this report; exit codes and error semantics are preserved.

## Environment gate

Command:

`[VNE skill root]/scripts/check_env.sh`

Stdout:

`✓ vne-prototype skill 环境门禁通过：bytedcli 0.100.0, 已登录`

Exit: `0`.

## Official scaffold initialization

Command:

`[VNE skill root]/scripts/init_project.sh experiments/cells/camera-upload/vne-prototype/artifact/camera-upload`

Stdout/stderr:

`>> Running pnpm install ...`

Exit: `1`. The script suppressed the underlying package-manager error, so the exact install was replayed inside the generated scaffold.

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

## Official preview

Command:

`[VNE skill root]/scripts/dev_demo.sh experiments/cells/camera-upload/vne-prototype/artifact/camera-upload --background`

Result: preview started at `http://localhost:5173`. Exit: `0`.

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

## Browser QA

Command:

`pnpm exec playwright test qa/browser-qa.spec.cjs --reporter=line --workers=1`

The first replay completed all ten task assertions but found one missing-favicon 404 and exited `1`. A data favicon was added, the official build was rerun successfully, and the final replay passed.

Final stdout and exit are preserved verbatim in `artifact/camera-upload/qa/browser-qa.stdout.txt` and `browser-qa.exit-code.txt`. Structured evidence records 10/10 task passes, zero console errors, and zero page errors.
