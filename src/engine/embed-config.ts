import { invalid } from "./biac-config-error.js";
import { isRecord, rejectUnknownKeys } from "./config-shape.js";
import type { EmbedConfig } from "./types.js";

const EMBED_KEYS = ["origins"] as const;
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
 * site. Each origin must be written exactly as the browser serializes it —
 * `new URL(origin).origin` — so what the author reads in the config is what
 * the `frame-ancestors` header sends.
 *
 * @example
 * readEmbed({ embed: { origins: ["https://intranet.example.com"] } });
 * // → { origins: ["https://intranet.example.com"] }
 */
export function readEmbed(spec: Record<string, unknown>): EmbedConfig {
  if (spec.embed === undefined) return { origins: [] };
  if (!isRecord(spec.embed))
    throw invalid(
      "embed",
      ["embed"],
      "an object with an optional origins array",
      spec.embed,
    );
  rejectUnknownKeys(spec.embed, EMBED_KEYS, ["embed"]);
  return { origins: readOrigins(spec.embed.origins) };
}

function readOrigins(origins: unknown): string[] {
  if (origins === undefined) return [];
  if (!Array.isArray(origins))
    throw invalid(
      "embed.origins",
      ["embed", "origins"],
      "an array of origins",
      origins,
    );
  return origins.map(readOrigin);
}

function readOrigin(origin: unknown, index: number): string {
  if (typeof origin === "string" && isFramingOrigin(origin)) return origin;
  throw invalid(
    `embed.origins[${index}]`,
    ["embed", "origins", String(index)],
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
