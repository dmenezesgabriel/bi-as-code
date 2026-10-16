import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactElement,
} from "react";
import { Slider as SliderPrimitive } from "../../../components/slider";
import type { Filter } from "../../filters/filter";
import type { FilterIds } from "../../filters/filter-ids";
import { useFilteredQueryRows } from "../../filters/use-filtered-query-rows";
import { usePageFilter } from "../../filters/use-page-filter";
import { WidgetError } from "../markdown/states";
import { titleCase } from "./option-items";
import {
  clampSliderValue,
  columnBounds,
  initialSliderValue,
  resolveSliderBounds,
  sliderClause,
  sliderValueCodec,
} from "./slider-value";
import { sourceError } from "./source-error";
import type { SliderProps, SliderValue } from "./types";

/** Whether a corrected value differs from the held one — element-wise for pairs. */
function sameSliderValue(a: SliderValue, b: SliderValue): boolean {
  if (typeof a === "number" || typeof b === "number") return a === b;
  return a[0] === b[0] && a[1] === b[1];
}

// Base UI focuses a visually hidden `input[type=range]` inside the thumb
// (`clip-path: inset(50%)`), which cuts its own outline away; the thumb
// draws the ring for it.
const thumbClass =
  "block size-4 cursor-grab rounded-full border-2 border-primary bg-field shadow-sm focus-ring-within data-dragging:cursor-grabbing disabled:cursor-not-allowed [&_input]:outline-none";

interface SliderSource {
  /** Finite column extrema, `{}` when the query can't supply them. */
  readonly derived: { readonly min?: number; readonly max?: number };
  /** True while a `data` bounds query is still in flight. */
  readonly loading: boolean;
  /** The inline error element for a bad `data`/`valueColumn` source, else null. */
  readonly failure: ReactElement | null;
}

/**
 * The bounds source — the `data` fence's (cascade-filtered) rows reduced to
 * column extrema, plus the pending/error faces that gate the seed effect.
 */
function useSliderSource(
  data: string | undefined,
  valueColumn: string | undefined,
  filters: FilterIds | undefined,
  id: string,
): SliderSource {
  const result = useFilteredQueryRows(data ?? "", filters, id);
  const derived = useMemo(() => {
    if (data === undefined || result?.status !== "success" || !valueColumn) {
      return {};
    }
    return columnBounds(result.rows, valueColumn);
  }, [data, result, valueColumn]);
  return {
    derived,
    loading: data !== undefined && result?.status !== "success",
    failure: sourceError({
      data,
      valueColumn,
      result,
      id,
      valueColumnFor: "bounds",
    }),
  };
}

/**
 * A correction the slider itself wrote — `held` is the value it left on the
 * filter, `intent` what it was derived from (`undefined` for the bounds
 * seed). While the filter still holds that exact value no reader has
 * authored anything since, so the next bounds change re-derives from the
 * intent instead of from the corrected value.
 */
interface SliderCorrection {
  readonly held: SliderValue | undefined;
  readonly intent: SliderValue | undefined;
}

/** The bounds' default for an unset intent, else the intent clamped into them. */
function correctedValue(
  intent: SliderValue | undefined,
  range: boolean,
  bounds: { readonly min: number; readonly max: number },
): SliderValue {
  if (intent !== undefined) {
    return clampSliderValue(intent, bounds.min, bounds.max);
  }
  return range ? [bounds.min, bounds.max] : bounds.min;
}

/**
 * Evidence's seed-or-clamp, made reversible: an unset filter takes the
 * bounds' default silently; a held value outside them normalizes (the URL
 * param rewrites only when it was already present). Both paths are silent
 * without a param — the bounds are display state, not a selection, so no
 * clause publishes until the reader actually drags (a cascade-collapsed
 * extent must not narrow other consumers). Because those corrections
 * apply no clause, they must not stick either: a seed narrowed by another
 * filter's cascade widens back with the bounds rather than showing a
 * window nothing is filtered by. A shape that mismatches the mode is left
 * alone — the codec can only produce the right shape.
 */
function reconcileHeldValue(
  filter: Filter<SliderValue | undefined>,
  range: boolean,
  bounds: { readonly min: number; readonly max: number },
  correction: { current: SliderCorrection | null },
): void {
  const value = filter.value;
  const intent =
    correction.current && Object.is(value, correction.current.held)
      ? correction.current.intent
      : value;
  const next = correctedValue(intent, range, bounds);
  const usable = range ? Array.isArray(next) : typeof next === "number";
  if (!usable || (value !== undefined && sameSliderValue(value, next))) return;
  filter.normalize(next);
  correction.current = { held: filter.value, intent };
}

/**
 * Keeps the held value inside resolved bounds — skips while `blocked`
 * (bounds query in flight, a source error, or contradictory props) so an
 * unresolved source never clamps a URL seed against fallback bounds.
 * Returns `authored`, which the reader's own change calls so a value they
 * picked is never mistaken for one of the slider's corrections.
 */
function useSliderValueSync(
  filter: Filter<SliderValue | undefined> | undefined,
  range: boolean,
  min: number,
  max: number,
  blocked: boolean,
): () => void {
  const correction = useRef<SliderCorrection | null>(null);
  useEffect(() => {
    if (filter === undefined || blocked) return;
    reconcileHeldValue(filter, range, { min, max }, correction);
  }, [filter, blocked, range, min, max]);
  return useCallback(() => {
    correction.current = null;
  }, []);
}

interface SliderFieldProps {
  readonly label: string;
  readonly bounds: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
  };
  readonly range: boolean;
  readonly held: SliderValue | undefined;
  readonly disabled: boolean;
  readonly onChange: (next: SliderValue) => void;
}

/**
 * The controlled thumb value — a pair when `range`, else the held scalar;
 * before the seeded default lands the thumbs sit at the bounds.
 */
function fieldValue(
  held: SliderValue | undefined,
  range: boolean,
  bounds: { readonly min: number; readonly max: number },
): SliderValue {
  if (range) {
    return typeof held === "object" ? held : [bounds.min, bounds.max];
  }
  return typeof held === "number" ? held : bounds.min;
}

/**
 * The rendered input — label + live readout, one thumb (single) or two
 * (`range`), and the resolved `min`/`max` printed at the track's ends.
 */
function SliderField({
  label,
  bounds,
  range,
  held,
  disabled,
  onChange,
}: SliderFieldProps): ReactElement {
  const value = fieldValue(held, range, bounds);
  return (
    <div className="relative w-64">
      <SliderPrimitive.Root
        value={value}
        onValueChange={onChange}
        min={bounds.min}
        max={bounds.max}
        step={bounds.step}
        thumbCollisionBehavior="swap"
        disabled={disabled}
      >
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <SliderPrimitive.Label className="cursor-default truncate text-sm font-medium text-label">
            {label}
          </SliderPrimitive.Label>
          <SliderPrimitive.Value className="shrink-0 text-sm font-normal text-muted-foreground-faded" />
        </div>
        <SliderPrimitive.Control className="flex h-5 items-center">
          <SliderPrimitive.Track className="relative h-1 w-full rounded-full bg-secondary">
            <SliderPrimitive.Indicator className="absolute h-full rounded-full bg-primary" />
            {range ? (
              <>
                <SliderPrimitive.Thumb
                  index={0}
                  aria-label="Minimum"
                  className={thumbClass}
                />
                <SliderPrimitive.Thumb
                  index={1}
                  aria-label="Maximum"
                  className={thumbClass}
                />
              </>
            ) : (
              <SliderPrimitive.Thumb className={thumbClass} />
            )}
          </SliderPrimitive.Track>
        </SliderPrimitive.Control>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground-faded select-none">
          <span>{bounds.min}</span>
          <span>{bounds.max}</span>
        </div>
      </SliderPrimitive.Root>
    </div>
  );
}

/**
 * The one-value face — the label, the value and a note in place of a
 * track. `min-h-16` holds `SliderField`'s 64 px footprint: the filter bar
 * aligns its items to the bottom, so a shorter box would drop the label
 * below its neighbours and shift the row whenever the domain collapses.
 * Plain text, not a Base UI root: nothing can be slid.
 */
function PinnedSliderReadout({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): ReactElement {
  return (
    <div className="relative min-h-16 w-64">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="truncate text-sm font-medium text-label">{label}</span>
        <span className="shrink-0 text-sm font-normal text-muted-foreground-faded">
          {value}
        </span>
      </div>
      <p className="text-xs text-muted-foreground-faded">
        only one value in range
      </p>
    </div>
  );
}

/**
 * The `<Slider>` MDX widget — a numeric filter input whose value writes
 * `?id=<n>` (single) or `?id=<lo> - <hi>` (`range`) to the URL. `data` +
 * `valueColumn` derive the bounds from a ```sql fence's rows — filtered
 * live by the `filters` cascade — while `min`/`max`/`step` supply or
 * override them statically. The bound page filter carries the `valueColumn`
 * predicate (`>=` single, `BETWEEN` range — `column: false` without a
 * `valueColumn`, so the value stays a `{{params.id}}`-only read) and the
 * `"a - b"` codec. A held value clamps into resolved bounds (evidence's
 * Slider); a pending bounds query never clamps and never clears.
 *
 * @example
 * <Slider id="amount" data="order_amounts" valueColumn="amount" title="Amount" />
 * <Slider id="price" range min={0} max={1000} step={10} />
 */
export function Slider({
  id,
  data,
  valueColumn,
  min,
  max,
  step,
  range = false,
  filters,
  title,
  initialValue,
}: SliderProps): ReactElement {
  const source = useSliderSource(data, valueColumn, filters, id);
  const filter = usePageFilter<SliderValue | undefined>(id, {
    column: valueColumn ?? false,
    ...sliderValueCodec,
    clause: sliderClause(range),
    initialValue: initialSliderValue(initialValue, range),
  });
  const bounds = resolveSliderBounds(source.derived, { min, max, step });
  const authored = useSliderValueSync(
    filter,
    range,
    bounds.min,
    bounds.max,
    source.loading || source.failure !== null || bounds.min > bounds.max,
  );

  if (source.failure) return source.failure;
  if (bounds.min > bounds.max) {
    return (
      <WidgetError
        name={id}
        message={`min (${bounds.min}) must not exceed max (${bounds.max})`}
      />
    );
  }

  // `min === max` is a degenerate window — the cascade narrowed the source
  // to one value, or the author pinned it. That's a real data state, not an
  // error, but nothing can be slid, and Base UI warns "Slider `max` must be
  // greater than `min`" for any root with `min >= max`, disabled or not —
  // so the value is stated as text instead.
  const label = title ?? titleCase(id);
  if (bounds.min === bounds.max) {
    return <PinnedSliderReadout label={label} value={bounds.min} />;
  }
  return (
    <SliderField
      label={label}
      bounds={bounds}
      range={range}
      held={filter?.value}
      disabled={source.loading || !filter}
      onChange={(next) => {
        if (!filter) return;
        authored();
        filter.value = clampSliderValue(next, bounds.min, bounds.max);
      }}
    />
  );
}
