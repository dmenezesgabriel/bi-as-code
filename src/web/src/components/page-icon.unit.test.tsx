import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { PageIcon } from "./page-icon";
import { PAGE_ICONS } from "./page-icon-catalog";

describe("PageIcon", () => {
  it("renders the named glyph as a decorative 16 px svg", () => {
    const { container } = render(<PageIcon name="calendar" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).toHaveAttribute("width", "16");
    expect(svg).toHaveClass("lucide-calendar");
  });

  it("renders nothing for a name outside the catalog", () => {
    const { container } = render(<PageIcon name="calender" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("maps every catalog name to a glyph", () => {
    expect(Object.keys(PAGE_ICONS)).toHaveLength(56);
  });
});
