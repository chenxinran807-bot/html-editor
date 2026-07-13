# Camera upload × PRD Generator

## Outcome

`artifact/index.html` is a responsive, self-contained interaction prototype for adding a camera source to avatar creation. It preserves the supplied product story and covers every fixed camera-upload task.

## Prototype flow

1. Create avatar and open upload-source choices.
2. Enter camera, switch facing direction, open/close the album, or close back to the source choices.
3. Capture a photo, retake while preserving the selected facing direction, or use the photo.
4. Observe review progress and a deterministic failed-review state with actionable guidance.
5. Retry and return to the camera/album source choices.

## Run

Serve the `artifact` directory with any local static server, then open `index.html`. All prototype assets are local to `artifact/assets`.

## Native PRD Generator package

The complete package is in `docs/prd/camera-upload/`: `prd.yaml`, `prd.md`, the immutable `prd-v0.md` snapshot, the native `canvas/` structure, screenshots, and reviewer records. Stage-one and stage-two decisions are preserved in `run/stages/`; design-system detection is recorded in `run/design-system-detection.md`.

## QA

- Re-run with `npm install --prefix qa && qa/run-browser-qa.sh`.
- Real-browser task run: 10/10 fixed tasks passed, plus complete visible-control, album-thumbnail, and service-timeout recovery checks.
- Console errors: 0; page errors: 0; process exit code: 0.
- `qa/browser-qa-raw.json` records selectors, expected/observed values, timestamps, URL, browser metadata, console events, and page errors.
- `qa/browser-qa-stdout.log` and `qa/browser-qa-execution.json` preserve stdout, command, server URL, timestamps, and exit status.
- Prototype audit is preserved in `run/evidence/prototype-audit.txt`.

## Product decisions

- Closing the camera returns to the upload-source sheet rather than dismissing avatar creation.
- Retake preserves front/back camera state.
- Review failure is deterministic so reviewers can reliably inspect recovery guidance.
- Retry returns to the source sheet, allowing either camera or album recovery.
- A service-timeout state preserves the photo and offers either another review or a new photo source.

## Deviation

The prototype simulates camera and review behavior with supplied local imagery; it does not request device camera permission or call a review service. The supplied imagery contains complete mobile screens and is reused inside another prototype shell, so camera-related views visibly duplicate status bars and close/flip/shutter controls and include mirrored source text. Menu/search only acknowledge clicks with toasts, and every album thumbnail converges on the same confirmation path. Successful review, permission-denied, and empty-album states are absent. `tokens.css` records inferred tokens but is not consumed by the standalone canvas page. Reviewer records were produced in the same execution context rather than by an independent clean-context reviewer, so the calibrated result is `PASS_WITH_CONCERNS` at 81/100.
