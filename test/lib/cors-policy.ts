/** The CORS headers one response carries, beside its status. */
export interface CorsPolicy {
  status: number;
  allowOrigin: string | null;
  exposeHeaders: string | null;
  vary: string | null;
}

/** The method and headers a cross-origin request adds beside its `Origin`. */
export interface CorsRequestInit {
  method?: string;
  headers?: Record<string, string>;
}

/**
 * The CORS headers `url` answers a request from `origin` with — as a
 * browser on that origin would send it — and the body is drained so the
 * connection is released. `init` adds a method or headers such as `Range`.
 *
 * @example
 * await corsPolicy(`${baseUrl}/data/orders.csv`, "http://127.0.0.1:8901");
 * // → { status: 200, allowOrigin: "http://127.0.0.1:8901", exposeHeaders: "Content-Range, Accept-Ranges", vary: "Origin" }
 */
export async function corsPolicy(
  url: string,
  origin: string,
  init: CorsRequestInit = {},
): Promise<CorsPolicy> {
  const response = await fetch(url, {
    method: init.method,
    headers: { ...init.headers, Origin: origin },
  });
  await response.arrayBuffer();
  return {
    status: response.status,
    allowOrigin: response.headers.get("access-control-allow-origin"),
    exposeHeaders: response.headers.get("access-control-expose-headers"),
    vary: response.headers.get("vary"),
  };
}
