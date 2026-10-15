import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DeltaDisplay } from "./delta-display";
import { deltaStatus } from "./delta-status";

describe("deltaStatus", () => {
  it("defaults to a zero-width band — only exactly 0 is neutral", () => {
    expect(deltaStatus(0)).toBe("neutral");
    expect(deltaStatus(0.001)).toBe("positive");
    expect(deltaStatus(-0.001)).toBe("negative");
  });

  it("is neutral inside the range inclusive, signed outside it", () => {
    const band = [-0.5, 0.5] as const;
    expect(deltaStatus(-0.5, band)).toBe("neutral");
    expect(deltaStatus(0.5, band)).toBe("neutral");
    expect(deltaStatus(0.51, band)).toBe("positive");
    expect(deltaStatus(-0.51, band)).toBe("negative");
  });

  it("treats a null bound as infinite", () => {
    expect(deltaStatus(-1e9, [null, 0])).toBe("neutral");
    expect(deltaStatus(0.01, [null, 0])).toBe("positive");
    expect(deltaStatus(1e9, [0, null])).toBe("neutral");
    expect(deltaStatus(-0.01, [0, null])).toBe("negative");
  });

  it("is neutral for anything that is not a finite number", () => {
    expect(deltaStatus(null)).toBe("neutral");
    expect(deltaStatus(undefined)).toBe("neutral");
    expect(deltaStatus("up")).toBe("neutral");
    expect(deltaStatus(NaN)).toBe("neutral");
    expect(deltaStatus(Infinity)).toBe("neutral");
  });

  it("reads bigints numerically", () => {
    expect(deltaStatus(2n)).toBe("positive");
    expect(deltaStatus(-2n)).toBe("negative");
    expect(deltaStatus(0n)).toBe("neutral");
  });
});

describe("DeltaDisplay", () => {
  it("prefixes + on a positive value and marks itself up", () => {
    const { container } = render(<DeltaDisplay value={0.052} fmt="pct1" />);

    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-status", "positive");
    expect(root).toHaveTextContent("+5.2%");
    expect(root.className).toContain("text-positive");
  });

  it("shows a negative value with its own sign, marked down", () => {
    const { container } = render(<DeltaDisplay value={-0.052} fmt="pct1" />);

    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-status", "negative");
    expect(root).toHaveTextContent("-5.2%");
    expect(root.className).toContain("text-negative");
  });

  it("marks a value inside the neutral range neutral", () => {
    const { container } = render(
      <DeltaDisplay value={0.02} neutralRange={[-0.05, 0.05]} fmt="pct1" />,
    );

    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-status", "neutral");
    expect(root).toHaveTextContent("2.0%");
    expect(root).not.toHaveTextContent("+2.0%");
  });

  it("renders a missing value as – with neutral status", () => {
    const { container } = render(<DeltaDisplay value={null} />);

    expect(container.firstElementChild!).toHaveAttribute(
      "data-status",
      "neutral",
    );
    expect(container).toHaveTextContent("–");
  });

  it("flips up/down colors when downIsGood is set", () => {
    const { container } = render(<DeltaDisplay value={0.05} downIsGood />);

    const root = container.firstElementChild!;
    expect(root).toHaveAttribute("data-status", "positive");
    expect(root.className).toContain("text-negative");
  });

  it("draws the direction arrow as decorative svg", () => {
    const { container } = render(<DeltaDisplay value={0.05} />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });

  it("omits the arrow when showSymbol is false", () => {
    const { container } = render(
      <DeltaDisplay value={0.05} showSymbol={false} />,
    );

    expect(container.querySelector("svg")).toBeNull();
    expect(container).toHaveTextContent("+0.05");
  });

  it("omits the formatted value when showValue is false", () => {
    const { container } = render(
      <DeltaDisplay value={0.05} showValue={false} />,
    );

    expect(container.querySelector("svg")).not.toBeNull();
    expect(container).not.toHaveTextContent("5%");
  });

  it("places the arrow after the value by default, before on symbolPosition=left", () => {
    const right = render(<DeltaDisplay value={0.05} />);
    const rightHtml = right.container.innerHTML;
    expect(rightHtml.indexOf("+0.05")).toBeLessThan(rightHtml.indexOf("<svg"));

    const left = render(<DeltaDisplay value={0.05} symbolPosition="left" />);
    const leftHtml = left.container.innerHTML;
    expect(leftHtml.indexOf("<svg")).toBeLessThan(leftHtml.indexOf("+0.05"));
  });

  it("wraps itself in a chip pill when chip is set", () => {
    const { container } = render(<DeltaDisplay value={0.05} chip />);

    const root = container.firstElementChild!;
    expect(root.className).toContain("rounded");
    expect(root.className).toContain("border");
  });

  it("renders the text caption after the delta", () => {
    render(<DeltaDisplay value={0.05} text="vs. prior week" />);

    expect(screen.getByText("vs. prior week")).toBeInTheDocument();
  });

  it("renders nothing but spans and inline svg so MDX <p> wrapping stays valid", () => {
    const { container } = render(<DeltaDisplay value={0.05} chip text="x" />);

    // tagName is uppercase for HTML elements, localName-case for svg nodes.
    const allowed = new Set(["SPAN", "svg", "path", "rect"]);
    const tags = Array.from(container.querySelectorAll("*")).map(
      (el) => el.tagName,
    );
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every((tag) => allowed.has(tag))).toBe(true);
  });

  it("propagates a bad fmt as FormatError for the widget to alert", () => {
    expect(() => render(<DeltaDisplay value={0.05} fmt="bogus" />)).toThrow(
      /fmt="bogus"/,
    );
  });
});

describe("DeltaDisplay text tone", () => {
  // The tone tokens carry both modes; the browser spec measures the
  // painted colours and their WCAG 1.4.3 contrast on the chip.
  it.each([
    { value: 0.05, tone: "text-positive" },
    { value: -0.05, tone: "text-negative" },
    { value: 0, tone: "text-muted-foreground" },
  ])("colors $value with $tone", ({ value, tone }) => {
    const { container } = render(<DeltaDisplay value={value} chip />);

    expect(container.firstElementChild!.classList).toContain(tone);
  });

  it("lets the arrow inherit the text tone", () => {
    const { container } = render(<DeltaDisplay value={0.05} />);

    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("class")).not.toMatch(/text-/);
    expect(svg.querySelector("path")).toHaveAttribute("fill", "currentColor");
  });
});
