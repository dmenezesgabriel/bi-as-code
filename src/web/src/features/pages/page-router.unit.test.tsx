import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
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
import { fixedLanguages } from "../chrome/declared-languages";
import type { DeclaredLanguages } from "../chrome/types";
import type { PageSourcePort } from "../editor/types";
import { FakeDataUpdates } from "./fake-data-updates";
import { buildPageRouter } from "./page-router";
import type {
  CompiledPageModule,
  ManifestPageEntry,
  PageLayout,
  PageModule,
} from "./types";

function pageEntry(
  route: string,
  load: () => Promise<PageModule>,
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
    layout: {},
    brandCss: "",
  };
}

// A page whose body reads `--primary` once, on its first render, as a
// chart reads its tokens: it shows the colour the document held then.
function primaryPage(name: string, brandCss: string): CompiledPageModule {
  function PrimaryOnMount() {
    const [primary] = useState(() =>
      getComputedStyle(document.documentElement)
        .getPropertyValue("--primary")
        .trim(),
    );
    return (
      <p>
        {name} primary {primary}
      </p>
    );
  }
  return { ...textPage(name, name), default: PrimaryOnMount, brandCss };
}

function primaryRule(colour: string): string {
  return `:root,\n.light {\n  --primary: ${colour};\n}\n`;
}

function failedPage(message: string): PageModule {
  return {
    compileError: { file: "pages/index.md", message, line: 7, column: 1 },
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
  layout: {},
  brandCss: "",
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
  layout: {
    page_width: "article",
    cards: false,
    table_of_contents: true,
    table_of_contents_label: "On this page",
  },
  embed: { origins: [] },
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
  dataUpdates?: FakeDataUpdates,
  languages?: DeclaredLanguages,
) {
  const router = buildPageRouter(
    entries,
    siteConfig,
    tree,
    createMemoryHistory({ initialEntries: [initialPath] }),
    pageSource,
    dataUpdates?.subscription,
    languages,
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
    expect(router.state.location.pathname).toBe("/nested/");
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

  it("drops the chrome a page's manifest entry turns off when that page shows, not while it loads", async () => {
    let loadEmbed: (mod: PageModule) => void = () => {};
    const embed: ManifestPageEntry = {
      ...pageEntry("/embed", () => new Promise((done) => (loadEmbed = done))),
      sidebar: false,
      header: false,
    };
    const router = renderRouter([...pages, embed], "/");
    await screen.findByText(/home body/);

    await act(async () => void router.navigate({ to: "/embed" }));
    const shownWhileLoading = screen.queryByText(/home body/);
    const chromeWhileLoading = document.querySelectorAll("aside, header");
    await act(async () => loadEmbed(textPage("embed body", "Embed")));

    // The home page stays on screen while the embed loads, so its chrome
    // stays with it: dropping it early would strip the page still shown.
    expect(shownWhileLoading).not.toBeNull();
    expect(chromeWhileLoading).toHaveLength(2);
    expect(await screen.findByText("embed body")).toBeInTheDocument();
    expect(document.querySelectorAll("aside, header")).toHaveLength(0);
  });

  it("registers the config's project-wide sql tables on the page's registry", async () => {
    const db = new FakeDuckDb();
    const sqlPage: CompiledPageModule = {
      default: () => <p>sql page</p>,
      frontmatter: {},
      title: "Sql",
      sqlBlocks: [{ name: "q", sql: "select * from shared" }],
      sqlTables: { local: "data/local.csv" },
      layout: {},
      brandCss: "",
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

  it.each([
    ["inherits the config's full width", {}, false],
    [
      "keeps its own article width over the config's full",
      { page_width: "article" as const },
      true,
    ],
  ])("a page that %s", async (_case, layout, capped) => {
    // Arrange
    const widthPage: CompiledPageModule = {
      ...textPage("width body", "Width"),
      layout,
    };

    // Act
    renderRouter(
      [pageEntry("/width", async () => widthPage)],
      "/width",
      navTree,
      { ...site, layout: { ...site.layout, page_width: "full" } },
    );

    // Assert
    const main = await screen.findByRole("main");
    expect(main.classList.contains("max-w-4xl")).toBe(capped);
  });

  it.each([
    ["inherits the config's cards", {}, true],
    ["turns off the config's cards", { cards: false }, false],
  ])("a page that %s", async (_case, layout, carded) => {
    // Arrange
    const cardsPage: CompiledPageModule = {
      ...textPage("cards body", "Cards"),
      layout,
    };

    // Act
    renderRouter(
      [pageEntry("/cards", async () => cardsPage)],
      "/cards",
      navTree,
      { ...site, layout: { ...site.layout, cards: true } },
    );

    // Assert
    await screen.findByText("cards body");
    expect(document.querySelector("[data-cards]") !== null).toBe(carded);
  });

  function renderTocPage(layout: PageLayout, siteLayout: Partial<PageLayout>) {
    const tocPage: CompiledPageModule = {
      ...textPage("toc body", "Toc"),
      default: () => (
        <>
          <h2>Section A</h2>
          <h2>Section B</h2>
        </>
      ),
      layout,
    };
    renderRouter([pageEntry("/toc", async () => tocPage)], "/toc", navTree, {
      ...site,
      layout: { ...site.layout, ...siteLayout },
    });
  }

  it.each([
    ["inherits the config's hidden table of contents", {}, false],
    ["brings back the table of contents", { table_of_contents: true }, true],
  ])("a page that %s", async (_case, layout, shown) => {
    // Arrange + Act
    renderTocPage(layout, { table_of_contents: false });

    // Assert
    await screen.findByText("Section A");
    expect(
      screen.queryByRole("navigation", { name: "On this page" }) !== null,
    ).toBe(shown);
  });

  it.each([
    ["inherits the config's table of contents label", {}, "Contents"],
    [
      "names its own table of contents",
      { table_of_contents_label: "Summary" },
      "Summary",
    ],
  ])("a page that %s", async (_case, layout, label) => {
    // Arrange + Act
    renderTocPage(layout, { table_of_contents_label: "Contents" });

    // Assert
    await screen.findByRole("navigation", { name: label });
  });

  it("re-registers a page's sql tables when the data channel reports a source change", async () => {
    // Arrange
    const db = new FakeDuckDb();
    const dataUpdates = new FakeDataUpdates();
    const sqlPage: CompiledPageModule = {
      default: () => <p>sql page</p>,
      frontmatter: {},
      title: "Sql",
      sqlBlocks: [{ name: "q", sql: "select * from local" }],
      sqlTables: { local: "data/local.csv" },
      layout: {},
      brandCss: "",
    };
    renderRouter(
      [pageEntry("/sql", async () => sqlPage)],
      "/sql",
      navTree,
      site,
      db,
      undefined,
      dataUpdates,
    );
    await waitFor(() => expect(db.queries).toHaveLength(1));

    // Act
    act(() => dataUpdates.emit({ path: "data/local.csv", version: 2 }));

    // Assert
    await waitFor(() => expect(db.queries).toHaveLength(2));
    expect(db.registered).toHaveLength(2);
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

  it("renders a page that failed to compile as its compile error", async () => {
    // Arrange / Act
    renderRouter(
      [pageEntry("/", async () => failedPage("Unexpected `<`"))],
      "/",
    );

    // Assert
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("This page failed to compile");
    expect(alert).toHaveTextContent("pages/index.md:7:1");
    expect(alert).toHaveTextContent("Unexpected `<`");
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

  it("applies a page's brand while it is shown and drops it on leaving, both ways", async () => {
    // One module per page, as `import()` hands back on every load.
    const home = primaryPage("home", "");
    const branded = primaryPage("branded", primaryRule("#154886"));
    const router = renderRouter(
      [
        pageEntry("/", async () => home),
        pageEntry("/branded", async () => branded),
      ],
      "/",
    );
    await screen.findByText("home primary #171717");

    router.history.push("/branded");
    expect(
      await screen.findByText("branded primary #154886"),
    ).toBeInTheDocument();

    router.history.push("/");
    expect(await screen.findByText("home primary #171717")).toBeInTheDocument();
  });

  it("re-renders a hot-swapped page with its edited brand", async () => {
    let current = primaryPage("page", primaryRule("#154886"));
    const router = renderRouter([pageEntry("/", async () => current)], "/");
    await screen.findByText("page primary #154886");

    current = primaryPage("page", primaryRule("#1e40af"));
    await router.invalidate();

    expect(await screen.findByText("page primary #1e40af")).toBeInTheDocument();
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
      // The editor is a lazy chunk: its import alone outlasts findBy's 1s
      // default on a loaded host.
      await screen.findByRole(
        "textbox",
        { name: "Page source" },
        { timeout: 4000 },
      );
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

  it("keeps the editor beside a compile error and renders the page again once it compiles", async () => {
    // Arrange
    let current: PageModule = failedPage("Unexpected `<`");
    const router = renderRouter(
      [pageEntry("/", async () => current)],
      "/?edit=true",
      navTree,
      site,
      undefined,
      editorPort(),
    );
    await screen.findByRole("textbox", { name: "Page source" });
    const viewBefore = mountedView("Page source");
    const preview = screen.getByRole("region", { name: "Live preview" });
    expect(within(preview).getByRole("alert")).toHaveTextContent(
      "Unexpected `<`",
    );

    // Act
    current = textPage("fixed body", "Fixed");
    await router.invalidate();

    // Assert
    expect(await within(preview).findByText("fixed body")).toBeInTheDocument();
    expect(within(preview).queryByRole("alert")).toBeNull();
    expect(mountedView("Page source")).toBe(viewBefore);
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

describe("buildPageRouter under a configured base path", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("strips the baked base path when matching routes", async () => {
    vi.stubEnv("BASE_URL", "/bi-as-code/");
    renderRouter(pages, "/bi-as-code/nested");

    expect(await screen.findByText("nested body")).toBeInTheDocument();
    expect(document.title).toBe("Nested");
  });

  it("prepends the baked base path to link hrefs", async () => {
    vi.stubEnv("BASE_URL", "/bi-as-code/");
    renderRouter(pages, "/bi-as-code/");
    await screen.findByText(/home body/);

    expect(screen.getByRole("link", { name: "go nested" })).toHaveAttribute(
      "href",
      "/bi-as-code/nested/",
    );
  });
});

describe("buildPageRouter page URLs", () => {
  it("links a page at its route's directory URL", async () => {
    // Arrange / Act
    renderRouter(pages, "/");
    await screen.findByText(/home body/);

    // Assert
    expect(screen.getByRole("link", { name: "go nested" })).toHaveAttribute(
      "href",
      "/nested/",
    );
  });

  it("keeps the trailing slash of a filtered page URL it was loaded at", async () => {
    // Arrange / Act
    const router = renderRouter(pages, "/nested/?region=West");
    await screen.findByText("nested body");

    // Assert
    expect(router.state.location.href).toBe("/nested/?region=West");
  });

  it("shows the chrome a page's manifest entry sets at its directory URL", async () => {
    // Arrange
    const embed = pageEntry("/embed", async () => textPage("e", "E"));
    const entries = [...pages, { ...embed, sidebar: false, header: false }];

    // Act
    renderRouter(entries, "/embed/");
    await screen.findByText("e");

    // Assert
    expect(document.querySelectorAll("aside, header")).toHaveLength(0);
  });
});

describe("buildPageRouter languages", () => {
  const languagePage: CompiledPageModule = {
    ...textPage("", "Home"),
    default: ({ language }) => <p>page in {language}</p>,
  };
  const languageEntries = [pageEntry("/", async () => languagePage)];

  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.lang = "en";
  });

  it("renders the page in the URL's language and declares it on <html lang>", async () => {
    // Arrange / Act
    renderRouter(
      languageEntries,
      "/?lang=fr",
      navTree,
      site,
      undefined,
      undefined,
      undefined,
      fixedLanguages(["en", "fr"]),
    );

    // Assert
    expect(await screen.findByText("page in fr")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Language" })).toBeVisible();
    expect(document.documentElement.lang).toBe("fr");
  });

  it("shows no language menu when the project declares none", async () => {
    // Arrange / Act
    renderRouter(languageEntries, "/?lang=fr");

    // Assert
    expect(await screen.findByText("page in")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Language" })).toBeNull();
  });
});
