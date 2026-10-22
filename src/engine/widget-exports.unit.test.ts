import { describe, expect, it } from "vitest";
import {
  blockClosure,
  specForWidget,
  tablesForBlocks,
  widgetEntrySource,
} from "./widget-exports.js";
import type { ExportedWidgetTag, SqlBlock, SqlTableMap } from "./types.js";

const block = (name: string, sql: string): SqlBlock => ({ name, sql });

describe("blockClosure", () => {
  it("starts at the named block alone when its sql names no other", () => {
    const blocks = [block("a", "select 1"), block("b", "select 2")];

    expect(blockClosure("a", blocks)).toEqual([block("a", "select 1")]);
  });

  it("follows {{name}} tokens transitively, in page order", () => {
    const blocks = [
      block("a", "select * from ({{c}})"),
      block("b", "select 2"),
      block("c", "select * from ({{b}})"),
    ];

    expect(blockClosure("a", blocks).map((b) => b.name)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("does not follow params or translations tokens", () => {
    const blocks = [
      block("a", "select {{params.r}} as r, {{$translations.k}} from t"),
    ];

    expect(blockClosure("a", blocks)).toEqual([blocks[0]!]);
  });

  it("terminates on a cycle and keeps every block of it", () => {
    const blocks = [
      block("a", "select * from ({{b}})"),
      block("b", "select * from ({{a}})"),
    ];

    expect(blockClosure("a", blocks).map((b) => b.name)).toEqual(["a", "b"]);
  });

  it("ignores a token naming no block on the page", () => {
    const blocks = [block("a", "select * from ({{missing}})")];

    expect(blockClosure("a", blocks)).toEqual([blocks[0]!]);
  });
});

describe("tablesForBlocks", () => {
  it("keeps the tables the closure's sql names and drops the rest", () => {
    const tables: SqlTableMap = {
      orders: "data/orders.parquet",
      regions: "data/regions.csv",
    };

    expect(
      tablesForBlocks([block("a", "select * from orders")], tables),
    ).toEqual({ orders: "data/orders.parquet" });
  });

  it("does not match a longer name's prefix", () => {
    const tables: SqlTableMap = {
      orders: "data/orders.parquet",
      orders_x: "data/orders-x.parquet",
    };

    expect(
      tablesForBlocks([block("a", "select * from orders_x")], tables),
    ).toEqual({ orders_x: "data/orders-x.parquet" });
  });

  it("keeps a table named only inside a closure dependency", () => {
    const tables: SqlTableMap = { regions: "data/regions.csv" };

    expect(
      tablesForBlocks(
        [
          block("a", "select * from ({{b}})"),
          block("b", "select * from regions"),
        ],
        tables,
      ),
    ).toEqual({ regions: "data/regions.csv" });
  });
});

describe("specForWidget", () => {
  const tag: ExportedWidgetTag = {
    name: "revenue-by-region",
    widget: "BarChart",
    props: { data: "region_revenue", x: "region", y: "revenue" },
  };

  it("bakes the closure, the merged tables filtered to it, and the merged cards", () => {
    const page = {
      sqlBlocks: [
        block("region_revenue", "select * from ({{totals}})"),
        block("totals", "select sum(amount) as revenue from orders"),
        block("unused", "select * from regions"),
      ],
      sqlTables: { orders: "data/orders.parquet" },
      layout: { cards: true },
    };
    const config = {
      sqlTables: { regions: "data/regions.csv" },
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
    } as const;

    const spec = specForWidget(tag, page, config.sqlTables, config.layout);

    expect(spec).toEqual({
      widget: "BarChart",
      props: { data: "region_revenue", x: "region", y: "revenue" },
      sqlBlocks: [
        block("region_revenue", "select * from ({{totals}})"),
        block("totals", "select sum(amount) as revenue from orders"),
      ],
      sqlTables: { orders: "data/orders.parquet" },
      cards: true,
    });
  });

  it("falls cards through to the project default when the page sets none", () => {
    const page = {
      sqlBlocks: [block("q", "select * from orders")],
      sqlTables: { orders: "data/orders.parquet" },
      layout: {},
    };
    const config = {
      sqlTables: {},
      layout: {
        page_width: "article",
        cards: false,
        table_of_contents: true,
        table_of_contents_label: "On this page",
      },
    } as const;

    expect(
      specForWidget(tag, page, config.sqlTables, config.layout).cards,
    ).toBe(false);
  });
});

describe("widgetEntrySource", () => {
  const module = {
    name: "revenue-by-region",
    file: "pages/orders-dashboard.md",
    spec: {
      widget: "BarChart",
      props: { data: "region_revenue", x: "region", y: "revenue" },
      sqlBlocks: [block("region_revenue", "select 1")],
      sqlTables: { orders: "data/orders.parquet" },
      cards: true,
    },
  };

  it("imports the web mount entry and module runtime by absolute path, spec baked", () => {
    const source = widgetEntrySource(module, {
      mountWidget: "/repo/src/web/src/features/widget-module/mount-widget.tsx",
      moduleRuntime:
        "/repo/src/web/src/features/widget-module/module-runtime.ts",
    });

    expect(source).toContain(
      'import { mountWidget } from "/repo/src/web/src/features/widget-module/mount-widget.tsx";',
    );
    expect(source).toContain(
      'import { moduleDuckDbLive } from "/repo/src/web/src/features/widget-module/module-runtime.ts";',
    );
    expect(source).toContain('"data":"region_revenue"');
    expect(source).toContain('"sql":"select 1"');
  });

  it("default-exports a mount whose layer the host cannot override", () => {
    const source = widgetEntrySource(module, {
      mountWidget: "/m.tsx",
      moduleRuntime: "/r.ts",
    });

    expect(source).toContain(
      "export default (container, options = {}) => mountWidget(container, spec, { ...options, layer });",
    );
  });
});
