#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/candidate"

if [ ! -d node_modules ]; then
  npm ci
fi

set +e
OUTPUT="$(npm run test:unit 2>&1)"
STATUS=$?
set -e

printf '%s\n' "$OUTPUT"

if [ "$STATUS" -eq 0 ]; then
  echo "expected candidate starter to fail public unit tests, but it passed" >&2
  exit 1
fi

if grep -Eq "duplicate_gateway_charge|timeout_marked_failed|missing_gateway_evidence|settlement_state_wrong" <<<"$OUTPUT"; then
  echo "candidate starter failed for expected public marker"
  exit 0
fi

echo "candidate starter failed, but not for an expected marker" >&2
exit 1
