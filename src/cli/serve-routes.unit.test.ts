import type { IncomingMessage, ServerResponse } from "node:http";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { serveRoutesMiddleware } from "./serve-routes.js";

const NOT_FOUND_PAGE = "<!doctype html><title>Not found</title>";

/** Records what a middleware writes, as a node response would hold it. */
class RecordingResponse {
  statusCode = 200;
  readonly headers = new Map<string, string>();
  body: string | undefined;

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }

  end(body?: string): this {
    this.body = body ?? "";
    return this;
  }
}

interface Outcome {
  response: RecordingResponse;
  nextCalls: unknown[][];
}

let outDir: string;

beforeEach(() => {
  outDir = mkdtempSync(join(tmpdir(), "biac-serve-routes-"));
  mkdirSync(join(outDir, "nested", "allocation"), { recursive: true });
  writeFileSync(join(outDir, "nested", "allocation", "index.html"), "page");
  writeFileSync(join(outDir, "404.html"), NOT_FOUND_PAGE);
});

afterEach(() => rmSync(outDir, { recursive: true, force: true }));

function run(url: string, method = "GET"): Outcome {
  const response = new RecordingResponse();
  const nextCalls: unknown[][] = [];
  serveRoutesMiddleware(outDir)(
    { url, method } as IncomingMessage,
    response as unknown as ServerResponse,
    (...args: unknown[]) => {
      nextCalls.push(args);
    },
  );
  return { response, nextCalls };
}

describe("serveRoutesMiddleware", () => {
  it("redirects a route directory without its slash, keeping the query", () => {
    const { response, nextCalls } = run("/nested/allocation?region=EU");

    expect(response.statusCode).toBe(301);
    expect(response.headers.get("Location")).toBe(
      "/nested/allocation/?region=EU",
    );
    expect(nextCalls).toEqual([]);
  });

  it("passes a route's rewritten index.html on to vite to serve", () => {
    const { response, nextCalls } = run("/nested/allocation/index.html");

    expect(nextCalls).toHaveLength(1);
    expect(response.body).toBeUndefined();
  });

  it("answers an unmatched GET with 404 and the build's 404.html", () => {
    const { response } = run("/nope");

    expect(response.statusCode).toBe(404);
    expect(response.headers.get("Content-Type")).toBe(
      "text/html; charset=utf-8",
    );
    expect(response.body).toBe(NOT_FOUND_PAGE);
  });

  it("answers an unmatched data path with 404, not the shell", () => {
    const { response } = run("/data/nope.parquet");

    expect(response.statusCode).toBe(404);
  });

  it("answers an unmatched HEAD with 404 and no body", () => {
    const { response } = run("/nope", "HEAD");

    expect(response.statusCode).toBe(404);
    expect(response.body).toBe("");
  });

  it("leaves methods other than GET and HEAD to the next handler", () => {
    const { response, nextCalls } = run("/nope", "POST");

    expect(nextCalls).toHaveLength(1);
    expect(response.body).toBeUndefined();
  });

  it("never redirects a path that escapes the build directory", () => {
    const { response } = run("/%2e%2e/%2e%2e/etc");

    expect(response.statusCode).toBe(404);
    expect(response.headers.get("Location")).toBeUndefined();
  });

  it("falls through to the next handler when the build has no 404.html", () => {
    rmSync(join(outDir, "404.html"));

    const { nextCalls } = run("/nope");

    expect(nextCalls).toHaveLength(1);
  });
});
