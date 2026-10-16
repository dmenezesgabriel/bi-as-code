import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ChartHeading } from "./chart-heading";

describe("<ChartHeading>", () => {
  it("renders the title under the given id and the subtitle beneath it", () => {
    render(
      <ChartHeading
        titleId="t1"
        title="Revenue by region"
        subtitle="US dollars"
      />,
    );

    const title = screen.getByText("Revenue by region");
    const subtitle = screen.getByText("US dollars");
    expect(title).toHaveAttribute("id", "t1");
    expect(title.compareDocumentPosition(subtitle)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("renders text, never a heading — chart titles stay out of the page outline", () => {
    render(<ChartHeading titleId="t1" title="Revenue" subtitle="USD" />);

    expect(screen.queryByRole("heading")).toBeNull();
  });

  it("omits the subtitle line when unset", () => {
    const { container } = render(<ChartHeading titleId="t1" title="Revenue" />);

    expect(container.querySelector("[data-chart-subtitle]")).toBeNull();
  });

  it("omits the title line when unset", () => {
    render(<ChartHeading titleId="t1" subtitle="USD" />);

    expect(document.getElementById("t1")).toBeNull();
    expect(screen.getByText("USD")).toHaveAttribute("data-chart-subtitle");
  });
});
