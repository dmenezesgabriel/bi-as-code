import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  frameAncestorsHeaders,
  frameAncestorsMiddleware,
} from "./frame-ancestors.js";

/** Records the headers a middleware sets, as a node response would hold them. */
class RecordingResponse {
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

async function runMiddleware(
  getOrigins: () => Promise<readonly string[]>,
): Promise<{ headers: Map<string, string>; nextCalls: unknown[][] }> {
  const response = new RecordingResponse();
  const nextCalls: unknown[][] = [];
  await new Promise<void>((resolve) => {
    frameAncestorsMiddleware(getOrigins)(
      {} as IncomingMessage,
      response as unknown as ServerResponse,
      (...args: unknown[]) => {
        nextCalls.push(args);
        resolve();
      },
    );
  });
  return { headers: response.headers, nextCalls };
}

describe("frameAncestorsHeaders", () => {
  it("denies every framer when no origin is listed", () => {
    const headers = frameAncestorsHeaders([]);

    expect(headers).toEqual({
      "Content-Security-Policy": "frame-ancestors 'none'",
      "X-Frame-Options": "DENY",
    });
  });

  it("allows exactly the listed origins, without 'self'", () => {
    const headers = frameAncestorsHeaders([
      "https://example.com",
      "http://localhost:8901",
    ]);

    expect(headers).toEqual({
      "Content-Security-Policy":
        "frame-ancestors https://example.com http://localhost:8901",
      "X-Frame-Options": "DENY",
    });
  });
});

describe("frameAncestorsMiddleware", () => {
  it("sets the policy for the current origins, then passes the request on", async () => {
    const { headers, nextCalls } = await runMiddleware(async () => [
      "https://example.com",
    ]);

    expect(Object.fromEntries(headers)).toEqual(
      frameAncestorsHeaders(["https://example.com"]),
    );
    expect(nextCalls).toEqual([[]]);
  });

  it("denies framing while the config fails to load, and passes the request on", async () => {
    const { headers, nextCalls } = await runMiddleware(() =>
      Promise.reject(new Error("Invalid biac.config.ts")),
    );

    expect(Object.fromEntries(headers)).toEqual(frameAncestorsHeaders([]));
    expect(nextCalls).toEqual([[]]);
  });
});
