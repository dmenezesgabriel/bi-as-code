/** The headers a response carries when no origin may frame it (ADR-0022). */
export const DENY_ALL = { csp: "frame-ancestors 'none'", xfo: "DENY" };

export interface FramingPolicy {
  csp: string | null;
  xfo: string | null;
}

/**
 * The framing headers `url` answers with; the body is drained so the
 * connection is released.
 *
 * @example
 * await framingPolicy(`${server.url}weekly-review`); // → DENY_ALL
 */
export async function framingPolicy(url: string): Promise<FramingPolicy> {
  const response = await fetch(url);
  await response.arrayBuffer();
  return policyOf(response);
}

function policyOf(response: Response): FramingPolicy {
  return {
    csp: response.headers.get("content-security-policy"),
    xfo: response.headers.get("x-frame-options"),
  };
}

/**
 * The framing headers `url` answers a browser's revalidation with: the
 * first response's `ETag` sent back as `If-None-Match`. A cache keeps the
 * stored headers a 304 omits (RFC 9111 §4.3.4), so a 304 without the policy
 * would leave a reader on whatever policy the page had when first cached.
 *
 * @example
 * await revalidatedFramingPolicy(`${server.url}weekly-review`);
 * // → { status: 304, csp: "frame-ancestors 'none'", xfo: "DENY" }
 */
export async function revalidatedFramingPolicy(
  url: string,
): Promise<FramingPolicy & { status: number }> {
  const first = await fetch(url);
  await first.arrayBuffer();
  const etag = first.headers.get("etag");
  if (etag === null)
    throw new Error(
      `revalidatedFramingPolicy needs an ETag from ${url}, got none`,
    );
  const response = await fetch(url, { headers: { "If-None-Match": etag } });
  await response.arrayBuffer();
  return { status: response.status, ...policyOf(response) };
}

/**
 * `configSource` — a `biac.config.ts` ending in `};` — with an `embed`
 * origin list (`origins` to frame, `dataOrigins` to read `/data/`) added as
 * its last key.
 *
 * @example
 * withEmbedOrigins("export default {\n  title: \"biac\",\n};\n", ["http://localhost:8901"]);
 * // → 'export default {\n  title: "biac",\n  embed: { origins: ["http://localhost:8901"] },\n};\n'
 */
export function withEmbedOrigins(
  configSource: string,
  origins: readonly string[],
  key: "origins" | "dataOrigins" = "origins",
): string {
  if (!/\n};\s*$/.test(configSource))
    throw new Error(
      `withEmbedOrigins needs a config ending in "\\n};", got ${JSON.stringify(configSource)}`,
    );
  const embed = `  embed: { ${key}: ${JSON.stringify(origins)} },`;
  return configSource.replace(/\n};\s*$/, `\n${embed}\n};\n`);
}
