import { createReadStream } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { relative, sep } from "node:path";
import type { Connect } from "vite";
import { decodePathname, resolveContained } from "./contained-path.js";
import { dataMediaType } from "./data-media-type.js";
import {
  DataLoaderFailure,
  findDataLoader,
  isDataLoaderSource,
  type DataLoaderCache,
} from "./data-loader.js";
import { statFile } from "./stat-file.js";
import type { DataLoaderInterpreters } from "./types.js";

/**
 * Serves the project's `data/` directory over HTTP for DuckDB-WASM, which
 * fetches every `sql:` source through `registerFileURL`. Mounting the real
 * directory at `/data/` keeps the dev URL identical to the `build/data/`
 * copy `biac build` emits, so page SQL never rewrites between modes.
 * Byte ranges are honored because the wasm HTTP filesystem reads parquet
 * footers with ranged GETs; `no-cache` keeps edits visible on refetch.
 * A path with no file but a loader beside it (`<path><ext>` for any
 * extension in `interpreters`) serves the loader's cached output; loader
 * sources themselves are never served. A failing loader — non-zero exit,
 * interpreter not on `PATH`, or a second loader for the same path —
 * answers a plain-text `500` carrying its error, the only place a page can
 * read why: DuckDB's HTTP reader drops response bodies. The interpreter
 * table is resolved on every request, so an edited `interpreters` map in
 * `biac.config.ts` applies without a restart.
 *
 * @example
 * server.middlewares.use(
 *   "/data",
 *   serveDataDir(
 *     join(root, "data"),
 *     createDataLoaderCache(root, log),
 *     async () => DEFAULT_INTERPRETERS,
 *   ),
 * );
 */
export function serveDataDir(
  dataDir: string,
  loaders: DataLoaderCache,
  currentInterpreters: () => Promise<DataLoaderInterpreters>,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    const pathname = decodePathname(req.url);
    if (pathname === null) return writeStatus(res, 400);
    const file = resolveContained(dataDir, pathname);
    if (file === null) return writeStatus(res, 403);
    currentInterpreters()
      .then((interpreters) =>
        serveDataFile(req, res, { dataDir, loaders, interpreters }, file),
      )
      .catch(next);
  };
}

/** Where `serveDataDir` finds and runs loaders. */
interface DataDirLoaders {
  dataDir: string;
  loaders: DataLoaderCache;
  interpreters: DataLoaderInterpreters;
}

/**
 * Serves `file` when it is data, its loader's output when only a loader
 * generates it, and `404` for a loader source.
 */
async function serveDataFile(
  req: IncomingMessage,
  res: ServerResponse,
  context: DataDirLoaders,
  file: string,
): Promise<void> {
  if (isDataLoaderSource(file, context.interpreters)) {
    return writeStatus(res, 404);
  }
  const stats = statFile(file);
  if (stats !== null) return sendFile(req, res, file, stats.size);
  const target = relative(context.dataDir, file).split(sep).join("/");
  await sendLoaderOutput(req, res, context, target);
}

/**
 * Runs the target's loader if its cached output is stale, then serves it;
 * `404` when no loader generates the target.
 */
async function sendLoaderOutput(
  req: IncomingMessage,
  res: ServerResponse,
  { dataDir, loaders, interpreters }: DataDirLoaders,
  target: string,
): Promise<void> {
  let output: string;
  try {
    if (findDataLoader(dataDir, target, interpreters) === null) {
      return writeStatus(res, 404);
    }
    output = await loaders.load(target, interpreters);
  } catch (error) {
    if (!(error instanceof DataLoaderFailure)) throw error;
    sendLoaderFailure(res, error);
    return;
  }
  // load() resolves only after the output was renamed into place.
  sendFile(req, res, output, statFile(output)!.size);
}

/**
 * Answered here rather than passed to `next`, so vite neither logs the
 * stack (the loader cache already logged the failure) nor opens its error
 * overlay over pages that may not query this file.
 */
function sendLoaderFailure(
  res: ServerResponse,
  error: DataLoaderFailure,
): void {
  res.writeHead(500, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  res.end(error.message);
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
    "Content-Type": dataMediaType(file),
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
