import { describe, expect, it } from "vitest";
import { interpolateQuery } from "./interpolate";

const noParams = { params: {}, queries: {} };

describe("interpolateQuery", () => {
  it("passes token-free sql through unchanged", () => {
    expect(interpolateQuery("select 1 as n", noParams)).toEqual({
      sql: "select 1 as n",
      params: [],
      errors: [],
    });
  });

  it("binds {{params.name}} as a ? placeholder plus the search-param value", () => {
    const out = interpolateQuery(
      "select * from orders where region = {{params.region}}",
      {
        params: { region: "West" },
        queries: {},
      },
    );

    expect(out.sql).toBe("select * from orders where region = ?");
    expect(out.params).toEqual(["West"]);
    expect(out.errors).toEqual([]);
  });

  it("binds absent params as NULL so the statement still type-checks", () => {
    const out = interpolateQuery(
      "select * from orders where region = {{params.region}}",
      {
        params: {},
        queries: {},
      },
    );

    expect(out.sql).toBe("select * from orders where region = ?");
    expect(out.params).toEqual([null]);
  });

  it("keeps ? placeholders in left-to-right order across several params", () => {
    const out = interpolateQuery(
      "select * from orders where region = {{params.region}} and channel = {{ params.channel }}",
      { params: { region: "West", channel: "store" }, queries: {} },
    );

    expect(out.sql).toBe(
      "select * from orders where region = ? and channel = ?",
    );
    expect(out.params).toEqual(["West", "store"]);
  });

  it("inlines {{name}} as a parenthesized subquery", () => {
    const out = interpolateQuery("select count(*) from {{orders}}", {
      params: {},
      queries: { orders: "select * from orders" },
    });

    expect(out.sql).toBe("select count(*) from (select * from orders)");
    expect(out.errors).toEqual([]);
  });

  it("binds params inside a composed query at the position its ? lands", () => {
    const out = interpolateQuery(
      "select {{params.limit}} as lim, t.* from {{trend}} t where r = {{params.region}}",
      {
        params: { limit: 5, region: "West", weeks: "4" },
        queries: {
          trend: "select * from orders where week > {{params.weeks}}",
        },
      },
    );

    expect(out.sql).toBe(
      "select ? as lim, t.* from (select * from orders where week > ?) t where r = ?",
    );
    expect(out.params).toEqual([5, "4", "West"]);
  });

  it("expands chained query references transitively", () => {
    const out = interpolateQuery("select * from {{a}}", {
      params: {},
      queries: { a: "select * from {{b}}", b: "select 1" },
    });

    expect(out.sql).toBe("select * from (select * from (select 1))");
    expect(out.errors).toEqual([]);
  });

  it("rejects a query referencing itself", () => {
    const out = interpolateQuery(
      "select * from {{loop}}",
      { params: {}, queries: { loop: "select * from {{loop}}" } },
      new Set(["loop"]),
    );

    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toMatch(/[Cc]ircular.*loop/);
  });

  it("rejects a mutual reference cycle", () => {
    const out = interpolateQuery(
      "select * from {{b}}",
      {
        params: {},
        queries: { a: "select * from {{b}}", b: "select * from {{a}}" },
      },
      new Set(["a"]),
    );

    expect(out.errors[0]).toMatch(/[Cc]ircular.*a/);
  });

  it("errors on a {{name}} that is neither a param nor a named query", () => {
    const out = interpolateQuery("select * from {{missing}}", {
      params: {},
      queries: { orders: "select 1" },
    });

    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toContain("missing");
  });

  it("errors on deferred interpolation scopes like {{inputs.x}}", () => {
    const out = interpolateQuery("select {{inputs.region}}", {
      params: {},
      queries: {},
    });

    expect(out.errors).toHaveLength(1);
    expect(out.errors[0]).toContain("inputs.region");
  });
});
