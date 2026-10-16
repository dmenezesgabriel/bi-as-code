import type { SeriesChartProps } from "./types";

/** The tag props every chart kind hands `BoundChart` unchanged. */
type ChartFrameProps = Pick<
  SeriesChartProps,
  "data" | "title" | "subtitle" | "height" | "filters"
>;

/**
 * Picks the frame's share of a chart tag's props — the `data` fence, the
 * text above the plot, the host height and the page filters — so each
 * chart kind spreads one bag instead of repeating the list.
 *
 * @example
 * <BoundChart {...chartFrameProps(props)} renderer={renderer} model={…} option={…} />
 */
export function chartFrameProps(props: ChartFrameProps): ChartFrameProps {
  return {
    data: props.data,
    title: props.title,
    subtitle: props.subtitle,
    height: props.height,
    filters: props.filters,
  };
}
