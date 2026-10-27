import { render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { EChartsType } from "echarts/core";
import { ThemeModeProvider } from "../../chrome/theme-mode";
import { EChart } from "./echart";

afterEach(() => {
  delete (window.HTMLElement.prototype as { checkVisibility?: unknown })
    .checkVisibility;
  vi.unstubAllGlobals();
});

/** jsdom has no canvas — the svg renderer is the unit-test render path. */
const OPTION = {
  // `finished` (which sets data-echarts-ready) fires only after the entry
  // animation — 1000 ms by default, the same as waitFor's timeout, so an
  // animated chart raced the assertion.
  animation: false,
  xAxis: { type: "category", data: ["North", "South", "West"] },
  yAxis: {},
  series: [{ type: "bar", data: [4800, 3700, 6100] }],
};

function host(container: HTMLElement): HTMLElement {
  const el = container.querySelector<HTMLElement>("[data-echarts-theme]");
  if (!el) throw new Error("chart host not rendered");
  return el;
}

function instanceOf(el: HTMLElement): EChartsType {
  const chart = (el as { echartsInstance?: EChartsType }).echartsInstance;
  if (!chart) throw new Error("echartsInstance not exposed on host");
  return chart;
}

describe("<EChart>", () => {
  it("renders an svg chart in a sized container and marks itself ready", async () => {
    const { container } = render(
      <EChart option={OPTION} renderer="svg" height={260} />,
    );
    const el = host(container);
    expect(el).toHaveStyle({ height: "260px" });
    await waitFor(() => expect(el).toHaveAttribute("data-echarts-ready", ""));
    expect(el.querySelector("svg")).not.toBeNull();
  });

  it("reads time axes on the UTC clock, as the date formats do", async () => {
    const { container } = render(<EChart option={OPTION} renderer="svg" />);
    const el = host(container);
    await waitFor(() => instanceOf(el));

    const applied = instanceOf(el).getOption() as { useUTC?: boolean };

    expect(applied.useUTC).toBe(true);
  });

  it("applies option updates to the live instance", async () => {
    const { container, rerender } = render(
      <EChart option={OPTION} renderer="svg" />,
    );
    const el = host(container);
    await waitFor(() => instanceOf(el));

    const next = {
      ...OPTION,
      series: [{ type: "bar", data: [9, 9, 9] }],
    };
    rerender(<EChart option={next} renderer="svg" />);

    await waitFor(() => {
      const applied = instanceOf(el).getOption() as {
        series: { data: number[] }[];
      };
      expect(applied.series[0]?.data).toEqual([9, 9, 9]);
    });
  });

  it("exposes the instance on the host and disposes it on unmount", async () => {
    const { container, unmount } = render(
      <EChart option={OPTION} renderer="svg" />,
    );
    const el = host(container);
    const chart = await waitFor(() => instanceOf(el));
    unmount();
    expect(chart.isDisposed()).toBe(true);
    expect(
      (el as { echartsInstance?: EChartsType }).echartsInstance,
    ).toBeUndefined();
  });

  it("re-inits with the dark theme when the mode flips", async () => {
    const { container, rerender } = render(
      <ThemeModeProvider mode="light">
        <EChart option={OPTION} renderer="svg" />
      </ThemeModeProvider>,
    );
    const el = host(container);
    const light = await waitFor(() => instanceOf(el));
    expect(el).toHaveAttribute("data-echarts-theme", "light");

    rerender(
      <ThemeModeProvider mode="dark">
        <EChart option={OPTION} renderer="svg" />
      </ThemeModeProvider>,
    );

    await waitFor(() => {
      expect(el).toHaveAttribute("data-echarts-theme", "dark");
      expect(instanceOf(el)).not.toBe(light);
      expect(light.isDisposed()).toBe(true);
    });
  });

  it("defers init until a hidden host reports a real box", async () => {
    // jsdom has no layout or checkVisibility: stub both — the element
    // reports hidden at mount (like an inactive keepMounted tab panel),
    // then the ResizeObserver callback announces a real box on reveal.
    const roCallbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: ResizeObserverCallback) {
          roCallbacks.push(cb);
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    (
      window.HTMLElement.prototype as { checkVisibility?: () => boolean }
    ).checkVisibility = () => false;

    const { container } = render(<EChart option={OPTION} renderer="svg" />);
    const el = host(container);
    expect(el.querySelector("svg")).toBeNull();

    Object.defineProperty(el, "clientWidth", {
      value: 640,
      configurable: true,
    });
    Object.defineProperty(el, "clientHeight", {
      value: 260,
      configurable: true,
    });
    roCallbacks.forEach((cb) => cb([], {} as ResizeObserver));

    await waitFor(() => instanceOf(el));
    expect(el.querySelector("svg")).not.toBeNull();
  });

  it("forwards echarts aria label config onto the host", async () => {
    const { container } = render(
      <EChart
        option={{
          ...OPTION,
          aria: {
            enabled: true,
            label: { description: "Revenue by region" },
          },
        }}
        renderer="svg"
      />,
    );
    const el = host(container);
    await waitFor(() =>
      expect(el).toHaveAttribute("aria-label", "Revenue by region"),
    );
  });
});
