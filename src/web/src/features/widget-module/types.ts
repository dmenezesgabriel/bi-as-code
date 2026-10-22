import type { Layer } from "effect";
import type { DuckDb } from "../data/data-service";
import type { SqlBlock, SqlTableMap } from "../pages/types";
import type { SeriesChartProps } from "../widgets/charts/types";

/**
 * The widgets a module can export — one widget per module, the backlog
 * row's contract. Grows as more widgets become exportable.
 */
export type ExportableWidget = "BarChart";

/**
 * What the build bakes into an exported widget module and `mountWidget`
 * consumes: the widget tag's props, the named sql blocks its query depends
 * on (the build computes the transitive closure through `{{queries.*}}`),
 * the `data/…` sources those blocks register, and the page's `cards`
 * setting so the widget looks as it does on its page.
 */
export interface WidgetSpec {
  readonly widget: ExportableWidget;
  readonly props: SeriesChartProps;
  readonly sqlBlocks: readonly SqlBlock[];
  readonly sqlTables: SqlTableMap;
  readonly cards: boolean;
}

/** The colour mode the mounted widget renders in. */
export type MountMode = "light" | "dark";

/**
 * Options of `mountWidget`. `layer` injects the `DuckDb` port — the live
 * DuckDB-WASM layer by default, a fake for tests and stories. `mode` picks
 * the token set the widget renders with.
 */
export interface MountOptions {
  readonly mode?: MountMode;
  readonly layer?: Layer.Layer<DuckDb, unknown>;
}

/** Stops a mount: unmounts the widget and releases its runtime. */
export type MountTeardown = () => void;
