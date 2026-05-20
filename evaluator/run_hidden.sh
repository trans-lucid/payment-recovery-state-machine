#!/usr/bin/env bash
set -euo pipefail

TARGET="${EVAL_TARGET:-$(pwd)/solution}"
EVAL_TARGET="$TARGET" npx vitest run --config vitest.config.ts evaluator/tests_hidden/*.test.ts
