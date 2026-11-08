#!/usr/bin/env bash
# Runs a command inside a resource-capped systemd user scope so one repo's
# test run can't starve a host shared with other repos' runs:
#   - nice 10 and CPUWeight let the run use every idle core but yield to
#     interactive work under contention (a weight, unlike a quota, never
#     idles a free host); MemoryHigh/MemoryMax cap what it may take;
#   - RuntimeMaxSec kills a hung run instead of letting it linger;
#   - the scope is stopped on exit (and Ctrl-C), which kills every process
#     still in it — dev servers, browsers and esbuild services a dying test
#     worker never got to tear down.
# Overrides: BIAC_CPU_WEIGHT (default 30, systemd's own background.slice
# weight against app.slice's 100), BIAC_MEMORY_HIGH
# (default 6G), BIAC_MEMORY_MAX (default 8G), BIAC_RUNTIME_MAX (default
# 90m — a unit both systemd and coreutils `timeout` parse). Started inside a
# devjob job (DEVJOB_UNIT set) it applies only nice and the runtime cap: the
# job's service carries the rest. Without a
# systemd user manager that can start a scope (CI containers, macOS, a
# GitHub-hosted runner) it falls back to `nice` + `timeout`.
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

cpu_weight=${BIAC_CPU_WEIGHT:-30}
memory_high=${BIAC_MEMORY_HIGH:-6G}
memory_max=${BIAC_MEMORY_MAX:-8G}
# 90m: measured over 7 days (2026-10-31..11-07), 24 of 79 gates and 5 of the
# e2e runs hit the former 45m cap while working at their normal ~2.8 cores
# (a killed gate had used 124 CPU-min); a full e2e pass needs 90-120 CPU-min
# and a gate 115-150, i.e. 41-54 min at that rate, the slowest completed run
# took 67 min. A hung run is still cut, just later.
runtime_max=${BIAC_RUNTIME_MAX:-90m}

# Under devjob the job's own service already holds the host's caps (the
# slice's memory budget and oomd) and kills everything the run leaves behind.
# A scope started from here would sit beside that service in the slice, not
# under it: at CPUWeight 30 against the service siblings' 100 (3x less CPU
# under contention), under a 6G MemoryHigh that swapped 56 of 58 gates
# (1.5-3 GB), and outside the accounting devjob reports. Only the runtime
# cap and nice remain to apply.
if [[ -n "${DEVJOB_UNIT:-}" ]]; then
  exec nice -n 10 timeout --kill-after=30s "$runtime_max" "$@"
fi

# A user manager that answers is not enough: a GitHub-hosted runner's does,
# yet `systemd-run --slice-inherit` fails there with "Failed to get PID
# slice: No such device or address". The probe starts a real scope the way
# the capped run below does, so it falls back exactly when that would fail.
can_start_scope() {
  systemd-run --user --scope --slice-inherit --quiet true >/dev/null 2>&1
}

if ! can_start_scope; then
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
# --slice-inherit: started inside another capped unit (a devjob job), the
# scope stays in that unit's slice instead of escaping to app.slice.
systemd-run --user --scope --slice-inherit --quiet --unit="$unit" \
  -p CPUWeight="$cpu_weight" \
  -p MemoryHigh="$memory_high" \
  -p MemoryMax="$memory_max" \
  -p RuntimeMaxSec="$runtime_max" \
  nice -n 10 "$@"
