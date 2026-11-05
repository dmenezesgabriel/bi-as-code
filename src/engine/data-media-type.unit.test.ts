import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { dataMediaType, dataMediaTypeMiddleware } from "./data-media-type.js";

/** Records the headers a middleware sets, as a node response would hold them. */
class RecordingResponse {
  readonly headers = new Map<string, string>();

  setHeader(name: string, value: string): this {
    this.headers.set(name, value);
    return this;
  }
}

afterEach(() => cleanupProjects());

function runMiddleware(
  dataDir: string,
  request: { method: string; url: string },
): { headers: Map<string, string>; nextCalls: number } {
  const response = new RecordingResponse();
  let nextCalls = 0;
  dataMediaTypeMiddleware(dataDir)(
    request as IncomingMessage,
    response as unknown as ServerResponse,
    () => (nextCalls += 1),
  );
  return { headers: response.headers, nextCalls };
}

function makeDataDir(): string {
  const root = makeTempProject();
  writeProjectFile(root, "data/sub/orders.parquet", "PAR1");
  writeProjectFile(root, "outside.parquet", "PAR1");
  return join(root, "data");
}

describe("dataMediaType", () => {
  it.each([
    ["orders.csv", "text/csv"],
    ["orders.tsv", "text/tab-separated-values"],
    ["orders.json", "application/json"],
    ["orders.parquet", "application/vnd.apache.parquet"],
    ["orders.arrow", "application/vnd.apache.arrow.file"],
    ["editor.png", "image/png"],
    ["photo.jpg", "image/jpeg"],
    ["photo.jpeg", "image/jpeg"],
    ["loop.gif", "image/gif"],
    ["hero.webp", "image/webp"],
    ["logo.svg", "image/svg+xml"],
  ])("types %s as %s", (file, expected) => {
    const type = dataMediaType(file);

    expect(type).toBe(expected);
  });

  it("matches the extension regardless of case", () => {
    const type = dataMediaType("/site/data/ORDERS.PARQUET");

    expect(type).toBe("application/vnd.apache.parquet");
  });

  it("falls back to an opaque byte stream for any other extension", () => {
    const type = dataMediaType("/site/data/orders.xlsx");

    expect(type).toBe("application/octet-stream");
  });
});

describe("dataMediaTypeMiddleware", () => {
  it("types an existing file and passes the request on", () => {
    const dataDir = makeDataDir();

    const { headers, nextCalls } = runMiddleware(dataDir, {
      method: "GET",
      url: "/sub/orders.parquet?v=1",
    });

    expect(headers.get("Content-Type")).toBe("application/vnd.apache.parquet");
    expect(nextCalls).toBe(1);
  });

  it("types a HEAD request too", () => {
    const dataDir = makeDataDir();

    const { headers } = runMiddleware(dataDir, {
      method: "HEAD",
      url: "/sub/orders.parquet",
    });

    expect(headers.get("Content-Type")).toBe("application/vnd.apache.parquet");
  });

  it.each([
    ["a missing file", "GET", "/nope.parquet"],
    ["a directory", "GET", "/sub"],
    ["a path escaping the data directory", "GET", "/../outside.parquet"],
    ["a malformed escape", "GET", "/%zz.parquet"],
    ["a POST", "POST", "/sub/orders.parquet"],
  ])("leaves %s untyped and passes it on", (_case, method, url) => {
    const dataDir = makeDataDir();

    const { headers, nextCalls } = runMiddleware(dataDir, { method, url });

    expect(headers.size).toBe(0);
    expect(nextCalls).toBe(1);
  });
});
