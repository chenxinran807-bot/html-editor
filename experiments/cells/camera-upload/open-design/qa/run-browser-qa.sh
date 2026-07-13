#!/usr/bin/env bash
set -uo pipefail

CELL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$CELL_DIR/../../../.." && pwd)"
RUNNER="$CELL_DIR/qa/runtime/node_modules/.bin/playwright"

cd "$REPO_ROOT"
set +e
"$RUNNER" test "$CELL_DIR/qa/browser-qa.spec.js" --reporter=line --workers=1 2>&1 | tee "$CELL_DIR/qa/browser-qa.stdout.txt"
status=${PIPESTATUS[0]}
set -e
printf '%s\n' "$status" > "$CELL_DIR/qa/browser-qa.exit-code.txt"
exit "$status"

