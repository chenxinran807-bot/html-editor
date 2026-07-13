# Browser validation

Install the pinned test dependency with `npm install --prefix qa/runtime`, start the native Open Design server from `artifact/` on port 8289, then execute from the cell root:

`qa/runtime/node_modules/.bin/playwright test qa/browser-qa.spec.js --reporter=line --workers=1`

The fixed camera-upload tasks are asserted in order. `browser-qa-raw.json` records browser version, viewport, start/end/duration, timestamped per-task assertions, persisted facing state, console errors and page errors. Screenshots cover entry, policy, source choices, flipped camera, album, confirmation, loading, failure, success, and a second viewport. `browser-qa.stdout.txt` and `browser-qa.exit-code.txt` preserve the replay outcome.

Observed final run: 2 passed; zero console errors; zero page errors; exit code 0. The first original browser run exposed one favicon 404 and failed as designed. The later TDD regression run also failed first because design-system tokens were not linked, then passed after the implementation was fixed.
