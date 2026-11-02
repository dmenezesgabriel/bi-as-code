import { expect } from "storybook/test";
import {
  withPageFilters,
  withQueryData,
} from "../../../../.storybook/decorators";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import {
  OPTS,
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
  appliedOption,
  dbSelectable,
} from "./series-chart.fixture";

/** A format-code probe: a formatter the applied option carries. */
export interface FormatterProbe {
  formatter?: (value: number) => string;
}

/** One series holding `points` data items — a query's rows drawn once. */
export async function expectSinglePlainSeries(
  root: ParentNode,
  points: number,
): Promise<void> {
  const option = await appliedOption<{ series?: { data?: unknown[] }[] }>(root);
  expect(option.series).toHaveLength(1);
  expect(option.series?.[0]?.data).toHaveLength(points);
}

/** A list `y` draws each column as its own unstacked series, named in one legend. */
export async function expectMeasureSeries(
  root: ParentNode,
  names: string[],
): Promise<void> {
  const option = await appliedOption<{
    series?: { name?: string; stack?: string }[];
    legend?: unknown[];
  }>(root);
  expect(option.series?.map((s) => s.name)).toEqual(names);
  expect(option.series?.every((s) => s.stack === undefined)).toBe(true);
  expect(option.legend).toHaveLength(1);
}

/** `stacked="100%"` pins the value axis to 0–1. */
export async function expectSharesAxis(root: ParentNode): Promise<void> {
  const option = await appliedOption<{ yAxis?: { max?: number }[] }>(root);
  expect(option.yAxis?.[0]?.max).toBe(1);
}

/** `labelsFmt` leaves labels shown with a formatter of their own. */
export async function expectLabelFormatter(root: ParentNode): Promise<void> {
  const option = await appliedOption<{
    series?: { label?: FormatterProbe & { show?: boolean } }[];
  }>(root);
  expect(option.series?.[0]?.label?.show).toBe(true);
  expect(option.series?.[0]?.label?.formatter).toBeDefined();
}

/** `yFmt="usd0"` formats the value axis' ticks. */
export async function expectUsdAxisTicks(root: ParentNode): Promise<void> {
  const option = await appliedOption<{
    yAxis?: { axisLabel?: FormatterProbe }[];
  }>(root);
  expect(option.yAxis?.[0]?.axisLabel?.formatter?.(4000)).toBe("$4,000");
}

/** The chart's error alert names every one of `terms`. */
export async function expectAlertNaming(
  canvas: { findByRole: (role: string) => Promise<HTMLElement> },
  ...terms: string[]
): Promise<void> {
  const alert = await canvas.findByRole("alert");
  for (const term of terms) await expect(alert).toHaveTextContent(term);
}

/** A query with no rows draws "0 rows" in the chart's place. */
export async function expectNoRowsFace(canvas: {
  findByText: (text: string) => Promise<HTMLElement>;
}): Promise<void> {
  await expect(await canvas.findByText("0 rows")).toBeInTheDocument();
}

/** `labels` leaves the first series' point labels shown. */
export async function expectLabelsShown(root: ParentNode): Promise<void> {
  const option = await appliedOption<{
    series?: { label?: { show?: boolean } }[];
  }>(root);
  expect(option.series?.[0]?.label?.show).toBe(true);
}

/** `stacked` draws every series as `type` on the one shared `total` stack. */
export async function expectTotalStack(
  root: ParentNode,
  type: string,
): Promise<void> {
  const option = await appliedOption<{
    series?: { type?: string; stack?: string }[];
  }>(root);
  expect(option.series?.every((s) => s.type === type)).toBe(true);
  expect(option.series?.every((s) => s.stack === "total")).toBe(true);
}

/** The `select="crossfilter"` scene: a regional chart fence plus the `opts` consumer fence. */
export const REGIONAL_CROSSFILTER_DECORATORS = [
  withQueryData([ORDERS_REGIONAL, OPTS], dbSelectable("region", REGIONAL_ROWS)),
  withPageFilters(new FakeFilterUrlPort("")),
];
