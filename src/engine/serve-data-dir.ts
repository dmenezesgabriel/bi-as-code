import { createReadStream, statSync, type Stats } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extname } from "node:path";
import type { Connect } from "vite";
import { decodePathname, resolveContained } from "./contained-path.js";

const CONTENT_TYPES: Record<string, string> = {
  ".csv": "text/csv",
  ".json": "application/json",
};

/**
 * Serves the project's `data/` directory over HTTP for DuckDB-WASM, which
 * fetches every `sql:` source through `registerFileURL`. Mounting the real
 * directory at `/data/` keeps the dev URL identical to the `build/data/`
 * copy `biac build` emits, so page SQL never rewrites between modes.
 * Byte ranges are honored because the wasm HTTP filesystem reads parquet
 * footers with ranged GETs; `no-cache` keeps edits visible on refetch.
 *
 * @example
 * server.middlewares.use("/data", serveDataDir(join(root, "data")));
 */
export function serveDataDir(dataDir: string): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = decodePathname(req.url);
    if (pathname === null) return writeStatus(res, 400);
    const file = resolveContained(dataDir, pathname);
    if (file === null) return writeStatus(res, 403);
    const stats = statFile(file);
    if (stats === null) return writeStatus(res, 404);
    sendFile(req, res, file, stats.size);
  };
}

/** `null` covers missing entries and directories alike — both are 404 here. */
function statFile(file: string): Stats | null {
  try {
    const stats = statSync(file);
    return stats.isFile() ? stats : null;
  } catch {
    return null;
  }
}

interface ByteRange {
  start: number;
  end: number;
}

/** `null` when the header is absent or malformed — malformed means "ignore it", not 400. */
function parseRange(
  header: string | undefined,
  size: number,
): ByteRange | "unsatisfiable" | null {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header ?? "");
  if (!match || (match[1] === "" && match[2] === "")) return null;
  const start =
    match[1] === "" ? Math.max(size - Number(match[2]), 0) : Number(match[1]);
  const end =
    match[1] === "" || match[2] === ""
      ? size - 1
      : Math.min(Number(match[2]), size - 1);
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

function sendFile(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
  size: number,
): void {
  const range = parseRange(req.headers.range, size);
  if (range === "unsatisfiable") {
    res.writeHead(416, { "Content-Range": `bytes */${size}` });
    res.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  res.writeHead(range === null ? 200 : 206, {
    "Content-Type":
      CONTENT_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream",
    "Content-Length": end - start + 1,
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    ...(range === null
      ? {}
      : { "Content-Range": `bytes ${start}-${end}/${size}` }),
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  // Ranged and plain reads stream through the same path; a zero-byte file
  // still reaches here unranged, where start/end options are skipped —
  // `end: -1` is out of range for createReadStream.
  const options = range === null ? {} : { start, end };
  createReadStream(file, options)
    .on("error", () => res.destroy())
    .pipe(res);
}

function writeStatus(res: ServerResponse, status: number): void {
  res.writeHead(status).end();
}
