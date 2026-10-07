import type { Row } from "../../data/types";
import type { OptionItem } from "./types";

/**
 * Distinct `valueColumn` values over the filtered block's rows, in fence
 * order — nullish cells drop, values coerce through `String` (evidence's
 * `String(row.value)`), and a duplicate value keeps its first row's label.
 *
 * @example
 * toOptionItems([{region: "West"}, {region: "West"}, {region: "East"}], "region");
 * // [{value: "West"}, {value: "East"}]
 */
export function toOptionItems(
  rows: readonly Row[],
  valueColumn: string,
  labelColumn?: string,
): OptionItem[] {
  const seen = new Set<string>();
  const items: OptionItem[] = [];
  for (const row of rows) {
    const raw = row[valueColumn];
    if (raw === null || raw === undefined) continue;
    const value = String(raw);
    if (seen.has(value)) continue;
    seen.add(value);
    const label = labelColumn === undefined ? undefined : row[labelColumn];
    items.push({
      value,
      label: label == null ? undefined : String(label),
    });
  }
  return items;
}

/**
 * The `options` prop's authoring shapes — port of evidence's
 * `parse-options-prop.ts`: strings and numbers become value-only options,
 * `{value, label}` objects carry both, and anything else drops. A non-array
 * prop yields none.
 */
export function parseOptionsProp(options: unknown): OptionItem[] {
  if (!Array.isArray(options)) return [];
  const items: OptionItem[] = [];
  for (const option of options) {
    if (option === null || option === undefined) continue;
    if (typeof option === "string" || typeof option === "number") {
      items.push({ value: String(option) });
      continue;
    }
    if (typeof option === "object") {
      const { value, label } = option as { value: unknown; label: unknown };
      const badValue = typeof value !== "string" && typeof value !== "number";
      const badLabel = label != null && typeof label !== "string";
      if (badValue || badLabel) continue;
      items.push({ value: String(value), label: label ?? undefined });
    }
  }
  return items;
}

/**
 * Whether `value` is still a defensible selection given the known options —
 * the four-state port of evidence's `isDropdownValueValid`: a pending query,
 * an unknown option set, or an empty loaded set all keep the value (clearing
 * those is what broke evidence's URL-hydrated exports); only a loaded,
 * non-empty set lacking the value marks it stale so the caller can clear it.
 */
export function isOptionValueValid(
  value: string | undefined,
  availableValues: ReadonlySet<string>,
  opts: {
    hasQueryResults: boolean;
    hasStaticOptions: boolean;
    optionsQueryPending?: boolean;
  },
): boolean {
  if (!value) return true;
  if (opts.optionsQueryPending) return true;
  if (!opts.hasQueryResults && !opts.hasStaticOptions) return true;
  if (availableValues.size === 0) return true;
  return availableValues.has(value);
}

/**
 * `snake_case`/`kebab-case`/`camelCase` → "Title Case" for the default
 * placeholder (`Select ${titleCase(valueColumn)}` when `title` is absent).
 * Deliberately minimal — evidence's `formatTitle` acronym and alias rules
 * are unported.
 */
export function titleCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word[0]!.toUpperCase() + word.slice(1))
    .join(" ");
}
