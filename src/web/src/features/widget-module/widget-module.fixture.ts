import { Layer } from "effect";
import { DuckDb } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { Row } from "../data/types";
import {
  ORDERS_REGIONAL,
  REGIONAL_ROWS,
} from "../widgets/charts/series-chart.fixture";
import type { WidgetSpec } from "./types";

/** The dashboard's `<BarChart data="region_revenue">` as the build would bake it. */
export const REVENUE_BY_REGION: WidgetSpec = {
  widget: "BarChart",
  props: {
    data: "orders",
    x: "region",
    y: "revenue",
    title: "Revenue by region",
    subtitle: "Sum of order amounts, US dollars",
  },
  sqlBlocks: [ORDERS_REGIONAL],
  sqlTables: { orders: "data/orders.csv" },
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
