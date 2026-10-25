import type { IncomingMessage, ServerResponse } from "node:http";
import { describe, expect, it } from "vitest";
import {
  IMMUTABLE_ASSET_CACHE_CONTROL,
  SERVE_HEADERS,
  serveHeadersMiddleware,
} from "./serve-headers.js";

/** Records the headers a middleware sets, as a node response would hold them. */
class RecordingResponse {
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

function runMiddleware(
  base: string,
  url: string,
  method = "GET",
): { headers: Map<string, string>; nextCalls: unknown[][] } {
  const response = new RecordingResponse();
  const nextCalls: unknown[][] = [];
  serveHeadersMiddleware(base)(
    { url, method } as IncomingMessage,
    response as unknown as ServerResponse,
    (...args: unknown[]) => {
      nextCalls.push(args);
    },
  );
  return { headers: response.headers, nextCalls };
}

describe("SERVE_HEADERS", () => {
  it("forbids content sniffing and referrer leaks", () => {
    expect(SERVE_HEADERS).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
  });
});

describe("serveHeadersMiddleware", () => {
  it.each(["/", "/orders/", "/data/orders.parquet"])(
    "sets the hardened headers on %s",
    (url) => {
      const { headers } = runMiddleware("/", url);

      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headers.get("Referrer-Policy")).toBe("no-referrer");
    },
  );

  it("sets the hardened headers on methods other than GET and HEAD", () => {
    const { headers } = runMiddleware("/", "/orders/", "POST");

    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it.each([
    ["/", "/assets/app-abc.js"],
    ["/", "/assets/app-abc.js?v=1"],
    ["/bi-as-code/", "/bi-as-code/assets/app-abc.js"],
  ])("caches assets immutably at base %s for %s", (base, url) => {
    const { headers } = runMiddleware(base, url);

    expect(headers.get("Cache-Control")).toBe(IMMUTABLE_ASSET_CACHE_CONTROL);
  });

  it("caches assets immutably on HEAD", () => {
    const { headers } = runMiddleware("/", "/assets/app-abc.js", "HEAD");

    expect(headers.get("Cache-Control")).toBe(IMMUTABLE_ASSET_CACHE_CONTROL);
  });

  it.each([
    ["/", "/data/orders.parquet", "GET"],
    ["/", "/index.html", "GET"],
    ["/", "/assets", "GET"],
    ["/", "/other/assets/app-abc.js", "GET"],
    ["/bi-as-code/", "/assets/app-abc.js", "GET"],
    ["/", "/assets/app-abc.js", "POST"],
  ])("leaves caching alone at base %s for %s %s", (base, url, method) => {
    const { headers } = runMiddleware(base, url, method);

    expect(headers.has("Cache-Control")).toBe(false);
  });

  it("passes the request on exactly once", () => {
    const { nextCalls } = runMiddleware("/", "/assets/app-abc.js");

    expect(nextCalls).toEqual([[]]);
  });
});
