#!/usr/bin/env bash
set -uo pipefail

CELL_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REPO_ROOT="$(cd "$CELL_DIR/../../../.." && pwd)"
URL="http://127.0.0.1:8291/index.html"
SERVER_PID=""

cleanup() {
  if [ -n "$SERVER_PID" ]; then kill "$SERVER_PID" 2>/dev/null || true; fi
}
trap cleanup EXIT

if ! curl -fsS "$URL" >/dev/null 2>&1; then
  python3 -m http.server 8291 --bind 127.0.0.1 --directory "$CELL_DIR/artifact" >"$CELL_DIR/qa/server.log" 2>&1 &
  SERVER_PID=$!
  for _ in 1 2 3 4 5; do
    curl -fsS "$URL" >/dev/null 2>&1 && break
    sleep 1
  done
fi

cd "$REPO_ROOT"
set +e
"$CELL_DIR/qa/runtime/node_modules/.bin/playwright" test "$CELL_DIR/qa/browser-qa.spec.js" --reporter=line --workers=1 2>&1 | tee "$CELL_DIR/qa/browser-qa.stdout.txt"
status=${PIPESTATUS[0]}
set -e
printf '%s\n' "$status" > "$CELL_DIR/qa/browser-qa.exit-code.txt"
exit "$status"

