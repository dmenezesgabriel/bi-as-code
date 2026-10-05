import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect } from "storybook/test";
import { SparklineDisplay } from "./sparkline";
import type { SparklineDisplayProps } from "./sparkline";
import type { SparklinePoint } from "./types";

/** Thirteen weeks of revenue — the `weekly_revenue` demo series shape. */
const POINTS: SparklinePoint[] = [
  980, 1024, 1108, 1051, 1180, 1220, 1175, 1261, 1309, 1288, 1342, 1410, 1488,
].map((v, i) => ({ x: i + 1, y: v }));

const meta = {
  title: "Widgets/SparklineDisplay",
  component: SparklineDisplay,
  args: { points: POINTS, label: "Revenue by week" },
} satisfies Meta<SparklineDisplayProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default line sparkline — one stroked path through all 13 points. */
export const Line: Story = {
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    await expect(svg).toHaveAttribute("role", "img");
    await expect(svg).toHaveAttribute("aria-label", "Revenue by week");
    const d = svg.querySelector("path")!.getAttribute("d")!;
    await expect(d.split("L")).toHaveLength(POINTS.length);
  },
};

/** `type="area"` shades to the baseline under the same line. */
export const Area: Story = {
  args: { type: "area" },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    const paths = svg.querySelectorAll("path");
    await expect(paths).toHaveLength(2);
    await expect(paths.item(0).getAttribute("d")).toContain("Z");
    await expect(
      Number(paths.item(0).getAttribute("fill-opacity")),
    ).toBeGreaterThan(0);
  },
};

/** `type="bar"` draws one rect per point anchored at the baseline. */
export const Bar: Story = {
  args: { type: "bar" },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    await expect(svg.querySelectorAll("rect")).toHaveLength(POINTS.length);
  },
};

/** A series crossing zero fills and bars from the zero line, not the edge. */
export const CrossingZero: Story = {
  args: {
    points: [-4, -2, 1, 5, 3, -1].map((y, i) => ({ x: i, y })),
    type: "area",
  },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector("svg[role='img']"),
    ).toBeInTheDocument();
  },
};

/** A lone point can't slope — it renders as a flat mid-height line. */
export const SinglePoint: Story = {
  args: { points: [{ x: 0, y: 5 }], label: "One week" },
  play: async ({ canvasElement }) => {
    const d = canvasElement
      .querySelector("svg[role='img'] path")!
      .getAttribute("d")!;
    const ys = d
      .match(/[\d.]+/g)!
      .filter((_, i) => i % 2 === 1)
      .map(Number);
    await expect(new Set(ys).size).toBe(1);
  },
};

/** No points: a muted `–`, matching the value widgets' empty face. */
export const Empty: Story = {
  args: { points: [] },
  play: async ({ canvasElement }) => {
    await expect(canvasElement.querySelector("svg[role='img']")).toBeNull();
    await expect(canvasElement).toHaveTextContent("–");
  },
};

/** `color` overrides the muted default — any CSS color works. */
export const CustomColor: Story = {
  args: { color: "#059669" },
  play: async ({ canvasElement }) => {
    const svg = canvasElement.querySelector("svg[role='img']")!;
    const span = svg.parentElement as HTMLElement;
    await expect(span.style.color).toBe("rgb(5, 150, 105)");
  },
};
