#!/usr/bin/env bash
# The full quality gate, fail-fast: cheap static checks first, so a lint
# error never waits behind (or burns host resources on) a 10-minute browser
# run. Every step stays quiet on a pass and prints its own failure output.
# `pnpm gate` runs this inside scripts/run-capped.sh, so the whole gate —
# and anything a step leaves behind — lives in one capped scope. Before
# each test tier that loads the host, scripts/wait-for-host.sh holds the
# gate back while the 1 min load exceeds the core count.
# BIAC_GATE_SKIP_BROWSER=1 leaves the browser tier out, for a CI job that
# runs it separately and sharded.
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
scripts/wait-for-host.sh
# One vitest process over every project shares a single capped worker pool.
step "vitest (unit, web-unit, integration, e2e)" pnpm -s exec vitest run
step cucumber pnpm -s test:cucumber
if [[ ${BIAC_GATE_SKIP_BROWSER:-} == 1 ]]; then
  exit 0
fi
scripts/wait-for-host.sh
# One retry per failing test, as CI already does (playwright.config.ts retries 2): a gate that fails
# one test out of 466 after 36-54 minutes otherwise costs a full rerun. Measured 2026-11-09: 6 of 8
# failed gates lost 1-3 tests, a different test each time, and all 125 specs of those files passed
# alone. Playwright still lists a test that passed on retry as "flaky" in the run output.
step e2e-browser pnpm -s test:e2e-browser --retries=1
