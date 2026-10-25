import type { Connect } from "vite";

/**
 * Sent on every `biac serve` response: `nosniff` stops a browser from
 * re-typing a data file as script, `no-referrer` keeps page URLs (which carry
 * filter state) out of the Referer of outbound requests. Framing is
 * `frameAncestorsMiddleware`'s; HSTS belongs to the TLS terminator and
 * `Cross-Origin-Resource-Policy` would block the `/data/` and `/widgets/`
 * cross-origin embeds (ADR-0025, ADR-0027).
 */
export const SERVE_HEADERS: Readonly<Record<string, string>> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

/** Build output under `assets/` is content-hashed, so a cached copy never goes stale. */
export const IMMUTABLE_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

function isAssetRequest(
  base: string,
  method: string | undefined,
  url: string | undefined,
): boolean {
  if (method !== "GET" && method !== "HEAD") return false;
  const pathname = (url ?? "").split("?")[0] ?? "";
  return pathname.startsWith(`${base}assets/`);
}

/**
 * Sets `SERVE_HEADERS` on every response and the immutable `Cache-Control` on
 * GET/HEAD requests under `<base>assets/`, then passes the request on. Mounted
 * ahead of vite preview's static server as a middleware rather than through
 * `preview.headers`: vite answers a matching `If-None-Match` with a bare 304
 * before applying those, and sirv's `send` keeps a header already set on the
 * response, so this `Cache-Control` wins over sirv's `no-cache`. Middlewares
 * registered from `configurePreviewServer` see `req.url` before vite strips
 * the base, so the match is on the full prefixed path.
 *
 * @example
 * server.middlewares.use(serveHeadersMiddleware("/bi-as-code/"));
 */
export function serveHeadersMiddleware(
  base: string,
): Connect.NextHandleFunction {
  return (req, res, next) => {
    for (const [name, value] of Object.entries(SERVE_HEADERS)) {
      res.setHeader(name, value);
    }
    if (isAssetRequest(base, req.method, req.url)) {
      res.setHeader("Cache-Control", IMMUTABLE_ASSET_CACHE_CONTROL);
    }
    next();
  };
}
