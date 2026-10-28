import type { PlacedTimeLabel } from "./types";

/**
 * Most distinct dates a time axis pins a tick to. Up to here a label per
 * point reads as the chart's own rhythm (four quarters → four ticks, not the
 * engine's twelve months); past it the engine's round calendar ticks read
 * better than a crowd of pins.
 */
export const PINNED_TICK_LIMIT = 15;

// The clear space a label wants on each side when the stride is chosen, and
// the tighter gap below which two placed labels count as touching. Two
// thresholds, so the collision pass only drops labels that really collide.
const STRIDE_GAP_PX = 8;
const COLLISION_GAP_PX = 4;

/**
 * The epoch-ms positions a time axis pins its ticks and labels to: every
 * distinct date in `xDomain`, ascending — or `undefined` when there is none
 * or more than `PINNED_TICK_LIMIT`, leaving the engine to place its own.
 *
 * @example
 * pinnedTimeTicks([new Date("2015-04-01"), new Date("2015-01-01")])
 * // [Date.UTC(2015, 0, 1), Date.UTC(2015, 3, 1)]
 */
export function pinnedTimeTicks(
  xDomain: readonly unknown[],
): readonly number[] | undefined {
  const epochs = xDomain
    .filter((cell): cell is Date => cell instanceof Date)
    .map((date) => date.getTime());
  const ticks = [...new Set(epochs)].sort((a, b) => a - b);
  const pinnable = ticks.length > 0 && ticks.length <= PINNED_TICK_LIMIT;
  return pinnable ? ticks : undefined;
}

/**
 * The ticks whose labels stay shown once laid out at their pixel positions:
 * every k-th (the smallest stride whose labels fit the span, so the axis
 * keeps a steady calendar rhythm), the first and last always — they carry
 * the axis' range — then any label still touching one already kept is
 * dropped, since pinned dates need not sit evenly apart.
 *
 * @example
 * thinTimeLabels([{ tick: 1, x: 0, width: 30 }, { tick: 2, x: 10, width: 30 }, { tick: 3, x: 90, width: 30 }])
 * // [1, 3]
 */
export function thinTimeLabels(
  labels: readonly PlacedTimeLabel[],
): readonly number[] {
  const sorted = [...labels].sort((a, b) => a.x - b.x);
  const candidates = strideCandidates(sorted);
  const last = sorted.length - 1;
  const priority = [0, last, ...candidates.filter((i) => i > 0 && i < last)];
  const kept: PlacedTimeLabel[] = [];
  for (const i of priority) {
    const label = sorted[i];
    if (label !== undefined && !kept.some((k) => touches(label, k)))
      kept.push(label);
  }
  return kept.sort((a, b) => a.x - b.x).map((label) => label.tick);
}

/**
 * Indexes of every k-th label, as if the labels sat evenly across the span.
 * A pick within half a stride of the last label is dropped so the closing
 * label never gains a crowded neighbour.
 */
function strideCandidates(sorted: readonly PlacedTimeLabel[]): number[] {
  const last = sorted.length - 1;
  const span = (sorted[last]?.x ?? 0) - (sorted[0]?.x ?? 0);
  const widest = Math.max(...sorted.map((label) => label.width));
  const fit = Math.max(2, Math.floor(span / (widest + STRIDE_GAP_PX)) + 1);
  if (fit > last) return sorted.map((_, i) => i);
  const stride = Math.ceil(last / (fit - 1));
  const picks = sorted
    .map((_, i) => i)
    .filter((i) => i % stride === 0 && last - i > Math.ceil(stride / 2));
  return [...picks, last];
}

function touches(a: PlacedTimeLabel, b: PlacedTimeLabel): boolean {
  return Math.abs(a.x - b.x) < (a.width + b.width) / 2 + COLLISION_GAP_PX;
}
