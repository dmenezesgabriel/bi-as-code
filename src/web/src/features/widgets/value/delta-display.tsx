import type { ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { deltaStatus } from "./delta-status";
import { formatValue } from "./format";
import type { DeltaStatus, NeutralRange } from "./types";

export interface DeltaDisplayProps {
  /** The signed delta cell — non-numeric values render neutral. */
  readonly value: unknown;
  /** `formatValue` preset code; a bad code throws `FormatError`. */
  readonly fmt?: string;
  /** Caption after the delta — "vs. prior week". */
  readonly text?: string;
  /** Render as a tinted pill instead of bare text. */
  readonly chip?: boolean;
  /** Downward deltas are the good direction (cost, latency). */
  readonly downIsGood?: boolean;
  readonly showValue?: boolean;
  readonly showSymbol?: boolean;
  /** Arrow side; BigValue passes `"left"`, standalone deltas default `"right"`. */
  readonly symbolPosition?: "left" | "right";
  readonly neutralRange?: NeutralRange;
  readonly className?: string;
}

// WCAG 1.4.3 needs 4.5:1 for the text, on white and on the 10% chip tint
// alike: the light 600/500 tones measure 3.25–4.34:1 on their chips, one
// step darker clears it. The chip tints keep the lighter 600 hue.
const GOOD_TEXT = "text-emerald-700 dark:text-emerald-400";
const BAD_TEXT = "text-red-700 dark:text-red-400";
const GOOD_CHIP =
  "bg-emerald-600/10 border-emerald-600/25 dark:bg-emerald-400/10 dark:border-emerald-400/25";
const BAD_CHIP =
  "bg-red-600/10 border-red-600/25 dark:bg-red-400/10 dark:border-red-400/25";
const NEUTRAL_TEXT = "text-neutral-600 dark:text-neutral-400";
const NEUTRAL_CHIP =
  "bg-neutral-100 border-neutral-200 dark:bg-neutral-800 dark:border-neutral-700";

const ARROW_PATHS: Record<DeltaStatus, string> = {
  positive:
    "M6 2C6.3 2 6.6 2.1 6.8 2.4L10.8 8.4C11.1 8.8 11 9.4 10.6 9.7C10.4 9.9 10.2 10 10 10H2C1.4 10 1 9.6 1 9C1 8.8 1.1 8.6 1.2 8.4L5.2 2.4C5.4 2.1 5.7 2 6 2Z",
  negative:
    "M6 10C5.7 10 5.4 9.9 5.2 9.6L1.2 3.6C0.9 3.2 1 2.6 1.4 2.3C1.6 2.1 1.8 2 2 2H10C10.6 2 11 2.4 11 3C11 3.2 10.9 3.4 10.8 3.6L6.8 9.6C6.6 9.9 6.3 10 6 10Z",
  neutral: "",
};

/**
 * The delta's direction mark: an `aria-hidden` up/down triangle or neutral
 * bar — the signed formatted value carries the meaning for screen readers.
 */
function StatusArrow({ status }: { status: DeltaStatus }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 12 12"
      aria-hidden="true"
      className="inline-block align-baseline"
    >
      {status === "neutral" ? (
        <rect
          x="2"
          y="4.25"
          width="8"
          height="3.5"
          rx="0.75"
          fill="currentColor"
        />
      ) : (
        <path d={ARROW_PATHS[status]} fill="currentColor" />
      )}
    </svg>
  );
}

/**
 * A signed, colored delta for KPI comparisons: formatted value, direction
 * arrow and optional caption inside an all-`<span>` `inline-flex` tree so
 * MDX `<p>` wrapping stays valid HTML. The formatted text is what screen
 * readers get — the arrow is decorative. Positive values gain an explicit
 * `+` (the PRD demo's `▲ +x.x%`); negatives keep `formatValue`'s own `-`.
 *
 * @example
 * <DeltaDisplay value={-0.041} fmt="pct1" text="WoW" />
 * <DeltaDisplay value={ms} fmt="num0" downIsGood chip />
 */
export function DeltaDisplay({
  value,
  fmt,
  text,
  chip = false,
  downIsGood = false,
  showValue = true,
  showSymbol = true,
  symbolPosition = "right",
  neutralRange,
  className,
}: DeltaDisplayProps): ReactElement {
  const status = deltaStatus(value, neutralRange);
  const formatted = formatValue(value, fmt);
  const shown = status === "positive" ? `+${formatted}` : formatted;

  const isGood = status !== "neutral" && (status === "positive") !== downIsGood;
  const pick = (good: string, bad: string, neutral: string): string => {
    if (status === "neutral") return neutral;
    return isGood ? good : bad;
  };
  const statusClass = pick(GOOD_TEXT, BAD_TEXT, NEUTRAL_TEXT);
  const chipClass = pick(GOOD_CHIP, BAD_CHIP, NEUTRAL_CHIP);

  const symbol = showSymbol ? (
    <span
      className={cn(
        "inline-flex items-center justify-center",
        symbolPosition === "left" ? "mr-0.5" : "ml-0.5",
      )}
    >
      <StatusArrow status={status} />
    </span>
  ) : null;
  const number = showValue ? <span>{shown}</span> : null;

  return (
    <span
      data-status={status}
      className={cn(
        "inline-flex items-center align-baseline",
        statusClass,
        chip && `rounded border px-1 text-sm ${chipClass}`,
        className,
      )}
    >
      <span className="inline-flex items-center">
        {symbolPosition === "left" && symbol}
        {number}
        {symbolPosition === "right" && symbol}
        {text && <span className="ml-1">{text}</span>}
      </span>
    </span>
  );
}
