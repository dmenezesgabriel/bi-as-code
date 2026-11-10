import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

/**
 * A PATH directory whose `pnpm` only records the script it was asked to run,
 * so the gate's step list can be read without running any step.
 */
class RecordingPnpm {
  private readonly directory = mkdtempSync(join(tmpdir(), "biac-fake-pnpm-"));
  private readonly record = join(this.directory, "calls.txt");

  constructor() {
    const stub = join(this.directory, "pnpm");
    writeFileSync(stub, `#!/bin/sh\necho "$*" >> "${this.record}"\n`);
    chmodSync(stub, 0o755);
    writeFileSync(join(this.directory, "loadavg"), "0.10 0.10 0.10 1/1 1\n");
  }

  /** Runs scripts/gate.sh with the stub first on PATH and a calm host. */
  runGate(extraEnv: NodeJS.ProcessEnv): number | null {
    return spawnSync(
      // eslint-disable-next-line sonarjs/no-os-command-from-path -- the gate runs under whatever `bash` the caller has, and the stub `pnpm` directory is put on PATH on purpose
      "bash",
      ["scripts/gate.sh"],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          ...extraEnv,
          PATH: `${this.directory}:${process.env.PATH ?? ""}`,
          BIAC_LOADAVG_FILE: join(this.directory, "loadavg"),
        },
        stdio: "ignore",
      },
    ).status;
  }

  /** The `pnpm` argument lines the gate issued, in order. */
  calls(): string[] {
    return readFileSync(this.record, "utf8").trim().split("\n");
  }

  remove(): void {
    rmSync(this.directory, { recursive: true, force: true });
  }
}

describe("scripts/gate.sh steps", () => {
  let pnpm: RecordingPnpm | undefined;

  afterEach(() => {
    pnpm?.remove();
    pnpm = undefined;
  });

  it("ends with the browser tier by default", () => {
    pnpm = new RecordingPnpm();

    const status = pnpm.runGate({ BIAC_GATE_SKIP_BROWSER: "" });

    expect(status).toBe(0);
    expect(pnpm.calls().at(-1)).toBe("-s test:e2e-browser --retries=1");
  });

  it("leaves the browser tier out when BIAC_GATE_SKIP_BROWSER is 1", () => {
    pnpm = new RecordingPnpm();

    const status = pnpm.runGate({ BIAC_GATE_SKIP_BROWSER: "1" });

    expect(status).toBe(0);
    expect(
      pnpm.calls().filter((call) => call.startsWith("-s test:e2e-browser")),
    ).toEqual([]);
    expect(pnpm.calls()).toContain("-s test:cucumber");
  });
});
