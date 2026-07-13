#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."

STARTED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
python3 -m http.server 4183 --bind 127.0.0.1 --directory artifact > qa/server.log 2>&1 &
SERVER_PID=$!
cleanup() { kill "$SERVER_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in 1 2 3 4 5; do
  curl --noproxy localhost -fsS http://127.0.0.1:4183/ >/dev/null && break
  sleep 1
done

set +e
npm --prefix qa run qa 2>&1 | tee qa/browser-qa-stdout.log
EXIT_CODE=${PIPESTATUS[0]}
set -e
FINISHED_AT="$(date -u +%Y-%m-%dT%H:%M:%S.000Z)"
STARTED_AT="$STARTED_AT" FINISHED_AT="$FINISHED_AT" EXIT_CODE="$EXIT_CODE" node -e '
const fs=require("fs");
fs.writeFileSync("qa/browser-qa-execution.json",JSON.stringify({
  command:"npm --prefix qa run qa",
  serverUrl:"http://127.0.0.1:4183/",
  startedAt:process.env.STARTED_AT,
  finishedAt:process.env.FINISHED_AT,
  exitCode:Number(process.env.EXIT_CODE),
  stdout:"qa/browser-qa-stdout.log",
  serverLog:"qa/server.log"
},null,2));'
exit "$EXIT_CODE"
