import type { FilterOptions } from "../../filters/filter";
import { clauseInterval } from "../../crossfilter/clause";
import type { ClauseOptions, IntervalExtent } from "../../crossfilter/types";
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
 * The `<Slider>` clause factory — evidence's `SliderFilter.predicateSql`
 * gated on the `range` attribute, re-expressed as an interval clause: a
 * range-mode pair binds `column BETWEEN ? AND ?`, a single-mode number
 * binds `column >= ?`, and a held value whose shape mismatches the mode
 * publishes a predicate-less clause — silent, never a wrong filter.
 */
export function sliderClause(
  range: boolean,
): NonNullable<FilterOptions<SliderValue | undefined>["clause"]> {
  return (column: string, value: SliderValue | undefined, ctx: ClauseOptions) =>
    clauseInterval(column, sliderExtent(value, range), ctx);
}

/** Held value → interval extent; a shape mismatch carries no bounds. */
function sliderExtent(
  value: SliderValue | undefined,
  range: boolean,
): IntervalExtent | undefined {
  if (typeof value === "number") return range ? undefined : [value, undefined];
  if (value === undefined || !range) return undefined;
  return [value[0], value[1]];
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
 * The Page Up/Page Down and Shift+Arrow jump — a tenth of the range, rounded
 * to a whole number of steps and never less than one (React Aria's
 * `useSliderState` `pageSize`). Base UI adds its `largeStep` raw, defaulting
 * to a fixed 10, so a step of 100 would land off-step and then stall; and it
 * keeps only the increment's own decimals, so the product is cut back to 12
 * significant digits to drop float residue (`3 * 0.1`).
 *
 * @example
 * sliderPageStep({ min: 2500, max: 6500, step: 100 }) // 400
 */
export function sliderPageStep(bounds: {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}): number {
  const steps = Math.round((bounds.max - bounds.min) / 10 / bounds.step);
  return Number((Math.max(steps, 1) * bounds.step).toPrecision(12));
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
