/**
 * A URL search param in the form `{{params.*}}` binds it: TanStack's
 * default `parseSearch` JSON-decodes each value (`"true"` → `true`, `"30"`
 * → `30`, `["a","b"]` → an array) and falls back to the raw string when it
 * isn't JSON. An absent param binds NULL downstream.
 *
 * @example
 * decodeSearchParam("true"); // → true
 * decodeSearchParam("Dream"); // → "Dream"
 */
export function decodeSearchParam(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
