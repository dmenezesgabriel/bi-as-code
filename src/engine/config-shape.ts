import { unknownKey } from "./biac-config-error.js";

/**
 * True for a plain object — not null, not an array.
 *
 * @example
 * isRecord({ title: "ACME" }); // → true
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Throws `unknownKey` for the first key of `spec` not in `accepted`.
 *
 * @example
 * rejectUnknownKeys({ sidebr: true }, ["sidebar"], ["nav"]); // throws "nav.sidebr: unknown key, …"
 */
export function rejectUnknownKeys(
  spec: Record<string, unknown>,
  accepted: readonly string[],
  parentPath: readonly string[],
): void {
  const known = new Set(accepted);
  const unknown = Object.keys(spec).find((key) => !known.has(key));
  if (unknown === undefined) return;
  throw unknownKey(unknown, parentPath, accepted);
}
