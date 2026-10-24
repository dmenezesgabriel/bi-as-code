import type { Connect } from "vite";

/**
 * The CORS response headers a `/data/` file answers `requestOrigin` with —
 * ADR-0025. Only a listed origin is echoed, never `*`. `Vary: Origin` rides
 * on every response, so a cache never hands one origin's answer to another
 * (https://fetch.spec.whatwg.org/#cors-protocol-and-http-caches).
 * `Content-Range` and `Accept-Ranges` are not CORS-safelisted response
 * headers, so a ranged read can see them only once exposed
 * (https://fetch.spec.whatwg.org/#cors-safelisted-response-header-name).
 *
 * @example
 * dataCorsHeaders(["https://notebook.example.com"], "https://notebook.example.com");
 * // → { Vary: "Origin",
 * //     "Access-Control-Allow-Origin": "https://notebook.example.com",
 * //     "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges" }
 */
export function dataCorsHeaders(
  origins: readonly string[],
  requestOrigin: string | undefined,
): Record<string, string> {
  if (requestOrigin === undefined || !origins.includes(requestOrigin))
    return { Vary: "Origin" };
  return {
    Vary: "Origin",
    "Access-Control-Allow-Origin": requestOrigin,
    "Access-Control-Expose-Headers": "Content-Range, Accept-Ranges",
  };
}

/**
 * Sets `dataCorsHeaders` on every `/data/` response, reading the origins per
 * request so a `biac.config.ts` edit applies on the next fetch, and answers
 * a preflight itself: a suffix `Range` (`bytes=-500`) is not CORS-safelisted
 * (https://fetch.spec.whatwg.org/#cors-safelisted-request-header) and vite's
 * own CORS middleware is off. While the config fails to load every origin is
 * refused.
 *
 * `biac preview` mounts the same middleware on `/widgets/` (ADR-0027): a
 * widget module's import is the same embedding relationship as its `/data/`
 * reads, and its simple GET never preflights, so the OPTIONS answer is
 * inert there.
 *
 * @example
 * server.middlewares.use("/data", dataCorsMiddleware(async () => (await getConfig()).embed.dataOrigins));
 */
export function dataCorsMiddleware(
  getOrigins: () => Promise<readonly string[]>,
): Connect.NextHandleFunction {
  return (request, response, next) => {
    getOrigins()
      .catch((): readonly string[] => [])
      .then((origins) => {
        const headers = dataCorsHeaders(origins, request.headers.origin);
        for (const [name, value] of Object.entries(headers))
          response.setHeader(name, value);
        if (request.method !== "OPTIONS") return next();
        response.setHeader("Access-Control-Allow-Methods", "GET, HEAD");
        response.setHeader("Access-Control-Allow-Headers", "Range");
        response.statusCode = 204;
        response.end();
      });
  };
}
