import { extname } from "node:path";
import type { Connect } from "vite";
import { decodePathname, resolveContained } from "./contained-path.js";
import { statFile } from "./stat-file.js";

/**
 * The formats a page reads from `/data/`, by extension. A table of our own
 * rather than a `mime` dependency: it is a handful of entries, and vite
 * preview's built-in table (sirv's) has neither parquet nor arrow.
 * Registered types: https://www.iana.org/assignments/media-types/application/vnd.apache.parquet,
 * https://www.iana.org/assignments/media-types/application/vnd.apache.arrow.file.
 */
const DATA_MEDIA_TYPES: Readonly<Record<string, string>> = {
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".json": "application/json",
  ".parquet": "application/vnd.apache.parquet",
  ".arrow": "application/vnd.apache.arrow.file",
};

/**
 * The media type a data file is served with, by its extension; any other
 * file is an opaque byte stream.
 *
 * @example
 * dataMediaType("/site/data/orders.parquet"); // → "application/vnd.apache.parquet"
 */
export function dataMediaType(file: string): string {
  return (
    DATA_MEDIA_TYPES[extname(file).toLowerCase()] ?? "application/octet-stream"
  );
}

/**
 * Sets `dataMediaType` on GET and HEAD requests for a file that exists in
 * `dataDir`, then passes every request on. Mounted ahead of vite preview's
 * static server, which keeps a `Content-Type` already set on the response
 * (sirv's `send` reads `res.getHeader("content-type")`). A missing path is
 * left untyped, because it falls through to the SPA shell.
 *
 * @example
 * server.middlewares.use("/data", dataMediaTypeMiddleware(join(outDir, "data")));
 */
export function dataMediaTypeMiddleware(
  dataDir: string,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    const file = existingDataFile(dataDir, req.method, req.url);
    if (file !== null) res.setHeader("Content-Type", dataMediaType(file));
    next();
  };
}

/** The file a GET or HEAD for `url` reads inside `dataDir`, or `null`. */
function existingDataFile(
  dataDir: string,
  method: string | undefined,
  url: string | undefined,
): string | null {
  if (method !== "GET" && method !== "HEAD") return null;
  const pathname = decodePathname(url);
  if (pathname === null) return null;
  const file = resolveContained(dataDir, pathname);
  if (file === null || statFile(file) === null) return null;
  return file;
}
