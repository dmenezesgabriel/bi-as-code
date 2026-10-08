import type { FilterOptions } from "../../filters/filter";
import type { FilterPredicate } from "../../crossfilter/types";
import type { Row } from "../../data/types";
import type { SliderValue } from "./types";

/**
 * The `<Slider>` filter's URL codec, a port of evidence's `SliderFilter`
 * serialize/deserialize: a pair serializes as `"lo - hi"`, a lone number
 * stays bare, and `undefined`, non-finite or ragged values collapse to
 * `undefined` so the param is deleted rather than parked. Decoding goes the
 * other way — the `" - "` separator wins over the bare-number form, an
 * undecodable param yields `undefined` (the input reseeds itself), and
 * evidence's legacy comma form is unported: our URLs start with this codec.
 *
 * @example
 * filters.ensure(id, { column: valueColumn ?? false, ...sliderValueCodec });
 */
export const sliderValueCodec = {
  serialize(value: SliderValue | undefined): string | undefined {
    if (typeof value === "number") {
      return Number.isFinite(value) ? String(value) : undefined;
    }
    if (value !== undefined) {
      const lo = Number(value[0]);
      const hi = Number(value[1]);
      return Number.isFinite(lo) && Number.isFinite(hi)
        ? `${lo} - ${hi}`
        : undefined;
    }
    return undefined;
  },
  deserialize(raw: string): SliderValue | undefined {
    const text = raw.trim();
    if (!text) return undefined;
    if (text.includes(" - ")) {
      const parts = text.split(" - ");
      if (parts.length !== 2) return undefined;
      const lo = Number(parts[0]!.trim());
      const hi = Number(parts[1]!.trim());
      return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : undefined;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : undefined;
  },
} satisfies Pick<
  FilterOptions<SliderValue | undefined>,
  "serialize" | "deserialize"
>;

/**
 * The `<Slider>` predicate builder — evidence's `SliderFilter.predicateSql`
 * gated on the `range` attribute: a range-mode pair binds
 * `column BETWEEN ? AND ?`, a single-mode number binds `column >= ?`, and a
 * held value whose shape mismatches the mode contributes nothing.
 */
export function sliderPredicate(
  range: boolean,
): (
  column: string,
  value: SliderValue | undefined,
) => FilterPredicate | undefined {
  return (column, value) => {
    if (typeof value === "number") {
      return range ? undefined : { sql: `${column} >= ?`, params: [value] };
    }
    if (value !== undefined) {
      return range
        ? { sql: `${column} BETWEEN ? AND ?`, params: [...value] }
        : undefined;
    }
    return undefined;
  };
}

/**
 * The `initialValue` prop's shape-vs-mode normalization — evidence's
 * constructor coercion: range takes the pair (elements Number-coerced),
 * single takes a finite number; a mismatched shape drops so a malformed
 * default never lands in the filter.
 */
export function initialSliderValue(
  value: number | readonly [number, number] | undefined,
  range: boolean,
): SliderValue | undefined {
  if (typeof value === "number") {
    return !range && Number.isFinite(value) ? value : undefined;
  }
  if (value !== undefined && range) {
    const lo = Number(value[0]);
    const hi = Number(value[1]);
    return Number.isFinite(lo) && Number.isFinite(hi) ? [lo, hi] : undefined;
  }
  return undefined;
}

/**
 * The bounds of a column over a fence's rows — nullish and non-finite cells
 * drop, numeric strings coerce (evidence's `Number(row.value)`), and an
 * empty or all-null column yields no bound so the caller's props/fallbacks
 * apply.
 */
export function columnBounds(
  rows: readonly Row[],
  column: string,
): { min?: number; max?: number } {
  let min: number | undefined;
  let max: number | undefined;
  for (const row of rows) {
    const raw = row[column];
    // Number(null) is 0 — nullish cells drop before coercion, not after.
    if (raw === null || raw === undefined) continue;
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    if (min === undefined || value < min) min = value;
    if (max === undefined || value > max) max = value;
  }
  return { min, max };
}

/**
 * Bounds precedence — an explicit prop wins over the column-derived bound,
 * which wins over the `0..100` authored-world default; a non-positive or
 * non-finite `step` collapses to `1` so a bad prop can't break the input.
 *
 * @example
 * resolveSliderBounds({ min: 12, max: 48 }, {}) // { min: 12, max: 48, step: 1 }
 * resolveSliderBounds({}, { max: 1000 }) // { min: 0, max: 1000, step: 1 }
 */
export function resolveSliderBounds(
  derived: { readonly min?: number; readonly max?: number },
  props: {
    readonly min?: number;
    readonly max?: number;
    readonly step?: number;
  },
): { readonly min: number; readonly max: number; readonly step: number } {
  const step = props.step;
  return {
    min: props.min ?? derived.min ?? 0,
    max: props.max ?? derived.max ?? 100,
    step: step !== undefined && Number.isFinite(step) && step > 0 ? step : 1,
  };
}

/**
 * Clamps a held value into `[min, max]` — a pair additionally reorders so a
 * crossed or inverted selection still serializes `lo - hi` (evidence sorts
 * after clamping).
 */
export function clampSliderValue(
  value: SliderValue,
  min: number,
  max: number,
): SliderValue {
  const clamp = (n: number) => Math.max(min, Math.min(max, n));
  if (typeof value === "number") return clamp(value);
  const lo = clamp(value[0]);
  const hi = clamp(value[1]);
  return lo <= hi ? [lo, hi] : [hi, lo];
}
