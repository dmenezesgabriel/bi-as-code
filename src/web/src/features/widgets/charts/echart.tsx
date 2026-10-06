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
import { useEffect, useRef, useState, type ReactElement } from "react";
import type { EChartsType } from "echarts/core";
import { cn } from "../../../lib/cn";
import { useThemeMode } from "../../chrome/theme-mode";
import { themeName } from "./theme";
import type { EChartHostElement, EChartProps } from "./types";

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

const DEFAULT_HEIGHT = 300;

/**
 * The echarts engine boundary: mounts an instance on a sized div, applies
 * `option` on every change (`notMerge` — the option is rebuilt wholesale so
 * a removed series never lingers), resizes with the container via
 * ResizeObserver, and disposes on unmount. A mode flip re-inits with the
 * other registered theme — `setTheme` swaps are subtler than a recreate and
 * theme toggles are rare user actions. `data-echarts-ready` marks the first
 * finished paint; the host exposes `echartsInstance` for tests.
 *
 * @example
 * <EChart option={toChartOption(rows, props)} height={320} />
 */
export function EChart({
  option,
  height = DEFAULT_HEIGHT,
  renderer = "canvas",
  className,
}: EChartProps): ReactElement {
  const mode = useThemeMode();
  const hostRef = useRef<EChartHostElement>(null);
  const [chart, setChart] = useState<EChartsType | null>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el) return;
    el.removeAttribute("data-echarts-ready");
    const instance = echarts.init(el, themeName(mode), { renderer });
    el.echartsInstance = instance;
    const markReady = () => el.setAttribute("data-echarts-ready", "");
    instance.on("finished", markReady);
    const observer = new ResizeObserver(() => {
      if (!instance.isDisposed()) instance.resize();
    });
    observer.observe(el);
    setChart(instance);
    return () => {
      observer.disconnect();
      instance.off("finished", markReady);
      delete el.echartsInstance;
      el.removeAttribute("data-echarts-ready");
      instance.dispose();
    };
  }, [mode, renderer]);

  useEffect(() => {
    chart?.setOption(option, { notMerge: true });
  }, [chart, option]);

  return (
    <div
      ref={hostRef}
      className={cn("w-full", className)}
      style={{ height }}
      data-echarts-theme={mode}
    />
  );
}
