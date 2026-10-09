#!/usr/bin/env bash
# The full quality gate, fail-fast: cheap static checks first, so a lint
# error never waits behind (or burns host resources on) a 10-minute browser
# run. Every step stays quiet on a pass and prints its own failure output.
# `pnpm gate` runs this inside scripts/run-capped.sh, so the whole gate —
# and anything a step leaves behind — lives in one capped scope.
set -euo pipefail

step() {
  local name=$1
  shift
  local start=$SECONDS
  "$@"
  echo "gate: ${name} passed ($((SECONDS - start))s)"
}

for script in typecheck lint lint:style format:check knip dep:cruise jscpd; do
  step "$script" pnpm -s "$script"
done
# One vitest process over every project shares a single capped worker pool.
step "vitest (unit, web-unit, integration, e2e)" pnpm -s exec vitest run
step cucumber pnpm -s test:cucumber
step e2e-browser pnpm -s test:e2e-browser
