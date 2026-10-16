import { describe, expect, it } from "vitest";
import { LIGHT_CHART_TOKENS } from "./chart-tokens.fixture";
import { FormatError } from "../value/types";
import {
  PALETTE_OVERRIDE_PROPS,
  ariaDescription,
  paletteOverrides,
  tooltipFormatter,
} from "./series-chart.fixture";
import { toHistogram } from "./to-histogram";
import { toHistogramOption } from "./to-histogram-option";

// min 12, max 80; binCount 4 → width 17 → bins [12,29) [29,46) [46,63) [63,80]
const AMOUNTS = [12, 25, 30, 42, 48, 55, 68, 80].map((amount) => ({ amount }));

const REGIONAL = [
  { amount: 12, region: "North" },
  { amount: 25, region: "South" },
  { amount: 30, region: "North" },
  { amount: 42, region: "South" },
];

const PROPS = { data: "q", value: "amount" } as const;

describe("toHistogramOption", () => {
  it("emits stacked gapless bar series over a dense category axis", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount", binCount: 4 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as {
      type?: string;
      data?: unknown[];
      boundaryGap?: boolean;
    };
    expect(xAxis.type).toBe("category");
    expect(xAxis.data).toHaveLength(4);
    expect(xAxis.boundaryGap).toBe(false);
    const series = option.series as {
      type?: string;
      stack?: string;
      barCategoryGap?: number;
      data?: unknown[];
    }[];
    expect(series[0]?.type).toBe("bar");
    expect(series[0]?.stack).toBe("total");
    expect(series[0]?.barCategoryGap).toBe(0);
    expect(series[0]?.data).toEqual([2, 2, 2, 2]);
  });

  it("labels each bin by its valueFmt-formatted start edge", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount", binCount: 4 }),
      { ...PROPS, valueFmt: "usd0" },
      LIGHT_CHART_TOKENS,
    );
    const xAxis = option.xAxis as { data?: unknown[] };
    expect(xAxis.data).toEqual(["$12", "$29", "$46", "$63"]);
  });

  it("keeps integer ticks and a Frequency title on the y axis", () => {
    const option = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount" }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );
    const yAxis = option.yAxis as {
      type?: string;
      minInterval?: number;
      name?: string;
      axisLabel?: { formatter?: (v: unknown) => string };
    };
    expect(yAxis.type).toBe("value");
    expect(yAxis.minInterval).toBe(1);
    expect(yAxis.name).toBe("Frequency");
    // Bare `num` would paint a count of 4 as "4.00"; counts stay integers.
    expect(yAxis.axisLabel?.formatter?.(4)).toBe("4");
    const titled = toHistogramOption(
      toHistogram(AMOUNTS, { value: "amount" }),
      { ...PROPS, yTitle: "Orders" },
      LIGHT_CHART_TOKENS,
    );
    expect((titled.yAxis as { name?: string }).name).toBe("Orders");
  });

  it("titles the axis tooltip with the bin range and rows with counts", () => {
    const option = toHistogramOption(
      toHistogram(REGIONAL, { value: "amount", series: "region", binCount: 2 }),
      { ...PROPS, series: "region", valueFmt: "num0" },
      LIGHT_CHART_TOKENS,
    );
    expect((option.tooltip as { trigger?: string }).trigger).toBe("axis");
    const html = tooltipFormatter(option)([
      { seriesName: "North", marker: "●", value: 2, dataIndex: 0 },
      { seriesName: "South", marker: "○", value: 0, dataIndex: 0 },
    ]);
    expect(html).toContain("12 – 27");
    expect(html).toContain("North");
    expect(html).toContain("South");
    expect(html).toContain("2");
  });

  it("escapes html in tooltip series names", () => {
    const rows = [
      { amount: 1, region: "<b>x</b>" },
      { amount: 2, region: "North" },
    ];
    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", series: "region" }),
      { ...PROPS, series: "region" },
      LIGHT_CHART_TOKENS,
    );
    const html = tooltipFormatter(option)([
      { seriesName: "<b>x</b>", marker: "", value: 1, dataIndex: 0 },
    ]);
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;b&gt;");
  });

  it("shows a legend once the chart has more than one series", () => {
    const model = toHistogram(REGIONAL, { value: "amount", series: "region" });
    expect(
      toHistogramOption(
        model,
        { ...PROPS, series: "region" },
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeDefined();
    expect(
      toHistogramOption(
        model,
        { ...PROPS, series: "region", legend: false },
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
    expect(
      toHistogramOption(
        toHistogram(AMOUNTS, { value: "amount" }),
        PROPS,
        LIGHT_CHART_TOKENS,
      ).legend,
    ).toBeUndefined();
  });

  it("paints a single-color palette and per-series overrides", () => {
    const model = toHistogram(REGIONAL, { value: "amount", series: "region" });
    const colored = toHistogramOption(
      model,
      { ...PROPS, ...PALETTE_OVERRIDE_PROPS },
      LIGHT_CHART_TOKENS,
    );
    expect(paletteOverrides(colored)).toEqual({
      palette: ["#123456"],
      south: "#654321",
      north: undefined,
    });
  });

  it("draws count labels inside the stacked bands when labels is set", () => {
    const option = toHistogramOption(
      toHistogram(REGIONAL, { value: "amount", series: "region" }),
      { ...PROPS, series: "region", labels: true },
      LIGHT_CHART_TOKENS,
    );
    const label = (
      option.series as { label?: { show?: boolean; position?: string } }[]
    )[0]?.label;
    expect(label?.show).toBe(true);
    expect(label?.position).toBe("inside");
  });

  it("describes the chart in the aria label", () => {
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          PROPS,
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount");
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(REGIONAL, { value: "amount", series: "region" }),
          { ...PROPS, series: "region" },
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount, split by region");
    expect(
      ariaDescription(
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          {
            ...PROPS,
            title: "Order size",
          },
          LIGHT_CHART_TOKENS,
        ),
      ),
    ).toBe("histogram chart of amount");
  });

  it.each(["valueFmt", "yFmt", "labelsFmt"] as const)(
    "throws FormatError for a bogus %s code",
    (prop) => {
      expect(() =>
        toHistogramOption(
          toHistogram(AMOUNTS, { value: "amount" }),
          {
            ...PROPS,
            [prop]: "bogus",
          },
          LIGHT_CHART_TOKENS,
        ),
      ).toThrowError(FormatError);
    },
  );
});

describe("toHistogramOption one unit per axis", () => {
  it("formats every bin edge against the bins' whole span", () => {
    // min 0, max 8000; binCount 4 → edges 0, 2000, 4000, 6000
    const rows = [0, 2500, 4500, 8000].map((amount) => ({ amount }));

    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", binCount: 4 }),
      PROPS,
      LIGHT_CHART_TOKENS,
    );

    expect((option.xAxis as { data?: unknown[] }).data).toEqual([
      "0",
      "2k",
      "4k",
      "6k",
    ]);
  });

  it("scales a bare-num count axis by the stacked bin totals", () => {
    // One bin holds 60 North + 60 South — the stack reaches 120, where bare
    // `num` drops its decimal; either series alone (60) would keep one.
    const crowd = ["North", "South"].flatMap((region) =>
      Array.from({ length: 60 }, () => ({ amount: 5, region })),
    );
    const rows = [...crowd, { amount: 10, region: "North" }];

    const option = toHistogramOption(
      toHistogram(rows, { value: "amount", series: "region", binCount: 2 }),
      { ...PROPS, series: "region", yFmt: "num" },
      LIGHT_CHART_TOKENS,
    );
    const yAxis = option.yAxis as {
      axisLabel?: { formatter?: (v: unknown) => string };
    };

    expect(yAxis.axisLabel?.formatter?.(50)).toBe("50");
  });
});
