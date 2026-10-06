import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { useEffect, useRef, type ReactElement } from "react";
import { cn } from "../../../lib/cn";
import { useThemeMode } from "../../chrome/theme-mode";
import { themeName } from "./theme";
import type { ChartOption, EChartHostElement, EChartProps } from "./types";

// Modular registration — importing 'echarts/core' + the pieces we use keeps
// the bundle to what cartesian charts need instead of the full engine.
echarts.use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  AriaComponent,
  LabelLayout,
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
 * The echarts engine boundary: mounts an instance on a sized div, applies
 * `option` on every change (`notMerge` — the option is rebuilt wholesale so
 * a removed series never lingers), resizes with the container via
 * ResizeObserver, and disposes on unmount. A mode flip re-inits with the
 * other registered theme — `setTheme` swaps are subtler than a recreate and
 * theme toggles are rare user actions. `data-echarts-ready` marks the first
 * finished paint of the applied option — the option is `setOption`'d in the
 * same synchronous block as `init` because init's own empty paint can emit
 * `finished` first, which would mark a host that carries no data.
 * The host exposes `echartsInstance` for tests.
 *
 * @example
 * <EChart option={toChartOption(toSeries(rows, spec, "bar"), "bar", props)} height={320} />
 */
export function EChart({
  option,
  height = DEFAULT_CHART_HEIGHT,
  renderer = "canvas",
  className,
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
  const appliedOption = useRef<ChartOption | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.removeAttribute("data-echarts-ready");
    const instance = echarts.init(el, themeName(mode), { renderer });
    el.echartsInstance = instance;
    const markReady = () => el.setAttribute("data-echarts-ready", "");
    instance.on("finished", markReady);
    appliedOption.current = optionRef.current;
    instance.setOption(optionRef.current, { notMerge: true });
    const observer = new ResizeObserver(() => {
      if (!instance.isDisposed()) instance.resize();
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.off("finished", markReady);
      delete el.echartsInstance;
      el.removeAttribute("data-echarts-ready");
      instance.dispose();
    };
  }, [mode, renderer]);

  useEffect(() => {
    const instance = hostRef.current?.echartsInstance;
    if (!instance || appliedOption.current === option) return;
    appliedOption.current = option;
    instance.setOption(option, { notMerge: true });
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
