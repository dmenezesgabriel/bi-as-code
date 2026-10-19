import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageBrandStyle } from "./page-brand-style";

const PAGE_PRIMARY = ":root,\n.light {\n  --primary: #154886;\n}\n";
// `--primary` in light mode, from the theme stylesheet the test setup loads.
const DEFAULT_PRIMARY = "#171717";

function primaryNow(): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue("--primary")
    .trim();
}

// Reads the token while rendering, as the chart theme does through its
// probe: the page's stylesheet must already be in the document by then.
function PrimaryAtRender() {
  return <p>primary at render: {primaryNow()}</p>;
}

describe("PageBrandStyle", () => {
  it("puts the page's stylesheet in the document before its children render", () => {
    render(
      <PageBrandStyle css={PAGE_PRIMARY}>
        <PrimaryAtRender />
      </PageBrandStyle>,
    );

    expect(screen.getByText("primary at render: #154886")).toBeInTheDocument();
  });

  it("renders no stylesheet for a page without a brand", () => {
    const { container } = render(
      <PageBrandStyle css="">
        <PrimaryAtRender />
      </PageBrandStyle>,
    );

    expect(
      screen.getByText(`primary at render: ${DEFAULT_PRIMARY}`),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("style")).toHaveLength(0);
  });

  it("removes the page's stylesheet when the page leaves", () => {
    const { unmount } = render(
      <PageBrandStyle css={PAGE_PRIMARY}>
        <PrimaryAtRender />
      </PageBrandStyle>,
    );

    unmount();

    expect(primaryNow()).toBe(DEFAULT_PRIMARY);
  });
});
