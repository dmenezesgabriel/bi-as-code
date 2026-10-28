import { describe, expect, it } from "vitest";
import {
  PINNED_TICK_LIMIT,
  pinnedTimeTicks,
  thinTimeLabels,
} from "./time-ticks";
import type { PlacedTimeLabel } from "./types";

const quarters = [0, 3, 6, 9].map(
  (month) => new Date(Date.UTC(2015, month, 1)),
);

/** `count` labels `width` px wide, evenly `pitch` px apart from x = 0. */
function evenLabels(
  count: number,
  pitch: number,
  width: number,
): PlacedTimeLabel[] {
  return Array.from({ length: count }, (_, i) => ({
    tick: i,
    x: i * pitch,
    width,
  }));
}

describe("pinnedTimeTicks", () => {
  it("pins one tick per distinct date", () => {
    const ticks = pinnedTimeTicks(quarters);

    expect(ticks).toEqual(quarters.map((d) => d.getTime()));
  });

  it("sorts and dedupes the dates, skipping empty cells", () => {
    const [q1, q2] = [Date.UTC(2015, 0, 1), Date.UTC(2015, 3, 1)];
    const domain = [new Date(q2), null, new Date(q1), new Date(q2)];

    const ticks = pinnedTimeTicks(domain);

    expect(ticks).toEqual([q1, q2]);
  });

  it("pins nothing on an axis with no dates", () => {
    const ticks = pinnedTimeTicks([null]);

    expect(ticks).toBeUndefined();
  });

  it("leaves a dense axis to the engine's own ticks", () => {
    const days = Array.from(
      { length: PINNED_TICK_LIMIT + 1 },
      (_, i) => new Date(Date.UTC(2015, 0, i + 1)),
    );

    const ticks = pinnedTimeTicks(days);

    expect(ticks).toBeUndefined();
  });
});

describe("thinTimeLabels", () => {
  it("keeps every label that fits", () => {
    const labels = evenLabels(12, 60, 30);

    const kept = thinTimeLabels(labels);

    expect(kept).toHaveLength(12);
  });

  it("keeps every other label when only half fit", () => {
    const labels = evenLabels(13, 25, 30);

    const kept = thinTimeLabels(labels);

    expect(kept).toEqual([0, 2, 4, 6, 8, 10, 12]);
  });

  it("keeps the first and last label at any width", () => {
    const labels = evenLabels(12, 5, 40);

    const kept = thinTimeLabels(labels);

    expect(kept).toEqual([0, 11]);
  });

  it("drops a stride pick that would crowd the last label", () => {
    const labels = evenLabels(12, 25, 30);

    const kept = thinTimeLabels(labels);

    expect(kept).toEqual([0, 2, 4, 6, 8, 11]);
  });

  it("drops a label that sits on its neighbour though the count fits", () => {
    const labels: PlacedTimeLabel[] = [
      { tick: 0, x: 0, width: 30 },
      { tick: 1, x: 100, width: 30 },
      { tick: 2, x: 110, width: 30 },
      { tick: 3, x: 300, width: 30 },
    ];

    const kept = thinTimeLabels(labels);

    expect(kept).toEqual([0, 1, 3]);
  });
});
