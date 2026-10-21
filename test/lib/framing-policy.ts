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
  return {
    csp: response.headers.get("content-security-policy"),
    xfo: response.headers.get("x-frame-options"),
  };
}

/**
 * `configSource` — a `biac.config.ts` ending in `};` — with `embed.origins`
 * added as its last key.
 *
 * @example
 * withEmbedOrigins("export default {\n  title: \"biac\",\n};\n", ["http://localhost:8901"]);
 * // → 'export default {\n  title: "biac",\n  embed: { origins: ["http://localhost:8901"] },\n};\n'
 */
export function withEmbedOrigins(
  configSource: string,
  origins: readonly string[],
): string {
  if (!/\n};\s*$/.test(configSource))
    throw new Error(
      `withEmbedOrigins needs a config ending in "\\n};", got ${JSON.stringify(configSource)}`,
    );
  const embed = `  embed: { origins: ${JSON.stringify(origins)} },`;
  return configSource.replace(/\n};\s*$/, `\n${embed}\n};\n`);
}
