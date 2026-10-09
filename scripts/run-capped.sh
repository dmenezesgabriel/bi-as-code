#!/usr/bin/env bash
# Runs a command inside a resource-capped systemd user scope so one repo's
# test run can't starve a host shared with other repos' runs:
#   - nice 10, CPUQuota and MemoryHigh/MemoryMax cap what the run may take;
#   - RuntimeMaxSec kills a hung run instead of letting it linger;
#   - the scope is stopped on exit (and Ctrl-C), which kills every process
#     still in it — dev servers, browsers and esbuild services a dying test
#     worker never got to tear down.
# Overrides: BIAC_CPU_QUOTA (default 400% = 4 cores), BIAC_MEMORY_HIGH
# (default 6G), BIAC_MEMORY_MAX (default 8G), BIAC_RUNTIME_MAX (default
# 45m — a unit both systemd and coreutils `timeout` parse). Without a
# systemd user manager (CI containers, macOS) it falls back to `nice` +
# `timeout`.
# Nested calls run inline: the outer scope already caps them.
#
# Usage: scripts/run-capped.sh <label> <command> [args...]
# Example: scripts/run-capped.sh e2e-browser playwright test
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "usage: run-capped.sh <label> <command> [args...], got: $*" >&2
  exit 64
fi
label=$1
shift

if [[ -n "${BIAC_CAPPED:-}" ]]; then
  exec "$@"
fi
export BIAC_CAPPED=1

cpu_quota=${BIAC_CPU_QUOTA:-400%}
memory_high=${BIAC_MEMORY_HIGH:-6G}
memory_max=${BIAC_MEMORY_MAX:-8G}
runtime_max=${BIAC_RUNTIME_MAX:-45m}

if ! systemctl --user show-environment >/dev/null 2>&1; then
  exec nice -n 10 timeout --kill-after=30s "$runtime_max" "$@"
fi

unit="biac-${label}-$$"
stop_scope() {
  systemctl --user stop "${unit}.scope" 2>/dev/null || true
}
trap stop_scope EXIT
trap 'exit 130' INT TERM

# MemoryHigh throttles (reclaims) before MemoryMax OOM-kills, so a run
# under pressure slows down rather than dying outright.
systemd-run --user --scope --quiet --unit="$unit" \
  -p CPUQuota="$cpu_quota" \
  -p MemoryHigh="$memory_high" \
  -p MemoryMax="$memory_max" \
  -p RuntimeMaxSec="$runtime_max" \
  nice -n 10 "$@"
