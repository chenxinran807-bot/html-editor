# Browser validation

Install the pinned test dependency with `npm install --prefix qa/runtime`, start the native Open Design server from `artifact/` on port 8289, then execute from the cell root:

`qa/runtime/node_modules/.bin/playwright test qa/browser-qa.spec.js --reporter=line --workers=1`

The fixed camera-upload tasks are asserted in order. `browser-qa-raw.json` records task booleans, persisted facing state, console errors and page errors. Screenshots cover entry, source choices, photo confirmation and review failure.

Observed final run: 1 passed in 7.7s; zero console errors; zero page errors. The first real-browser run exposed one favicon 404 and failed as designed. Adding an empty data favicon removed that error; the subsequent run passed.
