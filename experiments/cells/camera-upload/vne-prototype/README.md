# Camera upload × VNE Prototype

This cell follows the native VNE Path B creation workflow: environment gate, PRD and screenshot analysis, design-language decision, UI specification, manifest, official scaffold initialization, official dev preview, official build, and real Chrome QA.

## Deliverables

- `camera-upload-ui-spec.md`: VNE-format UI specification.
- `prototype.manifest.json`: Proto Edit bindings aligned with spec §7.
- `artifact/camera-upload/`: official standard-shell React scaffold using `@cloud-materials/common` and `@cloud-materials/charts-common`.
- `artifact/camera-upload/dist/index.html`: official single-file build (1,458,241 bytes).
- `artifact/camera-upload/qa/`: reproducible Playwright test, raw per-task assertions, screenshots, stdout, and exit code.

## Reproduce

From `artifact/camera-upload/`:

1. `pnpm install`
2. `[VNE skill root]/scripts/dev_demo.sh . --background`
3. `[VNE skill root]/scripts/build_demo.sh .`
4. `pnpm exec playwright test qa/browser-qa.spec.cjs --reporter=line --workers=1`

The package install requires the internal registry declared in the project `.npmrc`. With pnpm 11, a new machine may need to approve the six build-script dependencies recorded in `run/native-run.md`.

## Outcome

All ten fixed camera-upload tasks passed in real Chrome with zero console errors and zero page errors. The result remains `PASS_WITH_CONCERNS`: camera and review are deterministic simulations, the mobile flow is presented inside VNE's required desktop console shell, and the supplied full-screen camera captures are used as media beneath generated controls.
