import type { FilterPredicate } from "../../crossfilter/types";

/**
 * The `<DateRange>` value grammar, a subset port of evidence's
 * `date-options.ts` resolver (`resolveRangeToDates` +
 * `isRecognizedDateRange`). A filter's held value IS the range expression
 * — `'2026-01-01 to 2026-01-31'`, `'from 2026-01-01'`, `'until 2026-01-31'`,
 * `'last 30 days'`, `'month to date'`, `'all time'` — persisted verbatim in
 * `?id=` so relative windows re-roll on reload instead of pinning dates.
 *
 * Unrecognized input resolves to `undefined` — evidence's parser silently
 * falls back to "last 12 months" (its `isRecognizedDateRange` exists to
 * guard that); the port folds the guard in so a typo'd URL param or field
 * expression contributes no predicate rather than a wrong one.
 *
 * @example
 * resolveDateRange("last 30 days"); // { start: "2026-09-08", end: "2026-10-08" }
 * resolveDateRange("all time");     // undefined — no predicate
 */

/** The resolved window in ISO `YYYY-MM-DD`; an absent end is open. */
export interface ResolvedRange {
  readonly start?: string;
  readonly end?: string;
}

/** The widget's fixed preset list — the slice's demo set. */
export const DATE_RANGE_PRESETS = [
  { key: "last 7 days", label: "Last 7 Days" },
  { key: "last 30 days", label: "Last 30 Days" },
  { key: "month to date", label: "Month to Date" },
  { key: "all time", label: "All Time" },
] as const;

/** A range boundary: a literal `YYYY-MM-DD` or the `today`/`yesterday` tokens. */
const BOUNDARY = "\\d{4}-\\d{2}-\\d{2}|today|yesterday";
const CLOSED_RANGE_RE = new RegExp(
  `^(?:from )?(${BOUNDARY}) to (${BOUNDARY})$`,
  "i",
);
const FROM_RANGE_RE = new RegExp(`^from (${BOUNDARY})$`, "i");
const UNTIL_RANGE_RE = new RegExp(`^until (${BOUNDARY})$`, "i");
// Day grain only — the subset the slice ports; counts are bounded to 1-9999
// like evidence's recognizer so zero and astronomic counts never resolve.
const LAST_DAYS_RE = /^last ([1-9]\d{0,3} )?days?$/i;

const MONTH_MAX_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** A literal `YYYY-MM-DD` must be a real calendar date (leap-year aware). */
function isValidIsoDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const maxDay = month === 2 && leap ? 29 : MONTH_MAX_DAYS[month - 1];
  return day <= maxDay!;
}

/** Local-date `YYYY-MM-DD` — the same form `type="date"` fields produce. */
function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Boundary token → ISO: `today`/`yesterday` anchor on `today`, literals pass through. */
function resolveBoundary(token: string, today: Date): string {
  const t = token.toLowerCase();
  if (t === "today") return toIsoDate(today);
  if (t === "yesterday") return toIsoDate(addDays(today, -1));
  return token;
}

/**
 * Whether `range` is inside the ported grammar — the check callers use to
 * reject bad authored input (`initialValue`) instead of mis-resolving it.
 */
export function isRecognizedDateRange(range: string): boolean {
  const trimmed = range.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (lower === "all time" || lower === "month to date") return true;
  if (LAST_DAYS_RE.test(trimmed)) return true;
  const literals = trimmed.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  if (!literals.every(isValidIsoDate)) return false;
  return (
    CLOSED_RANGE_RE.test(trimmed) ||
    FROM_RANGE_RE.test(trimmed) ||
    UNTIL_RANGE_RE.test(trimmed)
  );
}

/**
 * The range expression → concrete ISO bounds against the `today` anchor.
 * `undefined` means "unbounded": `'all time'`, empty, and unrecognized
 * expressions all carry no predicate.
 */
export function resolveDateRange(
  range: string | undefined,
  today: Date = new Date(),
): ResolvedRange | undefined {
  if (!isRecognizedDateRange(range ?? "")) return undefined;
  const trimmed = range!.trim();
  const lower = trimmed.toLowerCase();
  if (lower === "all time") return undefined;

  const closed = CLOSED_RANGE_RE.exec(trimmed);
  if (closed) {
    return {
      start: resolveBoundary(closed[1]!, today),
      end: resolveBoundary(closed[2]!, today),
    };
  }
  const from = FROM_RANGE_RE.exec(trimmed);
  if (from) return { start: resolveBoundary(from[1]!, today) };
  const until = UNTIL_RANGE_RE.exec(trimmed);
  if (until) return { end: resolveBoundary(until[1]!, today) };

  if (lower === "month to date") {
    return {
      start: toIsoDate(new Date(today.getFullYear(), today.getMonth(), 1)),
      end: toIsoDate(today),
    };
  }

  // `last [N] days` — evidence's relative branch: the window ends today and
  // spans N days inclusive, so start is today − (N−1).
  const last = LAST_DAYS_RE.exec(trimmed);
  if (last) {
    const count = last[1] ? Number.parseInt(last[1].trim(), 10) : 1;
    return {
      start: toIsoDate(addDays(today, 1 - count)),
      end: toIsoDate(today),
    };
  }

  return undefined;
}

/**
 * The `<DateRange>` `FilterOptions.predicate` — resolves the held expression
 * at query time (so a rolling window re-anchors on each run) and binds the
 * ISO bounds as `?` params, never text-interpolated (ADR-0005). Open ends
 * degrade `BETWEEN` to `>=`/`<=`; an unbounded value contributes nothing.
 */
export function dateRangePredicate(
  column: string,
  value: string | undefined,
): FilterPredicate | undefined {
  const range = resolveDateRange(value);
  if (!range) return undefined;
  if (range.start !== undefined && range.end !== undefined) {
    return {
      sql: `${column} BETWEEN ? AND ?`,
      params: [range.start, range.end],
    };
  }
  if (range.start !== undefined) {
    return { sql: `${column} >= ?`, params: [range.start] };
  }
  if (range.end !== undefined) {
    return { sql: `${column} <= ?`, params: [range.end] };
  }
  return undefined;
}
