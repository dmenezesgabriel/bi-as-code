import { Layer } from "effect";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import { REGIONAL_ROWS } from "../widgets/charts/series-chart.fixture";
import type { WidgetSpec } from "./types";

/** The dashboard's `<BarChart data="region_revenue" export="revenue-by-region">` as the build bakes it. */
export const REVENUE_BY_REGION: WidgetSpec = {
  widget: "BarChart",
  props: {
    data: "region_revenue",
    x: "region",
    y: "revenue",
    title: "Revenue by region",
    subtitle: "Sum of order amounts, US dollars",
  },
  sqlBlocks: [
    {
      name: "region_revenue",
      sql: "select region, sum(amount) as revenue\nfrom orders\nwhere {{params.region}} is null or region = {{params.region}}\ngroup by region\norder by region",
    },
  ],
  sqlTables: { orders: "data/orders.parquet" },
  cards: true,
};

/**
 * A fake `DuckDb` layer whose queries return `rows` — the mount's injected
 * port for tests and stories, one fake per caller so rows never leak.
 *
 * @example
 * mountWidget(container, REVENUE_BY_REGION, { layer: specLayer() });
 */
export function specLayer(
  rows: Row[] = REGIONAL_ROWS,
): Layer.Layer<DuckDb, unknown> {
  return Layer.succeed(DuckDb, FakeDuckDb.withRows(rows));
}
