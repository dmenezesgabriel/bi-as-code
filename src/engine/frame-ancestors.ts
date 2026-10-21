import type { Connect } from "vite";

/**
 * The response headers that let only `origins` frame a page — ADR-0022.
 * `'none'` must stand alone in a `frame-ancestors` list (CSP3
 * `ancestor-source-list`), so an empty list denies every framer, the site
 * itself included. `X-Frame-Options: DENY` rides along for browsers without
 * CSP 2: the HTML Standard ignores it whenever `frame-ancestors` is present
 * (https://html.spec.whatwg.org/#the-x-frame-options-header), so it never
 * overrides the allowlist, and it fails closed where the CSP is unknown.
 *
 * @example
 * frameAncestorsHeaders(["https://intranet.example.com"]);
 * // → { "Content-Security-Policy": "frame-ancestors https://intranet.example.com",
 * //     "X-Frame-Options": "DENY" }
 */
export function frameAncestorsHeaders(
  origins: readonly string[],
): Record<string, string> {
  const sources = origins.length === 0 ? "'none'" : origins.join(" ");
  return {
    "Content-Security-Policy": `frame-ancestors ${sources}`,
    "X-Frame-Options": "DENY",
  };
}

/**
 * Sends `frameAncestorsHeaders` on every response, reading the origins per
 * request so a `biac.config.ts` edit applies on the next load. While the
 * config fails to load the policy denies every framer; the load error itself
 * reaches the author through the page, as for any other key.
 *
 * @example
 * server.middlewares.use(frameAncestorsMiddleware(async () => (await getConfig()).embed.origins));
 */
export function frameAncestorsMiddleware(
  getOrigins: () => Promise<readonly string[]>,
): Connect.NextHandleFunction {
  return (_request, response, next) => {
    getOrigins()
      .catch((): readonly string[] => [])
      .then((origins) => {
        for (const [name, value] of Object.entries(
          frameAncestorsHeaders(origins),
        ))
          response.setHeader(name, value);
        next();
      });
  };
}
