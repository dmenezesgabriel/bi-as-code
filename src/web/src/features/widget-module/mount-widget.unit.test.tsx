import { waitFor } from "@testing-library/react";
import type { Layer } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DuckDb } from "../data/data-service";
import { mountWidget } from "./mount-widget";
import type { WidgetSpec } from "./types";
import { REVENUE_BY_REGION, specLayer } from "./widget-module.fixture";

/** The fixture's spec, on the svg seam jsdom renders charts through. */
const SPEC: WidgetSpec = {
  ...REVENUE_BY_REGION,
  props: { ...REVENUE_BY_REGION.props, renderer: "svg" },
};

/**
 * The token reads the chart theme makes, canned: jsdom resolves no
 * stylesheet inside a shadow root, so the probe a shadow-rooted chart
 * reads through would come back empty. The fake answers custom-property
 * reads and delegates everything else to jsdom's own resolution.
 */
const FAKE_TOKENS: Record<string, string> = {
  "--foreground": "#171717",
  "--muted-foreground": "#525252",
  "--chart-axis": "#a1a1a1",
  "--border": "#e5e5e5",
  "--background": "#ffffff",
  "--popover": "#ffffff",
  "--popover-border": "#e5e5e5",
  "--chart-label-inside": "#ffffff",
  "--chart-1": "#0072b2",
  "--chart-2": "#d55e00",
  "--chart-3": "#009e73",
  "--chart-4": "#cc79a7",
  "--chart-5": "#8800ff",
  "--chart-6": "#773311",
  "--chart-7": "#4433aa",
  "--chart-8": "#bb55ff",
  "--chart-scale": "#0072b2",
  "--body-font": "ui-sans-serif, system-ui, sans-serif",
};

function stubShadowTokens(): void {
  const real = window.getComputedStyle.bind(window);
  vi.stubGlobal("getComputedStyle", (element: Element) => {
    const declared = real(element);
    return new Proxy(declared, {
      get(target, property) {
        if (property === "getPropertyValue") {
          return (name: string) =>
            name.startsWith("--")
              ? (FAKE_TOKENS[name] ?? "")
              : target.getPropertyValue(name);
        }
        const value = Reflect.get(target, property) as unknown;
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
}

function mountedContainer(
  spec: WidgetSpec = SPEC,
  layer: Layer.Layer<DuckDb, unknown> = specLayer(),
): { container: HTMLDivElement; teardown: () => void } {
  const container = document.createElement("div");
  document.body.append(container);
  return { container, teardown: mountWidget(container, spec, { layer }) };
}

describe("mountWidget", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("mounts the named widget with its query's rows inside a shadow root", async () => {
    stubShadowTokens();
    const { container, teardown } = mountedContainer();

    const shadow = container.shadowRoot;
    expect(shadow).not.toBeNull();
    await waitFor(() => expect(shadow?.querySelector("svg")).not.toBeNull());
    expect(shadow?.textContent).toContain("Revenue by region");

    teardown();
    container.remove();
  });

  it("leaves the container's light DOM untouched and wraps content in the mode class", () => {
    const container = document.createElement("div");
    const marker = document.createElement("p");
    marker.textContent = "host content";
    container.append(marker);
    document.body.append(container);

    const teardown = mountWidget(container, SPEC, {
      layer: specLayer(),
    });

    const shadow = container.shadowRoot;
    expect(shadow?.querySelector("div.light")).not.toBeNull();
    expect(shadow?.querySelector("style")).not.toBeNull();
    expect(container.childElementCount).toBe(1);
    expect(container.querySelector("p")?.textContent).toBe("host content");

    teardown();
    container.remove();
  });

  it("wraps dark-mode mounts in the dark class", () => {
    const { container, teardown } = mountedContainer();

    expect(container.shadowRoot?.querySelector("div.dark")).toBeNull();
    teardown();

    const second = mountWidget(container, SPEC, {
      layer: specLayer(),
      mode: "dark",
    });
    expect(container.shadowRoot?.querySelector("div.dark")).not.toBeNull();
    second();
    container.remove();
  });

  it("refuses a second mount while one is live on the container", () => {
    const { container, teardown } = mountedContainer();

    expect(() => mountWidget(container, SPEC, { layer: specLayer() })).toThrow(
      "mountWidget: the container already hosts a mounted widget — call the previous mount's teardown first",
    );

    teardown();
    container.remove();
  });

  it("teardown empties the shadow root and frees the container for a fresh mount", async () => {
    stubShadowTokens();
    const { container, teardown } = mountedContainer();
    await waitFor(() =>
      expect(container.shadowRoot?.querySelector("svg")).not.toBeNull(),
    );

    teardown();

    expect(container.shadowRoot?.childElementCount).toBe(0);
    const second = mountWidget(container, SPEC, {
      layer: specLayer(),
    });
    second();
    container.remove();
  });

  it("names an unknown widget in its error", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const bad = { ...SPEC, widget: "Table" } as unknown as WidgetSpec;

    expect(() => mountWidget(container, bad, { layer: specLayer([]) })).toThrow(
      "unknown exportable widget: Table — expected one of: BarChart",
    );

    container.remove();
  });
});
