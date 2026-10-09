import { act } from "@testing-library/react";
import type { EChartsType } from "echarts/core";
import { describe, expect, it } from "vitest";
import type { ChartLegendSelectParams, LegendTarget } from "./types";
import {
  legendClause,
  legendSelectTarget,
  useLegendSelect,
} from "./use-legend-select";
import {
  IdleQueryClient,
  renderInteractor,
  TEST_CLAUSE_OPTIONS as OPTIONS,
} from "./chart-interactor.fixture";

const CLIENT = new IdleQueryClient();

const NAMES = ["North", "South", "West"];

/**
 * Legend name → raw cell for a string `region` column — the identity map,
 * the shape `seriesValues` takes for the demo's string-valued fields.
 */
const REGION_VALUES: ReadonlyMap<string, unknown> = new Map(
  NAMES.map((name) => [name, name]),
);

const REGION: LegendTarget = { field: "region", values: REGION_VALUES };

/** A `legendselectchanged` param after `deselected` was toggled off. */
function toggledOff(...deselected: string[]): ChartLegendSelectParams {
  return {
    name: deselected[0],
    selected: Object.fromEntries(
      NAMES.map((name) => [name, !deselected.includes(name)]),
    ),
  };
}

function renderLegendSelect() {
  return renderInteractor("legend", () => useLegendSelect(CLIENT));
}

describe("legendClause", () => {
  it("lists the enabled values as an IN predicate", () => {
    const clause = legendClause("region", ["South", "West"], 3, OPTIONS);
    expect(clause.meta?.type).toBe("list");
    expect(clause.predicate).toEqual({
      sql: "region IN (?, ?)",
      params: ["South", "West"],
    });
  });

  it("emits the clearing clause when every name is enabled", () => {
    const clause = legendClause("region", NAMES, NAMES.length, OPTIONS);
    expect(clause.predicate).toBeNull();
    expect(clause.fields).toEqual(["region"]);
  });

  it("emits the clearing clause when every name is off", () => {
    const clause = legendClause("region", [], NAMES.length, OPTIONS);
    expect(clause.predicate).toBeNull();
    expect(clause.fields).toEqual(["region"]);
  });
});

describe("legendSelectTarget", () => {
  it("targets the series column when series is bound to a single y", () => {
    expect(
      legendSelectTarget({ series: "region", y: "revenue" }, REGION_VALUES),
    ).toEqual(REGION);
  });

  it("targets the series column on a y-less chart (histogram)", () => {
    expect(legendSelectTarget({ series: "region" }, REGION_VALUES)).toEqual(
      REGION,
    );
  });

  it("resolves nothing when series is unbound or y is a list", () => {
    expect(legendSelectTarget({ y: "revenue" }, REGION_VALUES)).toBeUndefined();
    expect(
      legendSelectTarget(
        { series: "region", y: ["revenue", "orders"] },
        REGION_VALUES,
      ),
    ).toBeUndefined();
  });

  it("falls back to legend names when the model carries no value map", () => {
    const target = legendSelectTarget({ series: "region" }, undefined);
    expect(target?.field).toBe("region");
    expect(target?.values.get("North")).toBeUndefined();
  });
});

describe("useLegendSelect", () => {
  it("publishes the enabled names into the field's selection, skipping its own client", () => {
    const { result } = renderLegendSelect();
    const { filters, legend } = result.current;

    act(() => legend.changed(toggledOff("North"), REGION));

    const clauses = filters.selection("region").clauses;
    expect(clauses).toHaveLength(1);
    expect(clauses[0]?.predicate).toEqual({
      sql: "region IN (?, ?)",
      params: ["South", "West"],
    });
    expect(clauses[0]?.clients?.has(CLIENT)).toBe(true);
    expect(filters.selection("region").predicate(CLIENT)).toBeUndefined();
    expect(
      filters.selection("region").predicate(new IdleQueryClient()),
    ).toEqual({
      sql: "region IN (?, ?)",
      params: ["South", "West"],
    });
  });

  it("binds the raw series-column value, not the legend name string", () => {
    const { result } = renderLegendSelect();
    const { filters, legend } = result.current;
    const weeks: LegendTarget = {
      field: "week",
      values: new Map([
        ["1", 1],
        ["2", 2],
        ["3", 3],
      ]),
    };

    act(() =>
      legend.changed(
        { name: "2", selected: { "1": true, "2": false, "3": true } },
        weeks,
      ),
    );

    expect(filters.selection("week").clauses[0]?.predicate).toEqual({
      sql: "week IN (?, ?)",
      params: [1, 3],
    });
  });

  it("clears its clause when every legend name is back on", () => {
    const { result } = renderLegendSelect();
    const { filters, legend } = result.current;

    act(() => legend.changed(toggledOff("North"), REGION));
    expect(filters.selection("region").clauses).toHaveLength(1);
    act(() =>
      legend.changed(
        {
          name: "North",
          selected: {
            North: true,
            South: true,
            West: true,
          },
        },
        REGION,
      ),
    );
    expect(filters.selection("region").clauses).toHaveLength(0);
  });

  it("ignores events carrying no selected map", () => {
    const { result } = renderLegendSelect();
    const { filters, legend } = result.current;

    act(() => legend.changed({ name: "North" }, REGION));
    expect(filters.selection("region").clauses).toHaveLength(0);
  });

  it("re-applies the held legend selection after a repaint", () => {
    const { result } = renderLegendSelect();
    const { legend } = result.current;

    const applied: unknown[] = [];
    const instance = {
      setOption: (option: unknown) => applied.push(option),
    } as unknown as EChartsType;

    // Nothing held yet — the repaint path stays silent.
    act(() => legend.optionApplied(instance));
    expect(applied).toHaveLength(0);

    act(() => legend.changed(toggledOff("North"), REGION));
    act(() => legend.optionApplied(instance));

    expect(applied).toEqual([
      { legend: { selected: { North: false, South: true, West: true } } },
    ]);
  });
});
