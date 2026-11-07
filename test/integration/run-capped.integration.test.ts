import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/run-capped.sh",
);

/**
 * The wrapper's caps only apply where a systemd user scope can be started the
 * way it starts one. A GitHub-hosted runner has the user manager's socket yet
 * cannot place a scope, so the socket's presence would not be enough; a
 * missing `systemd-run` leaves the status null.
 */
const CAN_START_SCOPE =
  spawnSync(
    // eslint-disable-next-line sonarjs/no-os-command-from-path -- the probe must resolve `systemd-run` through PATH exactly as scripts/run-capped.sh does; a fixed path would probe a different binary
    "systemd-run",
    ["--user", "--scope", "--slice-inherit", "--quiet", "true"],
    { stdio: "ignore" },
  ).status === 0;

/** The environment of a wrapper call outside any enclosing capped scope. */
function cappedEnvironment(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.BIAC_CAPPED;
  return env;
}

/** Runs the wrapper outside any enclosing capped scope. */
function runCapped(...args: string[]) {
  return spawnSync(SCRIPT, args, {
    encoding: "utf8",
    env: cappedEnvironment(),
  });
}

/**
 * A PATH directory holding a `systemd-run` that fails the way a GitHub-hosted
 * runner's does: the user manager answers, but cannot report the slice a scope
 * would join.
 */
class FailingSystemdRun {
  private readonly directory = mkdtempSync(
    join(tmpdir(), "biac-fake-systemd-"),
  );

  constructor() {
    const stub = join(this.directory, "systemd-run");
    writeFileSync(
      stub,
      "#!/bin/sh\necho 'Failed to get PID slice: No such device or address' >&2\nexit 1\n",
    );
    chmodSync(stub, 0o755);
  }

  /** The PATH to run the wrapper with: the stub first, the real tools after. */
  get path(): string {
    return `${this.directory}:${process.env.PATH ?? ""}`;
  }

  remove(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

describe("run-capped.sh", () => {
  let failingSystemdRun: FailingSystemdRun | undefined;

  afterEach(() => {
    failingSystemdRun?.remove();
    failingSystemdRun = undefined;
  });

  it("passes the wrapped command's exit status through", () => {
    const result = runCapped("probe", "sh", "-c", "exit 3");

    expect(result.status).toBe(3);
  });

  it("falls back to nice and timeout when the user manager cannot start a scope", () => {
    failingSystemdRun = new FailingSystemdRun();

    const result = spawnSync(SCRIPT, ["probe", "sh", "-c", "exit 3"], {
      encoding: "utf8",
      env: { ...cappedEnvironment(), PATH: failingSystemdRun.path },
    });

    expect(result.stderr).not.toContain("Failed to get PID slice");
    expect(result.status).toBe(3);
  });

  it("rejects a call without a command, naming what it got", () => {
    const result = runCapped("probe");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("got: probe");
  });

  it.runIf(CAN_START_SCOPE)(
    "kills a background child the command left running",
    () => {
      const result = runCapped(
        "probe",
        "sh",
        "-c",
        "sleep 60 >/dev/null 2>&1 & echo $!",
      );
      const strayPid = Number(result.stdout.trim());

      expect(result.status).toBe(0);
      expect(strayPid).toBeGreaterThan(0);
      expect(isAlive(strayPid)).toBe(false);
    },
  );
});
