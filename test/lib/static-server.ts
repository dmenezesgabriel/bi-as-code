import { createReadStream, statSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from "node:http";
import type { AddressInfo } from "node:net";
import { extname, join, resolve, sep } from "node:path";

export interface StaticDir {
  /** The server's origin, e.g. "http://127.0.0.1:50123". */
  url: string;
  /** Stops listening and drops every open keep-alive socket. */
  close(): Promise<void>;
}

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".csv": "text/csv",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".parquet": "application/vnd.apache.parquet",
  ".svg": "image/svg+xml",
  ".wasm": "application/wasm",
};

/**
 * A plain static file server over `rootDir` on an ephemeral loopback port —
 * the stand-in for a host with no rewrite rules (S3 website endpoints,
 * GitHub Pages, `python3 -m http.server`): directory URLs 301 to their
 * trailing slash and answer `index.html`, everything else is a file or a
 * 404. There is no SPA fallback, no directory listing and no CORS header:
 * what a spec cannot reach here, no static host would serve. Range and
 * HEAD requests are honoured because duckdb-wasm reads parquet by range.
 *
 * @example
 * const staticHost = await serveStaticDir(join(projectDir, "build"));
 * await page.goto(`${staticHost.url}/weekly-review`);
 * await staticHost.close();
 */
export async function serveStaticDir(rootDir: string): Promise<StaticDir> {
  const root = resolve(rootDir);
  const server = createServer((request, response) =>
    respond(root, request, response),
  );
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    close: () => closeServer(server),
  };
}

function respond(
  root: string,
  request: IncomingMessage,
  response: ServerResponse,
): void {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405).end();
    return;
  }
  const target = targetFor(root, request.url ?? "/");
  if (target === undefined) {
    response.writeHead(404).end("not found");
    return;
  }
  if (typeof target === "string") {
    response.writeHead(301, { Location: target }).end();
    return;
  }
  serveFile(
    target.file,
    request.method === "HEAD",
    request.headers.range,
    response,
  );
}

/**
 * The file a URL maps to: the file itself, `index.html` inside a trailing-
 * slash directory URL, or the redirect target ("path/") a directory without
 * the slash answers first. `undefined` is the 404.
 */
function targetFor(
  root: string,
  url: string,
): string | { file: string } | undefined {
  const { pathname, search } = new URL(url, "http://static.test");
  const resolved = resolve(root, `.${decodeURIComponent(pathname)}`);
  if (resolved !== root && !resolved.startsWith(`${root}${sep}`)) return;
  const stats = statSync(resolved, { throwIfNoEntry: false });
  if (stats?.isFile()) return { file: resolved };
  if (!stats?.isDirectory()) return;
  if (!pathname.endsWith("/")) return `${pathname}/${search}`;
  const index = join(resolved, "index.html");
  if (statSync(index, { throwIfNoEntry: false })?.isFile())
    return { file: index };
}

interface ByteRange {
  start: number;
  end: number;
}

/**
 * The `[start, end]` slice a `Range` header asks for: `undefined` for a
 * header to ignore (malformed — a real host answers the full file) and
 * `null` for a syntactically valid range nothing satisfies — the 416.
 */
function byteRange(header: string, size: number): ByteRange | null | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!match || (match[1] === "" && match[2] === "")) return;
  const start =
    match[1] === "" ? Math.max(0, size - Number(match[2])) : Number(match[1]);
  const end = match[2] === "" || match[1] === "" ? size - 1 : Number(match[2]);
  if (start > end || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

function serveFile(
  file: string,
  headOnly: boolean,
  rangeHeader: string | undefined,
  response: ServerResponse,
): void {
  const size = statSync(file).size;
  const range =
    rangeHeader === undefined ? undefined : byteRange(rangeHeader, size);
  if (range === null) {
    response.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
    return;
  }
  const headers: Record<string, string | number> = {
    "Accept-Ranges": "bytes",
    "Content-Type": MIME_TYPES[extname(file)] ?? "application/octet-stream",
  };
  if (range === undefined) {
    response.writeHead(200, { ...headers, "Content-Length": size });
    if (headOnly) response.end();
    else createReadStream(file).pipe(response);
    return;
  }
  response.writeHead(206, {
    ...headers,
    "Content-Length": range.end - range.start + 1,
    "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
  });
  if (headOnly) response.end();
  else createReadStream(file, range).pipe(response);
}

function closeServer(server: Server): Promise<void> {
  return new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
}
