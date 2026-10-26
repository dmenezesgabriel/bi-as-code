#!/usr/bin/env bash
# Brings the example up around smoke.ts and takes it down again on every
# exit path — pass, failure, Ctrl-C or the caller's timeout — so a smoke
# run never leaves a stack behind.
set -euo pipefail

cd "$(dirname "$0")"
# The same default compose.yaml mounts, resolved from this directory.
site="${BIAC_SITE_DIR:-../../build}"
compose=(docker compose -f compose.yaml --profile probe)

if [[ ! -f "$site/index.html" ]]; then
	echo "no $site/index.html — build the project first: pnpm build:cli && bin/biac build" >&2
	exit 2
fi

teardown() {
	"${compose[@]}" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap teardown EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Chromium on Linux cancels in-flight requests when a network interface
# comes or goes, and every container start or stop adds or removes one.
# Wait (up to 3 minutes) until the kernel logged no veth change for 30 s.
wait_for_quiet_network() {
	command -v journalctl >/dev/null || return 0
	for _ in $(seq 18); do
		if [[ "$(journalctl -k --since -30s | grep -c veth)" == 0 ]]; then
			return 0
		fi
		sleep 10
	done
	echo "veth interfaces still changing after 3 minutes; running anyway" >&2
}

"${compose[@]}" up -d --wait
wait_for_quiet_network
node smoke.ts
