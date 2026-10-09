import { act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { EChartsType } from "echarts/core";
import type { ChartClickParams } from "./types";
import {
  dimSeriesData,
  nextPointValues,
  pointSelectClause,
  usePointSelect,
} from "./use-point-select";
import {
  IdleQueryClient,
  renderInteractor,
  TEST_CLAUSE_OPTIONS as OPTIONS,
} from "./chart-interactor.fixture";

const CLIENT = new IdleQueryClient();

/** A series-mark click param in the shape echarts hands a `click` listener. */
function seriesClick(
  x: unknown,
  init?: { shift?: boolean; meta?: boolean },
): ChartClickParams {
  return {
    componentType: "series",
    value: [x, 6100],
    event: {
      event: { shiftKey: init?.shift ?? false, metaKey: init?.meta ?? false },
    },
  };
}

function renderPointSelect(field: string | undefined) {
  return renderInteractor("point", () => usePointSelect(field, CLIENT));
}

/** A mounted point interactor plus a `click` that plays a mark click inside `act`. */
function pointSelectScene(field: string) {
  const { result } = renderPointSelect(field);
  const { filters, point } = result.current;
  const click = (x: unknown, init?: { shift?: boolean; meta?: boolean }) =>
    act(() => point.click?.(seriesClick(x, init)));
  return { filters, click, point };
}

describe("nextPointValues", () => {
  it("plain clicks replace the held selection, click-same clears it", () => {
    expect(nextPointValues([], "West", false)).toEqual(["West"]);
    expect(nextPointValues(["West"], "North", false)).toEqual(["North"]);
    expect(nextPointValues(["West"], "West", false)).toEqual([]);
    // A plain click on a member of a multi-select narrows to it alone —
    // only the lone selected point clears on a plain click.
    expect(nextPointValues(["West", "North"], "West", false)).toEqual(["West"]);
  });

  it("shift/meta clicks toggle the point in and out of the held list", () => {
    expect(nextPointValues([], "West", true)).toEqual(["West"]);
    expect(nextPointValues(["West"], "North", true)).toEqual(["West", "North"]);
    expect(nextPointValues(["West", "North"], "West", true)).toEqual(["North"]);
    expect(nextPointValues(["West", "North"], "South", true)).toEqual([
      "West",
      "North",
      "South",
    ]);
  });

  it("sees two equal-instant dates as the same point", () => {
    const a = new Date("2026-01-05T00:00:00Z");
    const b = new Date("2026-01-05T00:00:00Z");
    expect(nextPointValues([a], b, false)).toEqual([]);
    expect(
      nextPointValues([a], new Date("2026-01-06T00:00:00Z"), true),
    ).toEqual([a, new Date("2026-01-06T00:00:00Z")]);
  });
});

describe("pointSelectClause", () => {
  it("emits a point clause for one value and a list clause for several", () => {
    const point = pointSelectClause("region", ["West"], OPTIONS);
    expect(point.meta?.type).toBe("point");
    expect(point.predicate).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
    const list = pointSelectClause("region", ["West", "North"], OPTIONS);
    expect(list.meta?.type).toBe("list");
    expect(list.predicate).toEqual({
      sql: "region IN (?, ?)",
      params: ["West", "North"],
    });
  });

  it("emits a predicate-less clause carrying the field when the selection cleared", () => {
    const clause = pointSelectClause("region", [], OPTIONS);
    expect(clause.predicate).toBeNull();
    expect(clause.fields).toEqual(["region"]);
  });
});

describe("dimSeriesData", () => {
  it("wraps non-matching marks at the mosaic dim, keeping selected marks bare", () => {
    const data = [
      ["West", 6100],
      ["North", 4800],
      ["South", 3700],
    ];
    expect(dimSeriesData(data, ["West"])).toEqual([
      ["West", 6100],
      {
        value: ["North", 4800],
        itemStyle: { opacity: 0.2 },
        label: { opacity: 0.2 },
      },
      {
        value: ["South", 3700],
        itemStyle: { opacity: 0.2 },
        label: { opacity: 0.2 },
      },
    ]);
  });

  it("unwraps wrapped items once the selection clears", () => {
    const dimmed = [
      ["West", 6100],
      { value: ["North", 4800], itemStyle: { opacity: 0.2 } },
    ];
    expect(dimSeriesData(dimmed, [])).toEqual([
      ["West", 6100],
      ["North", 4800],
    ]);
  });

  it("leaves non-tuple items (bare counts) alone", () => {
    expect(dimSeriesData([12, 30], ["West"])).toEqual([12, 30]);
  });

  it("sees equal-instant dates as matching marks", () => {
    const a = new Date("2026-01-05T00:00:00Z");
    const b = new Date("2026-01-05T00:00:00Z");
    const data = [
      [a, 1],
      [new Date("2026-01-06T00:00:00Z"), 2],
    ];
    const dimmed = dimSeriesData(data, [b]);
    expect(dimmed[0]).toEqual([a, 1]);
    expect(dimmed[1]).toMatchObject({ itemStyle: { opacity: 0.2 } });
  });
});

describe("usePointSelect", () => {
  it("returns no handler without a bound field", () => {
    const { result } = renderPointSelect(undefined);
    expect(result.current.point.click).toBeUndefined();
  });

  it("publishes the clicked mark's x into the field's selection, skipping its own client", () => {
    const { filters, click } = pointSelectScene("region");
    click("West");

    const clauses = filters.selection("region").clauses;
    expect(clauses).toHaveLength(1);
    const clause = clauses[0]!;
    expect(clause.predicate).toEqual({ sql: "region = ?", params: ["West"] });
    expect(clause.clients?.has(CLIENT)).toBe(true);
    // The publisher's own client is skipped; every other client is narrowed.
    expect(filters.selection("region").predicate(CLIENT)).toBeUndefined();
    expect(
      filters.selection("region").predicate(new IdleQueryClient()),
    ).toEqual({
      sql: "region = ?",
      params: ["West"],
    });
  });

  it("keeps one clause per source: a second plain click replaces, click-same clears", () => {
    const { filters, click } = pointSelectScene("region");

    click("West");
    click("North");
    expect(filters.selection("region").clauses).toHaveLength(1);
    expect(filters.selection("region").clauses[0]?.value).toBe("North");

    click("North");
    expect(filters.selection("region").clauses).toHaveLength(0);
  });

  it("accumulates shift clicks into a list clause and toggles a second shift click off", () => {
    const { filters, click } = pointSelectScene("region");

    click("West");
    click("North", { shift: true });
    const clause = filters.selection("region").clauses[0];
    expect(clause?.meta?.type).toBe("list");
    expect(clause?.value).toEqual(["West", "North"]);

    click("West", { shift: true });
    // Back to one point — the clause re-narrows to a `=` point clause.
    const lone = filters.selection("region").clauses[0];
    expect(lone?.meta?.type).toBe("point");
    expect(lone?.value).toBe("North");
  });

  it("ignores non-series clicks and marks without a datum x", () => {
    const { result } = renderPointSelect("region");
    const { filters, point } = result.current;

    act(() => point.click?.({ componentType: "legend", value: ["West", 1] }));
    act(() => point.click?.(seriesClick(null)));
    expect(filters.selection("region").clauses).toHaveLength(0);
  });

  it("dims non-selected marks on the live instance, re-dimming after a repaint", () => {
    const { click, point } = pointSelectScene("region");

    const applied: unknown[] = [];
    const instance = {
      getOption: () => ({
        series: [
          {
            data: [
              ["West", 6100],
              ["North", 4800],
            ],
          },
        ],
      }),
      setOption: (option: unknown) => applied.push(option),
    } as unknown as EChartsType;
    // `optionApplied` runs at mount, stashing the instance a click dims.
    act(() => point.optionApplied(instance));
    click("West");

    expect(applied).toEqual([
      {
        series: [
          {
            data: [
              ["West", 6100],
              {
                value: ["North", 4800],
                itemStyle: { opacity: 0.2 },
                label: { opacity: 0.2 },
              },
            ],
          },
        ],
      },
    ]);

    // A repaint rebuilds the option undimmed; `optionApplied` restores
    // the held selection's dim — the same seam the brush's areas ride.
    applied.length = 0;
    act(() => point.optionApplied(instance));
    expect(applied).toHaveLength(1);

    // Clearing merges the bare tuples back.
    applied.length = 0;
    click("West");
    expect(applied).toEqual([
      {
        series: [
          {
            data: [
              ["West", 6100],
              ["North", 4800],
            ],
          },
        ],
      },
    ]);
  });
});
