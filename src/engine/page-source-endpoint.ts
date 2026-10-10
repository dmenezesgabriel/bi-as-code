import { randomUUID } from "node:crypto";
import { statSync } from "node:fs";
import { readFile, rename, rm, writeFile } from "node:fs/promises";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from "node:http";
import { basename, dirname, extname, join } from "node:path";
import type { Connect } from "vite";
import { decodePathname, resolveContained } from "./contained-path.js";

const PAGE_EXTENSIONS = new Set([".md", ".mdx"]);
// Far above any real page (the shipped example's largest is ~10 KB) while
// still bounding what one request can make the dev server buffer.
const MAX_SOURCE_BYTES = 1024 * 1024;

/**
 * Dev-only read/write access to page source under `pages/`, for the
 * in-browser editor: `GET /<path>` returns a page's bytes, `PUT /<path>` with
 * a JSON `{ "source": string }` body replaces it. Only existing `.md`/`.mdx`
 * files are reachable — no create, no other files.
 *
 * Because this is a write path on a localhost port, any page the author has
 * open could aim requests at it, so it accepts same-origin requests only:
 * vite's default CORS allows every `localhost` origin (any port), so an
 * `Origin` whose host differs from `Host` is rejected, as is any
 * `Sec-Fetch-Site` other than `same-origin`/`none` (a sibling localhost port
 * is `same-site`). Requiring `application/json` forces a CORS preflight, so a
 * cross-site form or `no-cors` fetch can never write. Writes go to a temp
 * file renamed over the page, so the file watcher never sees a half-written
 * or empty page.
 *
 * @example
 * server.middlewares.use("/__biac/page-source", pageSourceEndpoint(pagesDir));
 */
export function pageSourceEndpoint(
  pagesDir: string,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    respondWithPageSource(pagesDir, req, res).catch(next);
  };
}

async function respondWithPageSource(
  pagesDir: string,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "PUT") {
    return writeStatus(res, 405, { Allow: "GET, PUT" });
  }
  if (isCrossOriginRequest(req.headers)) return writeStatus(res, 403);
  const file = resolvePageFile(pagesDir, req.url);
  if (typeof file === "number") return writeStatus(res, file);
  if (req.method === "GET") return sendPageSource(res, file);
  await savePageSource(req, res, file);
}

async function sendPageSource(res: ServerResponse, file: string) {
  const bytes = await readFile(file);
  res.writeHead(200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Length": bytes.length,
    "Cache-Control": "no-cache",
  });
  res.end(bytes);
}

async function savePageSource(
  req: IncomingMessage,
  res: ServerResponse,
  file: string,
): Promise<void> {
  if (!isJsonContentType(req.headers["content-type"])) {
    return writeStatus(res, 415);
  }
  const body = await readBodyCapped(req, MAX_SOURCE_BYTES);
  if (body === 413) return writeStatus(res, 413);
  const source = parseSourceBody(body);
  if (source === 400) return writeStatus(res, 400);
  await writePageAtomically(file, source);
  writeStatus(res, 204);
}

/**
 * Maps a request URL (relative to the endpoint mount) to an existing page
 * file under `pagesDir`, or the status that refuses it: 400 malformed
 * escape, 403 path escaping `pagesDir`, 404 not an existing `.md`/`.mdx`
 * file. Extensions match case-sensitively, like page discovery.
 *
 * @example
 * resolvePageFile("/site/pages", "/weekly.md"); // → "/site/pages/weekly.md"
 * resolvePageFile("/site/pages", "/..%2Fx.md"); // → 403
 */
export function resolvePageFile(
  pagesDir: string,
  url: string | undefined,
): string | 400 | 403 | 404 {
  const pathname = decodePathname(url);
  if (pathname === null) return 400;
  const file = resolveContained(pagesDir, pathname);
  if (file === null) return 403;
  if (!PAGE_EXTENSIONS.has(extname(file))) return 404;
  return isRegularFile(file) ? file : 404;
}

function isRegularFile(file: string): boolean {
  try {
    return statSync(file).isFile();
  } catch {
    return false;
  }
}

/**
 * True when the browser says the request did not come from the dev server's
 * own origin. Requests without `Origin` and `Sec-Fetch-Site` (curl, a typed
 * URL) pass — only a browser can carry another site's ambient authority.
 *
 * @example
 * isCrossOriginRequest({ host: "localhost:5175", origin: "http://localhost:3000" }); // → true
 */
export function isCrossOriginRequest(headers: IncomingHttpHeaders): boolean {
  const site = headers["sec-fetch-site"];
  if (site !== undefined && site !== "same-origin" && site !== "none") {
    return true;
  }
  if (headers.origin === undefined) return false;
  return originHost(headers.origin) !== headers.host;
}

/** `null` for an opaque or malformed origin (`null`, `file://`) — never same-origin. */
function originHost(origin: string): string | null {
  try {
    return new URL(origin).host || null;
  } catch {
    return null;
  }
}

function isJsonContentType(contentType: string | undefined): boolean {
  const mediaType = (contentType ?? "").split(";", 1)[0]!.trim();
  return mediaType.toLowerCase() === "application/json";
}

/**
 * Reads a whole request body as UTF-8, or 413 once it passes `limitBytes`.
 * An oversized body is still drained (not buffered) so the 413 reply goes
 * out on a healthy socket instead of a reset connection.
 *
 * @example
 * await readBodyCapped(req, 1024 * 1024); // → '{"source":"# Hi"}'
 */
export async function readBodyCapped(
  body: AsyncIterable<Buffer>,
  limitBytes: number,
): Promise<string | 413> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of body) {
    size += chunk.length;
    if (size <= limitBytes) chunks.push(chunk);
  }
  if (size > limitBytes) return 413;
  return Buffer.concat(chunks).toString("utf8");
}

/**
 * The `source` string of a `{ "source": string }` JSON body, or 400 for
 * malformed JSON or any other shape.
 *
 * @example
 * parseSourceBody('{"source":"# Hi"}'); // → "# Hi"
 */
export function parseSourceBody(text: string): string | 400 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return 400;
  }
  if (typeof parsed !== "object" || parsed === null) return 400;
  const { source } = parsed as { source?: unknown };
  return typeof source === "string" ? source : 400;
}

/**
 * Replaces `file` with `source` via a sibling temp file and `rename`, so a
 * watcher sees one change event and never a truncated page. The temp name
 * is dot-prefixed and ends in `.tmp`, so page discovery never lists it.
 *
 * @example
 * await writePageAtomically("/site/pages/weekly.md", "# Weekly\n");
 */
export async function writePageAtomically(
  file: string,
  source: string,
): Promise<void> {
  const temp = join(dirname(file), `.${basename(file)}.${randomUUID()}.tmp`);
  try {
    await writeFile(temp, source);
    await rename(temp, file);
  } catch (error) {
    await rm(temp, { force: true });
    throw error;
  }
}

function writeStatus(
  res: ServerResponse,
  status: number,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, headers).end();
}
