import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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
import { MarkdownPage } from "./markdown-page";
import { useQueryResults } from "./query-registry";
import type { CompiledPageModule } from "./types";

function renderPage(
  page: CompiledPageModule,
  siteTitle = "biac",
  db?: DuckDbService,
) {
  const rootRoute = createRootRoute({
    component: () => <MarkdownPage page={page} siteTitle={siteTitle} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
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
}

function page(partial: Partial<CompiledPageModule>): CompiledPageModule {
  return {
    default: () => null,
    frontmatter: {},
    title: null,
    sqlBlocks: [],
    sqlTables: {},
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
              <code className="language-sql" {...{ meta: "q" }}>
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
});
