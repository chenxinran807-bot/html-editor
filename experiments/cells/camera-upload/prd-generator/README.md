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

## QA

- Real-browser task run: 10/10 fixed tasks passed.
- Console errors: 0.
- Page errors: 0.
- Key screenshots are stored in `qa/`; the machine-readable run is `qa/task-results.json`.

## Product decisions

- Closing the camera returns to the upload-source sheet rather than dismissing avatar creation.
- Retake preserves front/back camera state.
- Review failure is deterministic so reviewers can reliably inspect recovery guidance.
- Retry returns to the source sheet, allowing either camera or album recovery.

## Deviation

The prototype simulates camera and review behavior with supplied local imagery; it does not request device camera permission or call a review service.
