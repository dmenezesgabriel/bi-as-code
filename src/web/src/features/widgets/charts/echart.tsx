import * as echarts from "echarts/core";
import type { EChartsType } from "echarts/core";
import {
  BarChart,
  HeatmapChart,
  LineChart,
  ScatterChart,
} from "echarts/charts";
import {
  AriaComponent,
  BrushComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { useEffect, useRef, type ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { useThemeMode } from "../../chrome/theme-mode";
import type { ThemeMode } from "../../chrome/theme";
import { themeName } from "./theme";
import type {
  ChartBrushEndParams,
  ChartBrushSelectedParams,
  ChartClickParams,
  ChartOption,
  ChartRenderer,
  EChartHostElement,
  EChartProps,
} from "./types";

// Modular registration — importing 'echarts/core' + the pieces we use keeps
// the bundle to what cartesian charts need instead of the full engine.
echarts.use([
  BarChart,
  LineChart,
  ScatterChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  AriaComponent,
  LabelLayout,
  VisualMapComponent,
  BrushComponent,
  ToolboxComponent,
  CanvasRenderer,
  SVGRenderer,
]);

/**
 * The host height when the author doesn't set one — also the height the
 * chart widgets size their loading/error/empty faces to, so a state's box
 * reserves the pixels the canvas would claim.
 */
export const DEFAULT_CHART_HEIGHT = 300;

/**
 * Mounts an echarts instance on a host that has a real box: the ready
 * listener attaches before `setOption` because init's own empty paint can
 * emit `finished` first, which would mark a host that carries no data.
 *
 * @example
 * el.echartsInstance = mountChart(el, option, mode, "canvas");
 */
function mountChart(
  el: EChartHostElement,
  option: ChartOption,
  mode: ThemeMode,
  renderer: ChartRenderer,
  eventsRef: { readonly current: EChartProps["events"] },
): EChartsType {
  const instance = echarts.init(el, themeName(mode), { renderer });
  instance.on("finished", () => el.setAttribute("data-echarts-ready", ""));
  // The ref delegates to the latest `events` prop so a handler that changes
  // identity between renders never resubscribes, and a re-init (theme flip)
  // rewires against the same delegate.
  instance.on("click", (params) =>
    eventsRef.current?.click?.(params as ChartClickParams),
  );
  instance.on("brushSelected", (params) =>
    eventsRef.current?.brushSelected?.(params as ChartBrushSelectedParams),
  );
  instance.on("brushEnd", (params) =>
    eventsRef.current?.brushEnd?.(params as ChartBrushEndParams),
  );
  instance.setOption(option, { notMerge: true });
  eventsRef.current?.optionApplied?.(instance);
  return instance;
}

/**
 * The echarts engine boundary: mounts an instance on a sized div, applies
 * `option` on every change (`notMerge` — the option is rebuilt wholesale so
 * a removed series never lingers), resizes with the container via
 * ResizeObserver, and disposes on unmount. A host mounted inside a
 * `display:none` subtree (an inactive tab panel, a `hidden=until-found`
 * accordion body) has no box: init there warns and paints at 0×0, so init
 * defers to the first ResizeObserver report of a real box. jsdom has no
 * `checkVisibility`, so the deferral never engages under unit tests.
 * A mode flip re-inits with the other registered theme — `setTheme` swaps
 * are subtler than a recreate and theme toggles are rare user actions.
 * `data-echarts-ready` marks the first finished paint of the applied
 * option — the option is `setOption`'d in the same synchronous block as
 * `init` because init's own empty paint can emit `finished` first, which
 * would mark a host that carries no data. The host exposes
 * `echartsInstance` for tests.
 *
 * @example
 * <EChart option={toChartOption(toSeries(rows, spec, "bar"), "bar", props)} height={320} />
 */
export function EChart({
  option,
  height = DEFAULT_CHART_HEIGHT,
  renderer = "canvas",
  className,
  events,
}: EChartProps): ReactElement {
  const mode = useThemeMode();
  const hostRef = useRef<EChartHostElement>(null);
  // The init effect's deps exclude `option` (a changed option must not
  // re-init the engine), so it reads the latest through a ref — synced in
  // an effect declared first, because mutating a ref during render is
  // unsound (React can replay or discard uncommitted render work).
  const optionRef = useRef(option);
  useEffect(() => {
    optionRef.current = option;
  });
  const eventsRef = useRef<EChartProps["events"]>(events);
  useEffect(() => {
    eventsRef.current = events;
  });
  const appliedOption = useRef<ChartOption | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.removeAttribute("data-echarts-ready");
    const init = () => {
      el.echartsInstance = mountChart(
        el,
        optionRef.current,
        mode,
        renderer,
        eventsRef,
      );
      appliedOption.current = optionRef.current;
    };
    // display:none hosts (an inactive keepMounted tab panel, a
    // hidden=until-found accordion body) have no box — echarts warns on a
    // 0×0 init, so defer to the first nonzero ResizeObserver report.
    // jsdom has no checkVisibility: the deferral can't engage, unit tests
    // init eagerly.
    const hidden =
      typeof el.checkVisibility === "function" && !el.checkVisibility();
    if (!hidden) init();
    const observer = new ResizeObserver(() => {
      const chart = el.echartsInstance;
      if (!chart) {
        if (el.clientWidth > 0 && el.clientHeight > 0) init();
        return;
      }
      if (!chart.isDisposed()) chart.resize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      const chart = el.echartsInstance;
      if (!chart) return;
      chart.off("finished");
      delete el.echartsInstance;
      el.removeAttribute("data-echarts-ready");
      chart.dispose();
    };
  }, [mode, renderer]);

  useEffect(() => {
    const instance = hostRef.current?.echartsInstance;
    if (!instance || appliedOption.current === option) return;
    appliedOption.current = option;
    instance.setOption(option, { notMerge: true });
    eventsRef.current?.optionApplied?.(instance);
  }, [option]);

  return (
    <div
      ref={hostRef}
      className={cn("w-full", className)}
      style={{ height }}
      data-echarts-theme={mode}
    />
  );
}
