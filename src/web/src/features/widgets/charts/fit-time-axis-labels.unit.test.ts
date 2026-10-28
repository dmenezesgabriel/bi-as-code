import * as echarts from "echarts/core";
import type { EChartsType } from "echarts/core";
import { BarChart } from "echarts/charts";
import { GridComponent } from "echarts/components";
import { SVGRenderer } from "echarts/renderers";
import { afterEach, describe, expect, it } from "vitest";
import { LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { fitTimeAxisLabels } from "./fit-time-axis-labels";
import { chartTheme } from "./theme";
import { toChartOption } from "./to-option";
import type { SeriesChartProps, SeriesModel } from "./types";

echarts.use([BarChart, GridComponent, SVGRenderer]);

const MONTHS = Array.from(
  { length: 12 },
  (_, month) => new Date(Date.UTC(2015, month, 1)),
);

function monthlyModel(dates: readonly Date[]): SeriesModel {
  return {
    xDomain: dates,
    xType: "time",
    series: [{ name: "mm", data: dates.map((d, i) => [d, 10 + i]) }],
  };
}

const charts: EChartsType[] = [];
afterEach(() => charts.splice(0).forEach((chart) => chart.dispose()));

/** A real engine laid out server-side at `width` px — no DOM box needed. */
function laidOutChart(
  model: SeriesModel,
  width: number,
  props: Partial<SeriesChartProps> = {},
): EChartsType {
  const chart = echarts.init(null, chartTheme(LIGHT_CHART_TOKENS), {
    renderer: "svg",
    ssr: true,
    width,
    height: 300,
  });
  charts.push(chart);
  const chartProps = { data: "rain", x: "month", y: "mm", ...props };
  chart.setOption(toChartOption(model, "bar", chartProps, LIGHT_CHART_TOKENS));
  return chart;
}

interface XAxisProbe {
  axisLabel?: { customValues?: readonly number[] };
  axisTick?: { customValues?: readonly number[] };
}

function xAxisOf(chart: EChartsType): XAxisProbe | undefined {
  return (chart.getOption() as { xAxis?: XAxisProbe[] }).xAxis?.[0];
}

function shownTicks(chart: EChartsType): readonly number[] {
  return xAxisOf(chart)?.axisLabel?.customValues ?? [];
}

const firstAndLast = [MONTHS[0], MONTHS[11]].map((d) => d?.getTime());

describe("fitTimeAxisLabels", () => {
  it("thins a phone-width axis to an even stride, keeping both ends", () => {
    const chart = laidOutChart(monthlyModel(MONTHS), 375, { xFmt: "mdy" });

    fitTimeAxisLabels(chart);

    const shown = shownTicks(chart);
    expect(shown.length).toBeLessThan(12);
    expect(shown).toEqual(expect.arrayContaining(firstAndLast));
    expect(xAxisOf(chart)?.axisTick?.customValues).toHaveLength(12);
  });

  it("keeps every label on a wide axis", () => {
    const chart = laidOutChart(monthlyModel(MONTHS), 1280, { xFmt: "mdy" });

    fitTimeAxisLabels(chart);

    expect(shownTicks(chart)).toHaveLength(12);
  });

  it("re-thins from every pinned tick after a resize", () => {
    const chart = laidOutChart(monthlyModel(MONTHS), 375, { xFmt: "mdy" });
    fitTimeAxisLabels(chart);

    // A server-side resize given no height lays the grid out at null height.
    chart.resize({ width: 1280, height: 300 });
    fitTimeAxisLabels(chart);

    expect(shownTicks(chart)).toHaveLength(12);
  });

  it("thins the engine's own labels when no xFmt is set", () => {
    const chart = laidOutChart(monthlyModel(MONTHS), 200);

    fitTimeAxisLabels(chart);

    expect(shownTicks(chart).length).toBeLessThan(12);
  });

  it("leaves an axis with no pinned ticks alone", () => {
    const days = Array.from(
      { length: 40 },
      (_, i) => new Date(Date.UTC(2015, 0, i + 1)),
    );
    const chart = laidOutChart(monthlyModel(days), 375);

    fitTimeAxisLabels(chart);

    expect(xAxisOf(chart)?.axisLabel?.customValues).toBeUndefined();
  });

  it("leaves a category axis alone", () => {
    const model: SeriesModel = {
      xDomain: ["North", "South"],
      xType: "category",
      series: [
        {
          name: "mm",
          data: [
            ["North", 1],
            ["South", 2],
          ],
        },
      ],
    };
    const chart = laidOutChart(model, 375);

    fitTimeAxisLabels(chart);

    expect(xAxisOf(chart)?.axisLabel?.customValues).toBeUndefined();
  });

  it("leaves a value axis' pinned ticks alone", () => {
    // A histogram pins round ticks inside its bin edges.
    const chart = echarts.init(null, null, {
      renderer: "svg",
      ssr: true,
      width: 375,
      height: 300,
    });
    charts.push(chart);
    const ticks = [3000, 4000, 5000, 6000];
    chart.setOption({
      xAxis: {
        type: "value",
        min: 2700,
        max: 6300,
        axisTick: { customValues: ticks },
        axisLabel: { customValues: ticks },
      },
      yAxis: { type: "value" },
      series: [{ type: "bar", data: [[4500, 1]] }],
    });

    fitTimeAxisLabels(chart);

    expect(shownTicks(chart)).toEqual(ticks);
  });
});
