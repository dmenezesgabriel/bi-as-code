import { invalid } from "./biac-config-error.js";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";
import type { EmbedConfig } from "./types.js";

const EMBED_KEYS = ["origins", "dataOrigins"] as const;
type OriginListKey = (typeof EMBED_KEYS)[number];
const WEB_PROTOCOLS = new Set(["http:", "https:"]);
// CSP3 `host-part` without its wildcard forms: `host-char = ALPHA / DIGIT /
// "-"` (https://www.w3.org/TR/CSP3/#grammardef-host-part). An IPv6 literal
// or a `*.` host would be dropped by the browser as an invalid source, so it
// is refused here instead of silently allowing nothing.
const CSP_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/;
const ORIGIN_SHAPE =
  'an origin "scheme://host[:port]" (http or https, no path, no wildcard)';

/**
 * Reads `biac.config.ts`'s `embed` block: the origins allowed to frame the
 * site, and — a separate grant (ADR-0025) — the origins allowed to read its
 * `/data/` files cross-origin. Each origin must be written exactly as the
 * browser serializes it — `new URL(origin).origin` — so what the author
 * reads in the config is what the `frame-ancestors` header sends and what a
 * request's `Origin` header is matched against.
 *
 * @example
 * readEmbed({ embed: { origins: ["https://intranet.example.com"] } });
 * // → { origins: ["https://intranet.example.com"], dataOrigins: [] }
 */
export function readEmbed(spec: Record<string, unknown>): EmbedConfig {
  if (spec.embed === undefined) return { origins: [], dataOrigins: [] };
  if (!isRecord(spec.embed))
    throw invalid(
      "embed",
      ["embed"],
      "an object with optional origins and dataOrigins arrays",
      spec.embed,
    );
  rejectUnknownKeys(spec.embed, EMBED_KEYS, ["embed"]);
  return {
    origins: readOrigins(spec.embed.origins, "origins"),
    dataOrigins: readOrigins(spec.embed.dataOrigins, "dataOrigins"),
  };
}

function readOrigins(origins: unknown, key: OriginListKey): string[] {
  if (origins === undefined) return [];
  if (!Array.isArray(origins))
    throw invalid(
      `embed.${key}`,
      ["embed", key],
      "an array of origins",
      origins,
    );
  return origins.map((origin, index) => readOrigin(origin, key, index));
}

function readOrigin(
  origin: unknown,
  key: OriginListKey,
  index: number,
): string {
  if (typeof origin === "string" && isFramingOrigin(origin)) return origin;
  throw invalid(
    `embed.${key}[${index}]`,
    ["embed", key, String(index)],
    ORIGIN_SHAPE,
    origin,
  );
}

function isFramingOrigin(origin: string): boolean {
  if (!URL.canParse(origin)) return false;
  const url = new URL(origin);
  return (
    url.origin === origin &&
    WEB_PROTOCOLS.has(url.protocol) &&
    CSP_HOST.test(url.hostname)
  );
}
