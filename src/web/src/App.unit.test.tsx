import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
import { fixedLanguages } from "./features/chrome/declared-languages";
import { FakeFrameWindow } from "./features/chrome/frame-window.stub";
import { stubMatchMedia } from "./features/chrome/match-media.stub";
import { stubResizeObserver } from "./features/chrome/resize-observer.stub";
import type { DeclaredLanguages, FrameWindow } from "./features/chrome/types";
import type { PageChromeEntry } from "./features/pages/types";
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
  embed: { origins: [] },
};

async function renderShell(
  initialPath: string,
  config: BiacConfig = site,
  navTree: NavTree = tree,
  editable = false,
  loadSearchDocuments?: FakeSearchDocuments["load"],
  languages?: DeclaredLanguages,
  pages?: PageChromeEntry[],
  frame?: FrameWindow,
) {
  const rootRoute = createRootRoute({
    component: () => (
      <AppShell
        tree={navTree}
        site={config}
        pages={pages}
        editable={editable}
        loadSearchDocuments={loadSearchDocuments}
        languages={languages}
        frame={frame}
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

/** A shell in `?lang=` `language`, its search knowing "hebdomadaire" in fr only. */
async function renderFrenchSearchShell(language: string) {
  const documents = new FakeSearchDocuments(SAMPLE_SEARCH_PAGES, {
    held: false,
    byLanguage: {
      fr: [
        { id: "/", title: "Home", text: "Revue hebdomadaire", keywords: "" },
      ],
    },
  });
  const languages = fixedLanguages(["en", "fr"]);
  await renderShell(
    `/?lang=${language}`,
    site,
    tree,
    false,
    documents.load,
    languages,
  );
  const box = screen.getByRole("combobox", { name: "Search pages" });
  await act(async () => {
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value: "hebdomadaire" } });
  });
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

describe("AppShell — page chrome", () => {
  const noSidebar = { ...site, nav: { sidebar: false } };

  function renderPage(
    chrome: Omit<PageChromeEntry, "route">,
    config = site,
    path = "/",
  ) {
    const pages = [{ route: "/nested/page", ...chrome }];
    return renderShell(path, config, tree, false, undefined, undefined, pages);
  }

  it("drops the sidebar and header for a page that turns both off", async () => {
    await renderPage({ sidebar: false, header: false }, site, "/nested/page");

    expect(screen.getByText("nested body")).toBeInTheDocument();
    expect(document.querySelectorAll("aside, header")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).toBeNull();
  });

  it("keeps the header without its sidebar toggle when only the sidebar is off", async () => {
    await renderPage({ sidebar: false }, site, "/nested/page");

    expect(
      screen.getByRole("navigation", { name: "breadcrumb" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: "Site navigation" }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Toggle sidebar" })).toBeNull();
    expect(screen.getByText("nested body").closest(".lg\\:pl-72")).toBeNull();
  });

  it("keeps the sidebar and its toggle when only the header is off", async () => {
    await renderPage({ header: false }, site, "/nested/page");

    expect(document.querySelectorAll("header")).toHaveLength(0);
    expect(
      screen.getByRole("navigation", { name: "Site navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Toggle sidebar" }),
    ).toBeInTheDocument();
  });

  it("brings a page's chrome back over nav.sidebar: false", async () => {
    const chrome = { sidebar: true, header: true };

    await renderPage(chrome, noSidebar, "/nested/page");

    expect(
      screen.getByRole("navigation", { name: "Site navigation" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "breadcrumb" }),
    ).toBeVisible();
  });

  it("leaves every other page's chrome to the project", async () => {
    await renderPage({ sidebar: false, header: false }, site, "/");

    expect(document.querySelectorAll("aside")).toHaveLength(1);
    expect(document.querySelectorAll("header")).toHaveLength(1);
  });
});

describe("AppShell — search language", () => {
  it("searches the documents of the language the URL names", async () => {
    await renderFrenchSearchShell("fr");

    const options = within(sidebar()).getAllByRole("option");

    expect(options.map((option) => option.textContent)).toEqual(["Home"]);
  });

  it("finds nothing for another language's words", async () => {
    await renderFrenchSearchShell("en");

    expect(within(sidebar()).getByText("No results")).toBeInTheDocument();
  });
});

describe("AppShell — framed", () => {
  const INTRANET = "https://intranet.example.com";
  const embeddable = { ...site, embed: { origins: [INTRANET] } };

  function renderFramed(frame: FrameWindow) {
    return renderShell(
      "/",
      embeddable,
      tree,
      false,
      undefined,
      undefined,
      undefined,
      frame,
    );
  }

  function content(): HTMLElement {
    return screen.getByRole("banner").parentElement!;
  }

  it("posts the page's height to a listed parent", async () => {
    const observer = stubResizeObserver();
    const frame = new FakeFrameWindow({ ancestorOrigins: [INTRANET] });
    await renderFramed(frame);

    act(() => observer.fire());

    expect(frame.parent.posted).toEqual([
      { message: { type: "biac:height", height: 0 }, targetOrigin: INTRANET },
    ]);
  });

  it("lets the content end where it ends, so the reported height can shrink", async () => {
    await renderFramed(new FakeFrameWindow({ ancestorOrigins: [INTRANET] }));

    expect(content()).not.toHaveClass("min-h-screen");
  });

  it("fills the viewport in a tab of its own", async () => {
    await renderShell("/", embeddable);

    expect(content()).toHaveClass("min-h-screen");
  });
});
