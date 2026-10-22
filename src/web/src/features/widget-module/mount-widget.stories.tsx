import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactElement } from "react";
import { expect } from "storybook/test";
import { injectBrandStyle } from "../../../.storybook/decorators";
import {
  appliedOption,
  readyHost,
} from "../widgets/charts/series-chart.fixture";
import { mountWidget } from "./mount-widget";
import { REVENUE_BY_REGION, specLayer } from "./widget-module.fixture";

/**
 * A stand-in host page: its own heading, styled by a rule the play injects
 * into the document (so a document-level leak of the project's preflight
 * would override it and be caught), and the container the module mounts
 * into.
 */
function HostPage(): ReactElement {
  return (
    <>
      <h1>Host page heading</h1>
      <p>The host page's own text, styled by the host alone.</p>
      <div data-mount-container />
    </>
  );
}

function mountContainer(canvasElement: HTMLElement): HTMLDivElement {
  const container = canvasElement.querySelector<HTMLDivElement>(
    "[data-mount-container]",
  );
  if (!container) {
    throw new Error("mount container not rendered");
  }
  return container;
}

const meta = {
  title: "Widget Module/MountWidget",
  // The stories drive `mountWidget` imperatively — there is no component
  // prop to render; each story's play mounts into HostPage's container.
  render: () => <HostPage />,
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** The mounted widget: the chart renders inside the container's shadow root,
 * the host page's own styles untouched. */
export const Mounted: Story = {
  beforeEach: injectBrandStyle("h1 { margin: 20px 0; }"),
  play: async ({ canvasElement }) => {
    const container = mountContainer(canvasElement);
    const heading = canvasElement.querySelector("h1");
    if (!heading) throw new Error("host heading not rendered");
    const hostMargin = getComputedStyle(heading).marginTop;
    expect(hostMargin).not.toBe("0px");

    mountWidget(container, REVENUE_BY_REGION, { layer: specLayer() });

    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("no shadow root on the mount container");
    const host = await readyHost(shadow);
    expect(host.querySelector("canvas")).not.toBeNull();
    expect(shadow.textContent).toContain("Revenue by region");
    // The project's preflight stayed inside the shadow root: the host
    // heading's margin survives the mount.
    expect(getComputedStyle(heading).marginTop).toBe(hostMargin);
  },
};

/** The dark mode mount: the wrapper carries the dark class, so the tokens
 * and the chart read the dark set. */
export const DarkMode: Story = {
  play: async ({ canvasElement }) => {
    const container = mountContainer(canvasElement);

    mountWidget(container, REVENUE_BY_REGION, {
      layer: specLayer(),
      mode: "dark",
    });

    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("no shadow root on the mount container");
    expect(shadow.querySelector("div.dark")).not.toBeNull();
    await readyHost(shadow);
  },
};

/** The tokens stay inside the boundary: a poisoned document token never
 * reaches the widget — the shadow root's stylesheet wins, and the chart's
 * token probe (pointed at the shadow root) reads that value, not the
 * document's. */
export const TokensStayInside: Story = {
  beforeEach: injectBrandStyle(":root { --chart-1: #ff0000; }"),
  play: async ({ canvasElement }) => {
    const container = mountContainer(canvasElement);

    mountWidget(container, REVENUE_BY_REGION, { layer: specLayer() });

    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("no shadow root on the mount container");
    await readyHost(shadow);
    const probe = document.createElement("div");
    probe.className = "light";
    shadow.append(probe);
    expect(getComputedStyle(probe).getPropertyValue("--chart-1").trim()).toBe(
      "#0072b2",
    );
    probe.remove();
    const option = await appliedOption<{ color?: string[] }>(shadow);
    expect(option.color?.[0]).toBe("#0072b2");
  },
};

/** The teardown: unmounts the widget and empties the shadow root, freeing
 * the container for a fresh mount. */
export const TornDown: Story = {
  play: async ({ canvasElement }) => {
    const container = mountContainer(canvasElement);

    const teardown = mountWidget(container, REVENUE_BY_REGION, {
      layer: specLayer(),
    });
    const shadow = container.shadowRoot;
    if (!shadow) throw new Error("no shadow root on the mount container");
    await readyHost(shadow);

    teardown();

    expect(shadow.childElementCount).toBe(0);
  },
};
