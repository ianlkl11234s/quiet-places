#!/bin/bash
# Usage: perf.sh PORT SESSION OUT.jsonl scene [scene...]
# Runs tests/waterlight-performance.html (real app + composer, 5 s warmup,
# 15 s sample) for each scene at noon in one isolated headed session.
PORT=$1; SES=$2; OUT=$3; shift 3
A="agent-browser --session $SES"
first=1
: > "$OUT"
for p in "$@"; do
  url="http://127.0.0.1:$PORT/tests/waterlight-performance.html?place=$p"
  if [ $first = 1 ]; then agent-browser --headed --session $SES open "$url" >/dev/null 2>&1; first=0
  else $A open "$url" >/dev/null 2>&1; fi
  $A set viewport 1600 900 >/dev/null 2>&1
  sleep 8
  $A eval "document.querySelector('[data-moment=noon]')?.click()" >/dev/null 2>&1
  for i in $(seq 1 30); do
    r=$($A eval "document.getElementById('performance-report')?.textContent||''" 2>/dev/null)
    case "$r" in *'\"done\":true'*|*'"done":true'*) break;; esac
    sleep 2
  done
  echo "{\"place\":\"$p\",\"report\":$r}" >> "$OUT"
  echo "measured $p"
done
$A close >/dev/null 2>&1
