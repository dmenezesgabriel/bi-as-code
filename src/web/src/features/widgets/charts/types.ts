import type { EChartsCoreOption, EChartsType } from "echarts/core";

/**
 * The option bag `<EChart>` hands to `setOption` — re-exported from
 * `echarts/core` so chart widgets and callers never import `echarts`
 * themselves (dep-cruiser confines the engine to this directory).
 */
export type ChartOption = EChartsCoreOption;

/** Render backend: `canvas` in the app, `svg` under jsdom (no canvas 2d). */
export type ChartRenderer = "canvas" | "svg";

/**
 * Props of the `<EChart>` engine wrapper: `option` is the full echarts
 * option (series included — updates are applied with `notMerge` so a
 * rebuilt option never leaves stale series); `height` sizes the host in px;
 * `renderer` selects the backend.
 */
export interface EChartProps {
  readonly option: ChartOption;
  readonly height?: number;
  readonly renderer?: ChartRenderer;
  readonly className?: string;
}

/**
 * The chart host node carries the live instance so browser tests can read
 * `getOption()`/`convertToPixel` — the same hook evidence exposes on its
 * wrapper element.
 */
export type EChartHostElement = HTMLDivElement & {
  echartsInstance?: EChartsType;
};
