import { describe, expect, it } from "vitest";
import { rewriteUntilServerLogs } from "../lib/write-until-logged.js";

/**
 * A dev server's log that acknowledges a write only on the `acknowledgeOn`th
 * rewrite — the stand-in for a watcher that misses a write it has not yet
 * started watching.
 */
class FakeServerLog {
  readonly lines: string[] = [];
  rewrites = 0;

  constructor(
    private readonly acknowledgeOn: number,
    private readonly acknowledgment: string,
  ) {}

  rewrite = (): void => {
    this.rewrites++;
    if (this.rewrites === this.acknowledgeOn) {
      this.lines.push(this.acknowledgment);
    }
  };

  log = (): readonly string[] => this.lines;
}

const CONFIG_RELOAD =
  "2026-10-15T10:00:00.000Z stdout 10:00:00 AM [vite] (client) page reload /tmp/biac-x/biac.config.ts";

function rewriteConfig(serverLog: FakeServerLog, timeoutMs = 1_000) {
  return rewriteUntilServerLogs({
    rewrite: serverLog.rewrite,
    log: serverLog.log,
    loggedPath: "biac.config.ts",
    attemptMs: 100,
    timeoutMs,
  });
}

describe("rewriteUntilServerLogs", () => {
  it("returns the first acknowledgment and never rewrites after it", async () => {
    const serverLog = new FakeServerLog(1, CONFIG_RELOAD);

    const line = await rewriteConfig(serverLog);

    expect(line).toBe(CONFIG_RELOAD);
    expect(serverLog.rewrites).toBe(1);
  });

  it("rewrites again when an attempt sees no acknowledgment", async () => {
    const serverLog = new FakeServerLog(3, CONFIG_RELOAD);

    const line = await rewriteConfig(serverLog);

    expect(line).toBe(CONFIG_RELOAD);
    expect(serverLog.rewrites).toBe(3);
  });

  it("accepts an hmr update naming the module that accepts the write", async () => {
    const update = "t stdout [vite] (client) hmr update \0virtual:biac-pages";
    const serverLog = new FakeServerLog(1, update);

    const line = await rewriteUntilServerLogs({
      rewrite: serverLog.rewrite,
      log: serverLog.log,
      loggedPath: "\0virtual:biac-pages",
      attemptMs: 100,
      timeoutMs: 1_000,
    });

    expect(line).toBe(update);
  });

  it("ignores an acknowledgment logged before the call", async () => {
    const serverLog = new FakeServerLog(2, CONFIG_RELOAD);
    serverLog.lines.push(CONFIG_RELOAD);

    await rewriteConfig(serverLog);

    expect(serverLog.rewrites).toBe(2);
  });

  it("ignores a reload naming another file", async () => {
    const serverLog = new FakeServerLog(
      1,
      "t stdout page reload my-biac.config.ts.bak",
    );

    const failure = rewriteConfig(serverLog, 300);

    await expect(failure).rejects.toThrow(/biac\.config\.ts/);
  });

  it("names the file, the expected line and the log tail on timeout", async () => {
    const serverLog = new FakeServerLog(0, CONFIG_RELOAD);
    serverLog.lines.push("t stdout ready in 812 ms");

    const failure = rewriteConfig(serverLog, 300);

    await expect(failure).rejects.toThrow(
      /biac\.config\.ts[\s\S]*page reload\|hmr update[\s\S]*ready in 812 ms/,
    );
  });
});
