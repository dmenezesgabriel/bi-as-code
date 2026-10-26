import { describe, expect, it } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import type { NavTree } from "virtual:biac-pages";
import { Breadcrumbs } from "./breadcrumbs";
import { renderWithRouter } from "./router-harness";

const tree: NavTree = {
  rootPages: [
    { name: "Orders overview", href: "/" },
    { name: "ToC check", href: "/toc-check" },
  ],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Region detail", href: "/nested/page" }],
    },
  ],
};

const paths = ["/", "/toc-check", "/nested/page"];

function breadcrumbNav(): HTMLElement {
  return screen.getByRole("navigation", { name: "breadcrumb" });
}

describe("Breadcrumbs", () => {
  it("renders only the home crumb as current text on /", async () => {
    await renderWithRouter(<Breadcrumbs tree={tree} />, paths, "/");

    const items = within(breadcrumbNav()).getAllByRole("listitem");
    expect(items).toHaveLength(1);
    const current = within(breadcrumbNav()).getByText("Orders overview");
    expect(current).toHaveAttribute("aria-current", "page");
    expect(current.tagName).toBe("SPAN");
  });

  it("labels an untitled home page's crumb 'Home'", async () => {
    await renderWithRouter(
      <Breadcrumbs
        tree={{ rootPages: [{ name: "Home", href: "/" }], directories: [] }}
      />,
      paths,
      "/",
    );

    expect(within(breadcrumbNav()).getByText("Home")).toBeInTheDocument();
  });

  it("shows the home link then the page name on a root page", async () => {
    await renderWithRouter(<Breadcrumbs tree={tree} />, paths, "/toc-check");

    const nav = breadcrumbNav();
    expect(within(nav).getAllByRole("listitem")).toHaveLength(2);
    expect(
      within(nav).getByRole("link", { name: "Orders overview" }),
    ).toHaveAttribute("href", "/");
    expect(within(nav).getByText("ToC check")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it.each(["/nested/page/", "/nested/page"])(
    "shows home, the directory as plain text, and the page at %s",
    async (path) => {
      await renderWithRouter(<Breadcrumbs tree={tree} />, paths, path);

      const nav = breadcrumbNav();
      expect(within(nav).getAllByRole("listitem")).toHaveLength(3);
      expect(
        within(nav).getByRole("link", { name: "Orders overview" }),
      ).toHaveAttribute("href", "/");
      const dir = within(nav).getByText("Nested");
      expect(dir.tagName).toBe("SPAN");
      expect(dir).not.toHaveAttribute("aria-current");
      expect(within(nav).getByText("Region detail")).toHaveAttribute(
        "aria-current",
        "page",
      );
      expect(
        within(nav).queryByRole("link", { name: "Nested" }),
      ).not.toBeInTheDocument();
    },
  );

  it("renders nothing on a route absent from the nav tree", async () => {
    await renderWithRouter(<Breadcrumbs tree={tree} />, paths, "/missing");

    expect(
      screen.queryByRole("navigation", { name: "breadcrumb" }),
    ).not.toBeInTheDocument();
  });

  it("navigates home when the first crumb is clicked", async () => {
    const router = await renderWithRouter(
      <Breadcrumbs tree={tree} />,
      paths,
      "/nested/page",
    );

    fireEvent.click(
      within(breadcrumbNav()).getByRole("link", { name: "Orders overview" }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });
});
