import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/wait-for-host.sh",
);

/** A stand-in for /proc/loadavg the test controls, so no real load is needed. */
class FakeLoadavg {
  readonly dir = mkdtempSync(join(tmpdir(), "biac-loadavg-"));
  readonly path = join(this.dir, "loadavg");

  write(load1: string): void {
    writeFileSync(this.path, `${load1} 4.00 3.00 2/900 12345\n`);
  }

  remove(): void {
    rmSync(this.dir, { recursive: true, force: true });
  }
}

interface HostShape {
  loadavgPath: string;
  cores: number;
  maxWaitSeconds?: number;
}

function hostEnv(host: HostShape): NodeJS.ProcessEnv {
  return {
    ...process.env,
    BIAC_LOADAVG_FILE: host.loadavgPath,
    BIAC_NPROC: String(host.cores),
    BIAC_GATE_POLL_SECONDS: "0.2",
    BIAC_GATE_MAX_WAIT_SECONDS: String(host.maxWaitSeconds ?? 10),
  };
}

function waitForHost(host: HostShape) {
  return spawnSync(SCRIPT, [], { encoding: "utf8", env: hostEnv(host) });
}

describe("wait-for-host.sh", () => {
  let loadavg: FakeLoadavg;

  beforeEach(() => {
    loadavg = new FakeLoadavg();
  });

  afterEach(() => {
    loadavg.remove();
  });

  describe("a host at or under its core count", () => {
    it.each(["3.50", "8.00"])(
      "starts at once at load %s on 8 cores",
      (load) => {
        loadavg.write(load);

        const result = waitForHost({ loadavgPath: loadavg.path, cores: 8 });

        expect(result.status).toBe(0);
        expect(result.stdout + result.stderr).toBe("");
      },
    );
  });

  describe("a host above its core count", () => {
    it("gives up after the maximum wait, printing the readings", () => {
      loadavg.write("12.31");

      const result = waitForHost({
        loadavgPath: loadavg.path,
        cores: 8,
        maxWaitSeconds: 1,
      });

      expect(result.status).toBe(75);
      expect(result.stdout).toContain(
        "gate: waiting — 1 min load 12.31 on 8 cores",
      );
      expect(result.stderr).toContain("1 min load 12.31 on 8 cores");
      expect(result.stderr).toContain("after 1s");
    });

    it("starts once the load drops to the core count", async () => {
      loadavg.write("12.31");
      const child = spawn(SCRIPT, [], {
        env: hostEnv({ loadavgPath: loadavg.path, cores: 8 }),
      });
      let stdout = "";

      const status = await new Promise<number | null>((resolve, reject) => {
        child.on("error", reject);
        child.stdout.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
          if (stdout.includes("gate: waiting")) loadavg.write("7.90");
        });
        child.on("close", resolve);
      });

      expect(status).toBe(0);
      expect(stdout.match(/gate: waiting/g)).toHaveLength(1);
      expect(stdout).toContain("gate: host ready after");
    });
  });

  describe("an unreadable load reading", () => {
    it("rejects it, naming the value and the expected shape", () => {
      loadavg.write("busy");

      const result = waitForHost({ loadavgPath: loadavg.path, cores: 8 });

      expect(result.status).toBe(64);
      expect(result.stderr).toContain('"busy');
      expect(result.stderr).toContain("<load1> <load5> <load15>");
    });
  });
});
