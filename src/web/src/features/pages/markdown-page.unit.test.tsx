import { describe, expect, it } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Layer } from "effect";
import { DuckDb, type DuckDbService } from "../data/data-service";
import { FakeDuckDb } from "../data/fake-duckdb";
import { DataRuntimeProvider } from "../data/runtime";
import { usePageFilters } from "../filters/page-filters-context";
import { MarkdownPage } from "./markdown-page";
import { useQueryResults } from "./query-registry";
import type { CompiledPageModule } from "./types";

function renderPage(
  page: CompiledPageModule,
  siteTitle = "biac",
  db?: DuckDbService,
  initialUrl = "/",
) {
  const rootRoute = createRootRoute({
    component: () => <MarkdownPage page={page} siteTitle={siteTitle} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: [initialUrl] }),
  });
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

/**
 * Renders `first` inside a router and returns a swap that replaces the page
 * module in place — what the router does when a page module hot-swaps.
 */
function renderSwappablePage(first: CompiledPageModule, db: DuckDbService) {
  const handle: { swap?: (next: CompiledPageModule) => void } = {};
  function SwappablePage() {
    const [current, setCurrent] = useState(first);
    handle.swap = setCurrent;
    return <MarkdownPage page={current} siteTitle="biac" />;
  }
  const router = createRouter({
    routeTree: createRootRoute({ component: SwappablePage }),
    history: createMemoryHistory(),
  });
  render(
    <DataRuntimeProvider layer={Layer.succeed(DuckDb, db)}>
      <RouterProvider router={router} />
    </DataRuntimeProvider>,
  );
  return (next: CompiledPageModule) => act(() => handle.swap?.(next));
}

function page(partial: Partial<CompiledPageModule>): CompiledPageModule {
  return {
    default: () => null,
    frontmatter: {},
    title: null,
    sqlBlocks: [],
    sqlTables: {},
    layout: {},
    ...partial,
  };
}

describe("MarkdownPage", () => {
  it("renders the page module's content inside a main landmark", async () => {
    renderPage(
      page({
        default: () => <p>rendered markdown</p>,
      }),
    );

    const main = await screen.findByRole("main");
    expect(main).toHaveTextContent("rendered markdown");
  });

  it("hands the mdx component map to the page so links render", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          // components arrives via props; a missing map falls back to the
          // intrinsic element, so the rendered anchor proves the prop was
          // passed only through its href handling — the routes test covers
          // the internal-link path end to end.
          const Anchor = components?.a ?? "a";
          return <Anchor href="https://example.com">external</Anchor>;
        },
      }),
    );

    expect(
      await screen.findByRole("link", { name: "external" }),
    ).toHaveAttribute("href", "https://example.com");
  });

  it("highlights fenced code through the pre component in the map", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          const Pre = components?.pre ?? "pre";
          return (
            <Pre>
              <code className="language-sql">select 1</code>
            </Pre>
          );
        },
      }),
    );

    await waitFor(() => {
      expect(document.querySelector("pre.shiki")).not.toBeNull();
    });
  });

  it("styles markdown headings and paragraphs through the map", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          // A missing map entry falls back to the intrinsic, unstyled tag.
          const H2 = components?.h2 ?? "h2";
          const P = components?.p ?? "p";
          return (
            <>
              <H2>Orders</H2>
              <P>Order volume.</P>
            </>
          );
        },
      }),
    );

    const heading = await screen.findByRole("heading", { level: 2 });
    expect(heading.className).not.toBe("");
    expect(screen.getByText("Order volume.").className).not.toBe("");
  });

  it("pads and rules markdown tables through the map", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          const TableTag = components?.table ?? "table";
          const Th = components?.th ?? "th";
          const Td = components?.td ?? "td";
          return (
            <TableTag>
              <thead>
                <tr>
                  <Th>Channel</Th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <Td>Direct</Td>
                </tr>
              </tbody>
            </TableTag>
          );
        },
      }),
    );

    expect((await screen.findByRole("table")).className).not.toBe("");
    expect(screen.getByRole("columnheader").className).not.toBe("");
    expect(screen.getByRole("cell").className).not.toBe("");
  });

  it("sets document.title to the page title", async () => {
    renderPage(page({ title: "Quarterly results" }));

    await screen.findByRole("main");
    expect(document.title).toBe("Quarterly results");
  });

  it("falls back to the site title when the page has no title", async () => {
    renderPage(page({ title: null }), "ACME Analytics");

    await screen.findByRole("main");
    expect(document.title).toBe("ACME Analytics");
  });

  it("renders an on-this-page toc for the page's h2/h3 headings", async () => {
    renderPage(
      page({
        default: () => (
          <>
            <h1>Title</h1>
            <h2>Section A</h2>
            <h2>Section B</h2>
          </>
        ),
      }),
    );

    await screen.findByRole("navigation", { name: "On this page" });
    expect(screen.getByRole("link", { name: "Section A" })).toHaveAttribute(
      "href",
      "#section-a",
    );
    expect(screen.getByRole("link", { name: "Section B" })).toHaveAttribute(
      "href",
      "#section-b",
    );
  });

  it("runs a page's named sql blocks through the query registry", async () => {
    const db = new FakeDuckDb();
    renderPage(
      page({
        sqlBlocks: [{ name: "orders", sql: "select * from orders" }],
        default: function Probe() {
          const results = useQueryResults();
          return <p data-testid="status">{results.orders?.status ?? "none"}</p>;
        },
      }),
      "biac",
      db,
    );

    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    );
    expect(db.queries.map((q) => q.sql)).toEqual(["select * from orders"]);
  });

  it("hides the editor's edit flag from a fence's params and does not re-run it when the flag goes", async () => {
    // Arrange
    const db = new FakeDuckDb();
    const router = renderPage(
      page({
        sqlBlocks: [
          {
            name: "leak",
            sql: "select {{params.edit}} as leaked, {{params.region}} as region",
          },
        ],
        default: function Probe() {
          const status = useQueryResults().leak?.status ?? "none";
          return <p data-testid="status">{status}</p>;
        },
      }),
      "biac",
      db,
      "/?edit=true&region=West",
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("success"),
    );

    // Act
    await act(() => router.history.push("/?region=West"));

    // Assert
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ region: "West" }),
    );
    expect(db.queries).toEqual([
      { sql: "select ? as leaked, ? as region", params: [null, "West"] },
    ]);
  });

  it("gives a hot-swapped page a fresh filter scope and keeps unchanged query results", async () => {
    const db = new FakeDuckDb();
    const scopes = new Set<unknown>();
    const version = (label: string) =>
      page({
        sqlBlocks: [{ name: "orders", sql: "select * from orders" }],
        default: function Probe() {
          scopes.add(usePageFilters());
          const status = useQueryResults().orders?.status ?? "none";
          return <p data-testid="status">{`${label} ${status}`}</p>;
        },
      });
    const swap = renderSwappablePage(version("v1"), db);
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("v1 success"),
    );

    await swap(version("v2"));

    expect(screen.getByTestId("status")).toHaveTextContent("v2 success");
    expect(scopes.size).toBe(2);
    expect(db.queries.map((q) => q.sql)).toEqual(["select * from orders"]);
  });

  it("renders a named sql fence's result table through the pre map", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ n: 1 }];
    renderPage(
      page({
        sqlBlocks: [{ name: "q", sql: "select * from orders" }],
        default: ({ components }) => {
          const Pre = components?.pre ?? "pre";
          return (
            <Pre>
              <code className="language-sql" {...{ meta: "q", display: "" }}>
                select * from orders
              </code>
            </Pre>
          );
        },
      }),
      "biac",
      db,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "1" })).toBeInTheDocument();
  });

  it("renders a Table widget through the component map, bound by name", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ region: "West", orders: 140 }];
    renderPage(
      page({
        sqlBlocks: [{ name: "q", sql: "select * from orders" }],
        default: ({ components }) => {
          const TableWidget = components?.Table;
          return TableWidget ? <TableWidget data="q" /> : <p>Table missing</p>;
        },
      }),
      "biac",
      db,
    );

    expect(await screen.findByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "West" })).toBeInTheDocument();
  });

  it("renders the value widgets through the component map, bound by name", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ revenue: 1234567, wow_pct: 0.052 }];
    renderPage(
      page({
        sqlBlocks: [{ name: "q", sql: "select * from orders" }],
        default: ({ components }) => {
          const ValueWidget = components?.Value;
          const DeltaWidget = components?.Delta;
          const SparklineWidget = components?.Sparkline;
          return ValueWidget && DeltaWidget && SparklineWidget ? (
            <>
              <ValueWidget data="q" column="revenue" fmt="usd" />
              <DeltaWidget data="q" column="wow_pct" fmt="pct1" />
              <SparklineWidget data="q" y="revenue" />
            </>
          ) : (
            <p>widget missing</p>
          );
        },
      }),
      "biac",
      db,
    );

    expect(await screen.findByText("$1.2M")).toBeInTheDocument();
    expect(screen.getByText("+5.2%")).toBeInTheDocument();
    expect(screen.getByRole("img")).toBeInTheDocument();
  });

  it("renders chart widgets through the component map, bound by name", async () => {
    const db = new FakeDuckDb();
    db.rows = [{ region: "West", orders: 140 }];
    renderPage(
      page({
        sqlBlocks: [{ name: "q", sql: "select * from orders" }],
        default: ({ components }) => {
          const BarChartWidget = components?.BarChart;
          const LineChartWidget = components?.LineChart;
          const AreaChartWidget = components?.AreaChart;
          return BarChartWidget && LineChartWidget && AreaChartWidget ? (
            <>
              {/* jsdom has no canvas — the tags render through the svg seam. */}
              <BarChartWidget data="q" x="region" y="orders" renderer="svg" />
              <LineChartWidget data="q" x="region" y="orders" renderer="svg" />
              <AreaChartWidget data="q" x="region" y="orders" renderer="svg" />
            </>
          ) : (
            <p>widget missing</p>
          );
        },
      }),
      "biac",
      db,
    );

    // The ready mark lands after echarts' entry animation — ~1.5s under
    // jsdom — so this waits well past the 1s default.
    await waitFor(
      () =>
        expect(document.querySelectorAll("[data-echarts-ready]")).toHaveLength(
          3,
        ),
      { timeout: 4000 },
    );
  });

  it("renders the markdown widgets through the component map", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          const CalloutWidget = components?.Callout;
          const NoteWidget = components?.Note;
          const LineBreakWidget = components?.LineBreak;
          const DetailsWidget = components?.Details;
          return CalloutWidget &&
            NoteWidget &&
            LineBreakWidget &&
            DetailsWidget ? (
            <>
              <CalloutWidget type="warning" title="Concentration risk">
                watch the West
              </CalloutWidget>
              <NoteWidget>source: warehouse</NoteWidget>
              <LineBreakWidget lines={2} />
              <DetailsWidget title="Metric definitions">defs</DetailsWidget>
            </>
          ) : (
            <p>widget missing</p>
          );
        },
      }),
    );

    const note = await screen.findByRole("note");
    expect(note).toHaveTextContent("watch the West");
    expect(screen.getByText("source: warehouse")).toBeInTheDocument();
    expect(document.querySelectorAll("br")).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: "Metric definitions" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("hides the toc when front-matter sets table_of_contents: false", async () => {
    renderPage(
      page({
        frontmatter: { table_of_contents: false },
        default: () => (
          <>
            <h2>Section A</h2>
            <h2>Section B</h2>
          </>
        ),
      }),
    );

    await screen.findByRole("main");
    expect(
      screen.queryByRole("navigation", { name: "On this page" }),
    ).toBeNull();
  });

  // jsdom computes no layout, so the width caps are asserted as the
  // Tailwind classes that carry them.
  it.each([{}, { page_width: "article" as const }])(
    "keeps the reading column caps for layout %o",
    async (layout) => {
      renderPage(page({ layout }));

      const main = await screen.findByRole("main");
      expect(main).toHaveClass("max-w-4xl");
      expect(main.parentElement).toHaveClass("max-w-6xl");
    },
  );

  it("drops both width caps when the page sets page_width: full", async () => {
    renderPage(page({ layout: { page_width: "full" } }));

    const main = await screen.findByRole("main");
    expect(main).not.toHaveClass("max-w-4xl");
    expect(main.parentElement).not.toHaveClass("max-w-6xl");
  });
});
