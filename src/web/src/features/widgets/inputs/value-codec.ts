import type { FilterOptions } from "../../filters/filter";

/**
 * The select inputs' URL codec, a port of evidence's `DropdownFilter`
 * serialize/deserialize: an array serializes as a JSON list
 * (`?channel=["a","b"]`), a lone string stays raw (`?region=West`), and
 * `undefined`/`""`/`[]` all collapse to `undefined` so the param is deleted
 * rather than parked empty. A `[`-prefixed param decodes as JSON only when
 * it is an all-string array — anything else stays a raw string. Evidence's
 * legacy `"…"`-quoted branch is unported; our URLs start with this codec.
 *
 * @example
 * filters.ensure(id, { column: valueColumn, ...selectValueCodec });
 */
export const selectValueCodec = {
  serialize(value: string | string[] | undefined): string | undefined {
    if (value === undefined || value === "") return undefined;
    if (Array.isArray(value)) {
      return value.length > 0 ? JSON.stringify(value) : undefined;
    }
    return value;
  },
  deserialize(raw: string): string | string[] {
    if (raw.startsWith("[")) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (
          Array.isArray(parsed) &&
          parsed.every((v) => typeof v === "string")
        ) {
          return parsed;
        }
      } catch {
        // Not a JSON array — fall through to the raw string.
      }
    }
    return raw;
  },
} satisfies Pick<FilterOptions<string | string[]>, "serialize" | "deserialize">;
