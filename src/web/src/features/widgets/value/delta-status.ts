import type { DeltaStatus, NeutralRange } from "./types";

const DEFAULT_NEUTRAL_RANGE: NeutralRange = [0, 0];

/**
 * Sign status of one cell against a neutral band: finite numbers compare
 * against `[min, max]` inclusive, `null` bounds are infinite, and anything
 * non-numeric — including NaN/±Infinity — is neutral so a divide-by-zero
 * artifact never reads as "up".
 */
export function deltaStatus(
  value: unknown,
  neutralRange: NeutralRange = DEFAULT_NEUTRAL_RANGE,
): DeltaStatus {
  if (typeof value !== "number" && typeof value !== "bigint") return "neutral";
  const n = Number(value);
  if (!Number.isFinite(n)) return "neutral";
  const min = neutralRange[0] ?? -Infinity;
  const max = neutralRange[1] ?? Infinity;
  if (n > max) return "positive";
  if (n < min) return "negative";
  return "neutral";
}
