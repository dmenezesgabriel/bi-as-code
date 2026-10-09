import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/run-capped.sh",
);

/**
 * The wrapper's caps only apply under a systemd user manager — present
 * when its private socket is.
 */
const HAS_USER_SYSTEMD = existsSync(
  `/run/user/${process.getuid?.() ?? -1}/systemd/private`,
);

/** Runs the wrapper outside any enclosing capped scope. */
function runCapped(...args: string[]) {
  const env = { ...process.env };
  delete env.BIAC_CAPPED;
  return spawnSync(SCRIPT, args, { encoding: "utf8", env });
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
  it("passes the wrapped command's exit status through", () => {
    const result = runCapped("probe", "sh", "-c", "exit 3");

    expect(result.status).toBe(3);
  });

  it("rejects a call without a command, naming what it got", () => {
    const result = runCapped("probe");

    expect(result.status).toBe(64);
    expect(result.stderr).toContain("got: probe");
  });

  it.runIf(HAS_USER_SYSTEMD)(
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
