#!/usr/bin/env bash
# Holds the gate back while the host is busier than it has cores: with the
# 1 min load above nproc there are more runnable tasks than cores, so a
# test tier started then only lengthens every queue and its timeouts
# measure the neighbours, not this repo's code (AGENTS.md "Wait when the
# host is busy"). It prints the reading once, re-checks until the load is
# at or under the core count, and gives up with exit 75 (EX_TEMPFAIL)
# after the maximum wait rather than start a run that would only fail.
# Overrides: BIAC_GATE_POLL_SECONDS (default 15 — the 1 min load moves
# slowly), BIAC_GATE_MAX_WAIT_SECONDS (default 600 — two waits plus a
# full gate stay inside run-capped.sh's 45m runtime cap),
# BIAC_LOADAVG_FILE (default /proc/loadavg) and BIAC_NPROC (default
# nproc), which tests use to inject a reading.
#
# Usage: scripts/wait-for-host.sh
# Example: BIAC_NPROC=0 BIAC_GATE_MAX_WAIT_SECONDS=20 scripts/wait-for-host.sh
set -euo pipefail

loadavg_file=${BIAC_LOADAVG_FILE:-/proc/loadavg}
cores=${BIAC_NPROC:-$(nproc)}
poll_seconds=${BIAC_GATE_POLL_SECONDS:-15}
max_wait_seconds=${BIAC_GATE_MAX_WAIT_SECONDS:-600}

read_load1() {
  local line
  line=$(<"$loadavg_file")
  if [[ ! $line =~ ^([0-9]+\.[0-9]+)\  ]]; then
    echo "wait-for-host: unreadable load in ${loadavg_file}: \"${line}\", expected \"<load1> <load5> <load15> ...\"" >&2
    exit 64
  fi
  echo "${BASH_REMATCH[1]}"
}

# `load` is a reserved word in gawk (a GitHub-hosted runner's awk): used as a
# variable name it is a fatal error, and `is_busy` would read as "not busy".
is_busy() {
  awk -v reading="$1" -v cores="$cores" 'BEGIN { exit !(reading > cores) }'
}

start=$SECONDS
load1=$(read_load1)
is_busy "$load1" || exit 0
echo "gate: waiting — 1 min load ${load1} on ${cores} cores (re-checking every ${poll_seconds}s, up to ${max_wait_seconds}s)"
while is_busy "$load1"; do
  if ((SECONDS - start >= max_wait_seconds)); then
    echo "gate: host still busy after $((SECONDS - start))s — 1 min load ${load1} on ${cores} cores; not starting" >&2
    exit 75
  fi
  sleep "$poll_seconds"
  load1=$(read_load1)
done
echo "gate: host ready after $((SECONDS - start))s — 1 min load ${load1} on ${cores} cores"
