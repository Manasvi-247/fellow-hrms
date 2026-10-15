#!/usr/bin/env bash
# Records each scene in its own browser run, retrying flaky ones.
cd "$(dirname "$0")"
for s in "$@"; do
  for attempt in 1 2 3; do
    node record.mjs "$s" > "clips/$s.log" 2>&1 && grep -q "^recorded $s" "clips/$s.log" && ! grep -q Error "clips/$s.log" && { echo "ok   $s"; break; }
    echo "retry $s ($attempt)"; sleep 3
  done
done
