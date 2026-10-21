import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { AppShell } from "./App";
import { stubMatchMedia } from "./features/chrome/match-media.stub";
import {
  FakeSearchDocuments,
  SAMPLE_SEARCH_PAGES,
} from "./features/search/fake-search-documents";

const tree: NavTree = {
  rootPages: [{ name: "Home", href: "/" }],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Region detail", href: "/nested/page" }],
    },
  ],
};

const site: BiacConfig = {
  title: "ACME Site",
  theme: "system",
  nav: { sidebar: true },
  sqlTables: {},
  layout: {
    page_width: "article",
    cards: false,
    table_of_contents: true,
    table_of_contents_label: "On this page",
  },
};

async function renderShell(
  initialPath: string,
  config: BiacConfig = site,
  navTree: NavTree = tree,
  editable = false,
  loadSearchDocuments?: FakeSearchDocuments["load"],
) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell
        tree={navTree}
        site={config}
        editable={editable}
        loadSearchDocuments={loadSearchDocuments}
      />
    ),
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>route body</p>,
  });
  const nestedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/nested/page",
    component: () => <p>nested body</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, nestedRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText(/body/);
}

async function renderSearchShell() {
  const documents = new FakeSearchDocuments(SAMPLE_SEARCH_PAGES, {
    held: false,
  });
  await renderShell("/", site, tree, false, documents.load);
  return screen.getByRole("combobox", { name: "Search pages" });
}

function sidebar(): HTMLElement {
  return screen.getByRole("complementary");
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.documentElement.classList.remove("dark");
  document.documentElement.style.colorScheme = "";
});

describe("AppShell", () => {
  it("offers an Edit link in the header when pages are editable", async () => {
    // Arrange / Act
    await renderShell("/nested/page", site, tree, true);

    // Assert
    expect(screen.getByRole("banner")).toContainElement(
      screen.getByRole("link", { name: "Edit" }),
    );
  });

  it("has no Edit link when pages are not editable", async () => {
    // Arrange / Act
    await renderShell("/nested/page");

    // Assert
    expect(screen.queryByRole("link", { name: "Edit" })).toBeNull();
  });

  it("renders the outlet content of the matched route", async () => {
    await renderShell("/");

    expect(screen.getByText("route body")).toBeInTheDocument();
  });

  it("renders the sidebar nav with the site title and tree links", async () => {
    await renderShell("/");

    expect(
      screen.getByRole("navigation", { name: "Site navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ACME Site" })).toBeInTheDocument();
    expect(screen.getByText("Nested")).toBeInTheDocument();
  });

  it("renders route-derived breadcrumbs in the header", async () => {
    await renderShell("/nested/page");

    const nav = screen.getByRole("navigation", { name: "breadcrumb" });
    expect(within(nav).getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
    expect(within(nav).getByText("Nested")).toBeInTheDocument();
    expect(within(nav).getByText("Region detail")).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("omits the sidebar and its toggle when nav.sidebar is false", async () => {
    await renderShell("/", { ...site, nav: { sidebar: false } });

    expect(screen.getByText("route body")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Site navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle sidebar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "breadcrumb" }),
    ).not.toBeInTheDocument();
  });

  it("renders a theme toggle in the header that flips and persists dark mode", async () => {
    await renderShell("/");

    const toggle = screen.getByRole("button", { name: "Switch to dark mode" });
    fireEvent.click(toggle);

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("biac.theme")).toBe("dark");
    expect(
      screen.getByRole("button", { name: "Switch to light mode" }),
    ).toBeInTheDocument();
  });

  it("applies a persisted dark choice on mount", async () => {
    window.localStorage.setItem("biac.theme", "dark");

    await renderShell("/");

    expect(document.documentElement).toHaveClass("dark");
  });

  it("still applies the theme when nav.sidebar is false and no toggle renders", async () => {
    window.localStorage.setItem("biac.theme", "dark");

    await renderShell("/", { ...site, nav: { sidebar: false } });

    expect(document.documentElement).toHaveClass("dark");
    expect(
      screen.queryByRole("button", { name: /Switch to (dark|light) mode/ }),
    ).not.toBeInTheDocument();
  });

  it("hides the sidebar on toggle click and persists the choice", async () => {
    await renderShell("/");

    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar()).toHaveClass("translate-x-0");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar()).toHaveClass("-translate-x-full");
    expect(window.sessionStorage.getItem("biac.sidebar.open")).toBe("false");
  });

  it("restores a persisted desktop collapse", async () => {
    window.sessionStorage.setItem("biac.sidebar.open", "false");

    await renderShell("/");

    expect(sidebar()).toHaveClass("-translate-x-full");
  });

  it("shows a collapsed sidebar for a search shortcut without persisting it", async () => {
    window.sessionStorage.setItem("biac.sidebar.open", "false");
    const box = await renderSearchShell();

    fireEvent.keyDown(document.body, { key: "k", code: "KeyK", ctrlKey: true });

    expect(sidebar()).toHaveClass("translate-x-0");
    expect(document.activeElement).toBe(box);
    expect(window.sessionStorage.getItem("biac.sidebar.open")).toBe("false");
  });

  describe("below the lg breakpoint", () => {
    it("opens the drawer for / and focuses the search box", async () => {
      stubMatchMedia(true);
      const box = await renderSearchShell();

      fireEvent.keyDown(document.body, { key: "/" });

      expect(sidebar()).toHaveClass("translate-x-0");
      expect(document.activeElement).toBe(box);
    });

    it("keeps the drawer open while Escape clears the box, and closes it on the next", async () => {
      stubMatchMedia(true);
      const box = await renderSearchShell();
      fireEvent.keyDown(document.body, { key: "/" });
      fireEvent.change(box, { target: { value: "weekly" } });

      fireEvent.keyDown(box, { key: "Escape" });
      expect(box).toHaveValue("");
      expect(sidebar()).toHaveClass("translate-x-0");

      fireEvent.keyDown(box, { key: "Escape" });
      expect(sidebar()).toHaveClass("-translate-x-full");
    });

    it("starts closed, opens as an overlay, and Escape closes it without persisting", async () => {
      stubMatchMedia(true);
      await renderShell("/");

      expect(sidebar()).toHaveClass("-translate-x-full");

      fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

      expect(sidebar()).toHaveClass("translate-x-0");
      expect(screen.getByTestId("sidebar-backdrop")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(sidebar()).toHaveClass("-translate-x-full");
      expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
      expect(window.sessionStorage.getItem("biac.sidebar.open")).toBeNull();
    });

    it("closes the drawer when a nav link is clicked", async () => {
      stubMatchMedia(true);
      await renderShell("/");

      fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
      fireEvent.click(within(sidebar()).getByRole("link", { name: "Home" }));

      expect(sidebar()).toHaveClass("-translate-x-full");
    });
  });
});
