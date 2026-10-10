import { describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { Layer } from "effect";
import type { NavTree } from "virtual:biac-pages";
import type { BiacConfig } from "virtual:biac-config";
import { DuckDb, type DuckDbService } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import { mountedView } from "../editor/editor-test-view";
import { FakePageSourcePort } from "../editor/fake-page-source-port";
import type { PageSourcePort } from "../editor/types";
import { buildPageRouter } from "./page-router";
import type { CompiledPageModule, ManifestPageEntry } from "./types";

function pageEntry(
  route: string,
  load: () => Promise<CompiledPageModule>,
): ManifestPageEntry {
  return {
    route,
    file: `pages${route === "/" ? "/index" : route}.md`,
    isIndex: route === "/",
    load,
  };
}

function textPage(text: string, title: string | null): CompiledPageModule {
  return {
    default: () => <p>{text}</p>,
    frontmatter: {},
    title,
    sqlBlocks: [],
    sqlTables: {},
  };
}

const homePage: CompiledPageModule = {
  default: ({ components }) => {
    const Anchor = components?.a ?? "a";
    return (
      <p>
        home body <Anchor href="/nested">go nested</Anchor>
      </p>
    );
  },
  frontmatter: { title: "Home" },
  title: "Home",
  sqlBlocks: [],
  sqlTables: {},
};

const pages: ManifestPageEntry[] = [
  pageEntry("/", async () => homePage),
  pageEntry("/nested", async () => textPage("nested body", "Nested")),
];

const site: BiacConfig = {
  title: "ACME Site",
  theme: "system" as const,
  nav: { sidebar: true },
  sqlTables: {},
};

const navTree: NavTree = {
  rootPages: [{ name: "Home", href: "/" }],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Nested", href: "/nested" }],
    },
  ],
};

function renderRouter(
  entries: ManifestPageEntry[],
  initialPath: string,
  tree: NavTree = navTree,
  siteConfig: BiacConfig = site,
  db?: DuckDbService,
  pageSource?: PageSourcePort,
) {
  const router = buildPageRouter(
    entries,
    siteConfig,
    tree,
    createMemoryHistory({ initialEntries: [initialPath] }),
    pageSource,
  );
  const app = <RouterProvider router={router} />;
  render(
    db ? (
      <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
        {app}
      </DataRuntimeProvider>
    ) : (
      app
    ),
  );
  return router;
}

describe("buildPageRouter", () => {
  it("renders the manifest page matched to the index route", async () => {
    renderRouter(pages, "/");

    expect(await screen.findByText(/home body/)).toBeInTheDocument();
    expect(document.title).toBe("Home");
  });

  it("renders the manifest page matched to a nested route", async () => {
    renderRouter(pages, "/nested");

    expect(await screen.findByText("nested body")).toBeInTheDocument();
    expect(document.title).toBe("Nested");
  });

  it("navigates client-side when a page's internal link is clicked", async () => {
    const router = renderRouter(pages, "/");

    fireEvent.click(await screen.findByRole("link", { name: "go nested" }));

    expect(await screen.findByText("nested body")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/nested");
  });

  it("renders the not-found page for a path no manifest entry matches", async () => {
    renderRouter(pages, "/no-such-page");

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Page not found");
  });

  it("uses the configured site title for an untitled page", async () => {
    const withUntitled = [
      pageEntry("/untitled", async () => textPage("body", null)),
    ];
    renderRouter(withUntitled, "/untitled");

    expect(await screen.findByText("body")).toBeInTheDocument();
    expect(document.title).toBe("ACME Site");
  });

  it("renders the sidebar nav from the tree passed to the router", async () => {
    renderRouter(pages, "/");

    const nav = await screen.findByRole("navigation", {
      name: "Site navigation",
    });
    expect(nav).toHaveTextContent("Nested");
    // The header breadcrumbs also render a "Home" link — scope to the
    // sidebar landmark so the assertion names the nav tree's link.
    within(nav).getByRole("link", { name: "Home" });
  });

  it("registers the config's project-wide sql tables on the page's registry", async () => {
    const db = new FakeDuckDb();
    const sqlPage: CompiledPageModule = {
      default: () => <p>sql page</p>,
      frontmatter: {},
      title: "Sql",
      sqlBlocks: [{ name: "q", sql: "select * from shared" }],
      sqlTables: { local: "data/local.csv" },
    };
    renderRouter(
      [pageEntry("/sql", async () => sqlPage)],
      "/sql",
      navTree,
      { ...site, sqlTables: { shared: "data/shared.parquet" } },
      db,
    );

    await waitFor(() => expect(db.queries.length).toBeGreaterThan(0));
    expect(db.registered).toEqual([
      { name: "shared", source: "data/shared.parquet" },
      { name: "local", source: "data/local.csv" },
    ]);
  });

  it("renders an in-page error when a page module fails to load", async () => {
    const broken = [
      pageEntry("/", async () => textPage("home body", "Home")),
      pageEntry("/broken", async () => {
        throw new Error("page load exploded");
      }),
    ];
    renderRouter(broken, "/broken");

    expect(await screen.findByText("page load exploded")).toBeInTheDocument();
    expect(document.title).toBe("Error");
  });

  it("re-renders a hot-swapped page module in place when the router is invalidated", async () => {
    let current = textPage("old body", "Old");
    const router = renderRouter(
      [pageEntry("/", async () => current)],
      "/?region=West",
    );
    await screen.findByText("old body");

    current = textPage("new body", "New");
    await router.invalidate();

    expect(await screen.findByText("new body")).toBeInTheDocument();
    expect(screen.queryByText("old body")).not.toBeInTheDocument();
    expect(router.state.location.searchStr).toBe("?region=West");
  });

  it("keeps the scroll position when a filter write replaces only the search params", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    const router = renderRouter(pages, "/");
    await screen.findByText(/home body/);
    scrollTo.mockClear();

    // What `browserFilterUrlPort.write` issues — the history wrapper
    // reports it as a REPLACE navigation, which must not scroll.
    router.history.replace("/?large_orders=true");

    await waitFor(() =>
      expect(router.state.location.href).toContain("large_orders=true"),
    );
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls to the top when a navigation changes the page", async () => {
    const scrollTo = vi.spyOn(window, "scrollTo");
    const router = renderRouter(pages, "/");
    await screen.findByText(/home body/);
    scrollTo.mockClear();

    router.history.push("/nested");

    await screen.findByText("nested body");
    expect(scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 0, left: 0 }),
    );
  });
});

describe("buildPageRouter edit mode", () => {
  const editorPort = () => new FakePageSourcePort({ source: "# Home\n" });

  it.each(["/?edit", "/?edit=true"])(
    "opens %s in the split-pane editor beside the live page",
    async (path) => {
      // Arrange / Act
      renderRouter(pages, path, navTree, site, undefined, editorPort());

      // Assert
      await screen.findByRole("textbox", { name: "Page source" });
      expect(mountedView("Page source").state.doc.toString()).toBe("# Home\n");
      expect(
        screen.getByRole("region", { name: "Live preview" }),
      ).toHaveTextContent("home body");
    },
  );

  it.each([
    ["no page-source port (a production build)", "/?edit", undefined],
    ["edit=false", "/?edit=false", editorPort()],
  ])("renders the plain page with %s", async (_case, path, port) => {
    // Arrange / Act
    renderRouter(pages, path, navTree, site, undefined, port);

    // Assert
    expect(await screen.findByText(/home body/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Live preview" })).toBeNull();
  });

  it("keeps the editor's view when the hot-swapped page re-renders", async () => {
    // Arrange
    let current = textPage("old body", "Old");
    const router = renderRouter(
      [pageEntry("/", async () => current)],
      "/?region=West&edit=true",
      navTree,
      site,
      undefined,
      editorPort(),
    );
    await screen.findByRole("textbox", { name: "Page source" });
    const viewBefore = mountedView("Page source");

    // Act
    current = textPage("new body", "New");
    await router.invalidate();

    // Assert
    expect(await screen.findByText("new body")).toBeInTheDocument();
    expect(mountedView("Page source")).toBe(viewBefore);
    expect(router.state.location.searchStr).toBe("?region=West&edit=true");
  });
});
