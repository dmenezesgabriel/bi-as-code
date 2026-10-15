import { createServer, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyHang,
  formatBlankPageReport,
  probeRequest,
  type RequestProbe,
} from "../lib/request-probe.js";

/**
 * A dev server stand-in that answers `/ok` and never answers `/stall` — the
 * two behaviours a re-request of an unanswered URL has to tell apart.
 */
class FakeStallingServer {
  private readonly server: Server;
  private readonly held: ServerResponse[] = [];

  constructor() {
    this.server = createServer((request, response) => {
      if (request.url === "/stall") return void this.held.push(response);
      response.end("export {};");
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((done) => this.server.listen(0, done));
    return `http://localhost:${(this.server.address() as AddressInfo).port}`;
  }

  async close(): Promise<void> {
    for (const response of this.held) response.destroy();
    this.server.closeAllConnections();
    await new Promise((done) => this.server.close(done));
  }
}

const answered: RequestProbe = {
  url: "http://localhost:5173/src/main.tsx",
  verdict: "answered",
  status: 200,
  latencyMs: 12,
};
const hung: RequestProbe = {
  url: "http://localhost:5173/src/features/data/run-query.ts",
  verdict: "hung",
  latencyMs: 500,
};

describe("probeRequest", () => {
  let server: FakeStallingServer;
  let base: string;

  beforeEach(async () => {
    server = new FakeStallingServer();
    base = await server.listen();
  });

  afterEach(async () => {
    await server.close();
  });

  it("reports an answered URL with its status", async () => {
    const probe = await probeRequest(`${base}/ok`, 2_000);

    expect(probe).toMatchObject({ verdict: "answered", status: 200 });
    expect(probe.latencyMs).toBeLessThan(2_000);
  });

  it("reports a URL the server never answers as hung at the timeout", async () => {
    const probe = await probeRequest(`${base}/stall`, 300);

    expect(probe.verdict).toBe("hung");
    expect(probe.latencyMs).toBeGreaterThanOrEqual(300);
  });

  it("reports a refused connection as an error with its message", async () => {
    await server.close();

    const probe = await probeRequest(`${base}/ok`, 2_000);

    expect(probe.verdict).toBe("error");
    expect(probe.error).toMatch(/fetch failed/);
  });
});

describe("classifyHang", () => {
  it("puts the hang in the browser when the server answers every URL", () => {
    expect(classifyHang([answered])).toMatch(/browser side/);
  });

  it("names every URL the server is stuck on", () => {
    const verdict = classifyHang([answered, hung]);

    expect(verdict).toMatch(/server side: stuck on 1 of 2/);
    expect(verdict).toContain(hung.url);
    expect(verdict).not.toContain(answered.url);
  });

  it("says a blank page with no pending request is not a hang", () => {
    expect(classifyHang([])).toMatch(/no request was pending/);
  });
});

describe("formatBlankPageReport", () => {
  it("lists each unanswered URL with its start time, its age, its re-request and the server log", () => {
    const startedAt = Date.parse("2026-10-14T10:00:00.000Z");

    const report = formatBlankPageReport({
      unanswered: [
        { url: answered.url, startedAt },
        { url: hung.url, startedAt },
      ],
      probes: [answered, hung],
      failed: [],
      takenAt: startedAt + 1_300,
      pageErrors: [],
      serverLog: [
        "2026-10-14T10:00:00.100Z stderr vite:time 3ms /src/main.tsx",
      ],
    });

    expect(report).toContain(
      `2026-10-14T10:00:00.000Z pending 1300 ms ${answered.url} → 200 in 12 ms`,
    );
    expect(report).toContain(`${hung.url} → no answer in 500 ms`);
    expect(report).toMatch(/Verdict: server side/);
    expect(report).toContain("vite:time 3ms /src/main.tsx");
  });

  it("lists the page's errors, so a blank page with nothing pending still says why", () => {
    const report = formatBlankPageReport({
      unanswered: [],
      probes: [],
      failed: [],
      takenAt: 0,
      pageErrors: [
        "TypeError: Cannot read properties of undefined (reading 'x')",
      ],
      serverLog: [],
    });

    expect(report).toMatch(/no request was pending/);
    expect(report).toContain(
      "Page errors (1):\nTypeError: Cannot read properties of undefined (reading 'x')",
    );
  });

  it("lists each failed request with Chrome's reason — a module graph it breaks never mounts", () => {
    const startedAt = Date.parse("2026-10-14T10:00:00.000Z");

    const report = formatBlankPageReport({
      unanswered: [],
      probes: [],
      failed: [
        { url: hung.url, startedAt, failure: "net::ERR_CONNECTION_RESET" },
      ],
      takenAt: startedAt,
      pageErrors: [],
      serverLog: [],
    });

    expect(report).toContain(
      `Failed requests (1):\n2026-10-14T10:00:00.000Z ${hung.url} — net::ERR_CONNECTION_RESET`,
    );
  });
});
