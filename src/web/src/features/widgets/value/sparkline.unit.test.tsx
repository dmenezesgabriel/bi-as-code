import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SparklineDisplay } from "./sparkline";

describe("SparklineDisplay", () => {
  const points = [
    { x: 1, y: 10 },
    { x: 2, y: 14 },
    { x: 3, y: 12 },
  ];

  it("renders an svg with role=img and an accessible label", () => {
    const { container } = render(
      <SparklineDisplay points={points} label="Weekly revenue" />,
    );

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("role", "img");
    expect(svg).toHaveAttribute("aria-label", "Weekly revenue");
  });

  it("draws a line through every point", () => {
    const { container } = render(<SparklineDisplay points={points} />);

    const path = container.querySelector("path")!;
    const segments = path.getAttribute("d")!.split("L");
    expect(segments).toHaveLength(points.length);
    expect(segments[0]).toMatch(/^M\s*\d/);
  });

  it("draws a flat line for a single point", () => {
    const { container } = render(
      <SparklineDisplay points={[{ x: 0, y: 5 }]} />,
    );

    const d = container.querySelector("path")!.getAttribute("d")!;
    const ys = d
      .match(/[\d.]+/g)!
      .filter((_, i) => i % 2 === 1)
      .map(Number);
    expect(new Set(ys).size).toBe(1);
  });

  it("fills to the baseline when type is area", () => {
    const { container } = render(
      <SparklineDisplay points={points} type="area" />,
    );

    const path = container.querySelector("path")!;
    expect(path.getAttribute("d")).toContain("Z");
    expect(Number(path.getAttribute("fill-opacity"))).toBeGreaterThan(0);
  });

  it("draws one bar per point when type is bar", () => {
    const { container } = render(
      <SparklineDisplay points={points} type="bar" />,
    );

    expect(container.querySelectorAll("rect")).toHaveLength(points.length);
  });

  it("renders a muted dash when there are no points", () => {
    const { container } = render(<SparklineDisplay points={[]} />);

    expect(container.querySelector("svg")).toBeNull();
    expect(container).toHaveTextContent("–");
  });

  it("takes color as a style override on the currentColor svg", () => {
    const { container } = render(
      <SparklineDisplay points={points} color="tomato" />,
    );

    const span = container.firstElementChild as HTMLElement;
    expect(span.style.color).toBe("tomato");
  });
});
