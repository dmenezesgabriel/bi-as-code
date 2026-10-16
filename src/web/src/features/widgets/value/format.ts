import { FormatError, type FormatRange } from "./types";

/**
 * Pinned locale — the presets encode US conventions (`$` prefix, `m/d/y`
 * order, `,`/`'.'` separators), so output is identical for every viewer and
 * stable under test. Locale-aware `fmt` is a deliberate non-goal for now.
 */
const LOCALE = "en-US";

/**
 * Bare three-letter bases that resolve to an explicit preset from the
 * value's own magnitude (`1_234_567` + `usd` → `usd1m` → `$1.2M`).
 */
const AUTO_BASES = new Set(["num", "usd", "pct"]);

interface NumberPreset {
  readonly kind: "number";
  readonly decimals: number;
  /** Divide the value before formatting (`num0k` → `value / 1e3`). */
  readonly divisor?: number;
  /** Appended verbatim after the formatted number — `"k"`, `"M"`, `"x"`, `" MB"`. */
  readonly suffix?: string;
  /** `style: "currency"` with `USD` — the `$` prefix. */
  readonly usd?: boolean;
  /** `style: "percent"` — Intl multiplies by 100, so `0.056` → `5.6%`. */
  readonly percent?: boolean;
  /** Thousands separators; `id` opts out so identifiers stay `1234`. */
  readonly grouping?: boolean;
  /** `notation: "scientific"` — emits `1.23E4` (no `+`, unpadded exponent). */
  readonly scientific?: boolean;
}

interface DatePreset {
  readonly kind: "date";
  /** Token template interpreted by `formatDate` — `yyyy`, `mm`, `h`, `TT`, … */
  readonly pattern: string;
}

type Preset = NumberPreset | DatePreset | { readonly kind: "bytes" };

const n = (
  decimals: number,
  extra: Omit<NumberPreset, "kind" | "decimals"> = {},
): NumberPreset => ({ kind: "number", decimals, ...extra });

const dp = (pattern: string): DatePreset => ({ kind: "date", pattern });

const FORMAT_PRESETS: Record<string, Preset> = {
  num0: n(0),
  num1: n(1),
  num2: n(2),
  num0k: n(0, { divisor: 1e3, suffix: "k" }),
  num1k: n(1, { divisor: 1e3, suffix: "k" }),
  num2k: n(2, { divisor: 1e3, suffix: "k" }),
  num0m: n(0, { divisor: 1e6, suffix: "M" }),
  num1m: n(1, { divisor: 1e6, suffix: "M" }),
  num2m: n(2, { divisor: 1e6, suffix: "M" }),
  num0b: n(0, { divisor: 1e9, suffix: "B" }),
  num1b: n(1, { divisor: 1e9, suffix: "B" }),
  num1t: n(1, { divisor: 1e12, suffix: "T" }),
  usd0: n(0, { usd: true }),
  usd1: n(1, { usd: true }),
  usd2: n(2, { usd: true }),
  usd0k: n(0, { usd: true, divisor: 1e3, suffix: "k" }),
  usd1k: n(1, { usd: true, divisor: 1e3, suffix: "k" }),
  usd2k: n(2, { usd: true, divisor: 1e3, suffix: "k" }),
  usd0m: n(0, { usd: true, divisor: 1e6, suffix: "M" }),
  usd1m: n(1, { usd: true, divisor: 1e6, suffix: "M" }),
  usd2m: n(2, { usd: true, divisor: 1e6, suffix: "M" }),
  usd0b: n(0, { usd: true, divisor: 1e9, suffix: "B" }),
  usd1b: n(1, { usd: true, divisor: 1e9, suffix: "B" }),
  usd1t: n(1, { usd: true, divisor: 1e12, suffix: "T" }),
  pct0: n(0, { percent: true }),
  pct1: n(1, { percent: true }),
  pct2: n(2, { percent: true }),
  pct3: n(3, { percent: true }),
  id: n(0, { grouping: false }),
  mult0: n(0, { suffix: "x" }),
  mult1: n(1, { suffix: "x" }),
  mult2: n(2, { suffix: "x" }),
  sci: n(2, { scientific: true }),
  bytes: { kind: "bytes" },
  date: dp("yyyy-mm-dd"),
  shortdate: dp("mmm d/yy"),
  longdate: dp("mmmm d, yyyy"),
  mdy: dp("m/d/yyyy"),
  dmy: dp("d/m/yyyy"),
  hms: dp("h:MM:SS TT"),
};

const ALL_CODES = [...AUTO_BASES, ...Object.keys(FORMAT_PRESETS)];
const DATE_CODES = Object.keys(FORMAT_PRESETS).filter(
  (code) => FORMAT_PRESETS[code]?.kind === "date",
);

/**
 * Formats one cell value for the value widgets — `formatValue(1234567,
 * "usd")` → `"$1.2M"`, `formatValue(date, "hms")` → `"3:04:05 PM"`. Bare
 * `num`/`usd`/`pct` (and an unset code on a number) auto-scale on `range`
 * when given, so an axis or column reads in one unit —
 * `formatValue(3000, "num", { min: 0, max: 7000 })` → `"3k"` — else on the
 * value's own magnitude; every other code is a fixed preset. Missing cells
 * render `–`; anything a preset cannot express throws `FormatError` — there
 * is no raw-code passthrough.
 */
export function formatValue(
  value: unknown,
  code?: string,
  range?: FormatRange,
): string {
  if (value === null || value === undefined) return "–";
  if (code !== undefined) assertKnownCode(code);

  if (value instanceof Date) return formatDateValue(value, code);

  const numeric = coerceNumeric(value);
  if (numeric !== null) return formatNumericValue(numeric, code, range);

  if (code === undefined) return String(value);
  throw new FormatError({
    code,
    detail: `expected a number, bigint or Date; got ${describeValue(value)}`,
  });
}

function assertKnownCode(code: string): void {
  if (AUTO_BASES.has(code) || Object.hasOwn(FORMAT_PRESETS, code)) return;
  throw new FormatError({
    code,
    detail: `unknown format code — expected one of: ${ALL_CODES.join(", ")}`,
  });
}

/**
 * The numeric cells `formatValue` and the sparkline's y projection both
 * accept: numbers, bigints, and non-blank strings that parse to a finite
 * number. Everything else — null, dates, blanks, booleans — is not a
 * number.
 */
export function coerceNumeric(value: unknown): number | bigint | null {
  if (typeof value === "number" || typeof value === "bigint") return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    !Number.isNaN(Number(value))
  )
    return Number(value);
  return null;
}

function describeValue(value: unknown): string {
  return typeof value === "string" ? `string "${value}"` : typeof value;
}

/**
 * `num`/`usd` pick decimals by magnitude and a unit by threshold — the k
 * threshold is 4000 (not 1000) so `1,500` keeps full precision, and a
 * `whole` range below it takes no decimals; `pct` picks decimals only, never
 * a unit suffix.
 */
function resolveAuto(base: string, abs: number, whole: boolean): string {
  if (abs === 0) return `${base}0`;
  if (base === "pct") {
    if (abs < 0.1) return "pct2";
    if (abs < 1) return "pct1";
    return "pct0";
  }
  if (abs >= 1e12) return `${base}1t`;
  if (abs >= 1e9) return `${base}1b`;
  if (abs >= 1e6) return `${base}1m`;
  if (abs >= 4e3) return `${base}0k`;
  if (whole) return `${base}0`;
  if (abs < 10) return `${base}2`;
  if (abs < 100) return `${base}1`;
  return `${base}0`;
}

/**
 * The magnitude a range scales by: the larger of `|min|` and `|max|`, so an
 * all-negative column (`-5000 … -100`) scales to `k` like its mirror image
 * would — scaling by `max` alone would leave it unscaled.
 */
function rangeMagnitude(range: FormatRange): number {
  return Math.max(Math.abs(range.min), Math.abs(range.max));
}

/**
 * A zero value collapses to the base's zero-decimal preset whatever the
 * range or explicit unit (`usd1m`) — `0` renders `$0`, never `$0.0M` or
 * `$0k`, so an axis baseline reads `0`.
 */
function resolveCode(
  code: string,
  value: number | bigint,
  range: FormatRange | undefined,
): string {
  const abs = Math.abs(Number(value));
  if (AUTO_BASES.has(code))
    return resolveAuto(
      code,
      abs === 0 || range === undefined ? abs : rangeMagnitude(range),
      range?.whole === true,
    );
  if (abs === 0 && /^[a-z]{3}\d[kmbt]$/.test(code))
    return `${code.slice(0, 3)}0`;
  return code;
}

function formatNumericValue(
  value: number | bigint,
  code: string | undefined,
  range: FormatRange | undefined,
): string {
  const resolved = resolveCode(code ?? "num", value, range);
  const preset = FORMAT_PRESETS[resolved];
  if (preset === undefined || preset.kind === "date")
    throw new FormatError({
      code: code ?? resolved,
      detail: `"${resolved}" formats dates; the value is a number — expected one of the numeric presets`,
    });
  if (preset.kind === "bytes") return formatBytes(Number(value));
  return formatNumber(value, preset);
}

function numberStyle(preset: NumberPreset): "currency" | "percent" | "decimal" {
  if (preset.usd) return "currency";
  if (preset.percent) return "percent";
  return "decimal";
}

function formatNumber(value: number | bigint, preset: NumberPreset): string {
  // bigint passes through to NumberFormat natively (exact `id` on huge
  // values); only a divisor forces Number coercion for the division itself.
  const scaled =
    preset.divisor === undefined ? value : Number(value) / preset.divisor;
  const formatted = new Intl.NumberFormat(LOCALE, {
    style: numberStyle(preset),
    currency: preset.usd ? "USD" : undefined,
    notation: preset.scientific ? "scientific" : "standard",
    minimumFractionDigits: preset.decimals,
    maximumFractionDigits: preset.decimals,
    useGrouping: preset.grouping ?? true,
  }).format(scaled);
  return preset.suffix ? formatted + preset.suffix : formatted;
}

// 1000-based SI steps: 512 → "512 B", 1536 → "1.5 kB".
const BYTE_STEPS = [
  [1e12, " TB"],
  [1e9, " GB"],
  [1e6, " MB"],
  [1e3, " kB"],
] as const;

function formatBytes(value: number): string {
  for (const [divisor, suffix] of BYTE_STEPS)
    if (Math.abs(value) >= divisor)
      return formatNumber(value, {
        kind: "number",
        decimals: 1,
        divisor,
        suffix,
      });
  return formatNumber(value, { kind: "number", decimals: 0, suffix: " B" });
}

const DATE_PARTS = new Intl.DateTimeFormat(LOCALE, {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const MONTH_SHORT = new Intl.DateTimeFormat(LOCALE, { month: "short" });
const MONTH_LONG = new Intl.DateTimeFormat(LOCALE, { month: "long" });
// Longest-first alternation so `mmmm`/`mmm`/`mm`/`m` can't shadow each other.
const DATE_TOKENS = /mmmm|mmm|mm|m|yyyy|yy|dd|d|MM|SS|TT|h/g;

/** Renders a token pattern — `yyyy-mm-dd`, `h:MM:SS TT` — over a Date. */
function formatDate(date: Date, pattern: string): string {
  const parts = new Map(
    DATE_PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const tokens: Record<string, string> = {
    yyyy: parts.get("year") ?? "",
    yy: (parts.get("year") ?? "").slice(-2),
    mmmm: MONTH_LONG.format(date),
    mmm: MONTH_SHORT.format(date),
    mm: parts.get("month") ?? "",
    m: String(Number(parts.get("month") ?? 0)),
    dd: parts.get("day") ?? "",
    d: String(Number(parts.get("day") ?? 0)),
    h: parts.get("hour") ?? "",
    MM: parts.get("minute") ?? "",
    SS: parts.get("second") ?? "",
    TT: parts.get("dayPeriod") ?? "",
  };
  return pattern.replace(DATE_TOKENS, (token) => tokens[token] ?? token);
}

function formatDateValue(date: Date, code: string | undefined): string {
  const preset =
    code === undefined ? FORMAT_PRESETS["date"] : FORMAT_PRESETS[code];
  if (preset?.kind !== "date")
    throw new FormatError({
      code: code ?? "date",
      detail: `"${code ?? "date"}" does not format dates — expected one of: ${DATE_CODES.join(", ")}`,
    });
  if (Number.isNaN(date.getTime()))
    throw new FormatError({ code: code ?? "date", detail: "invalid Date" });
  return formatDate(date, preset.pattern);
}
