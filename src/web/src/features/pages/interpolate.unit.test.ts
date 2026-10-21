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

  it("inlines a query file by its root path, binding the file's own params", () => {
    const out = interpolateQuery(
      "select * from {{/queries/orders}} where r = {{params.region}}",
      {
        params: { region: "West", weeks: "4" },
        queries: {
          "/queries/orders":
            "select * from orders where week > {{params.weeks}}",
        },
      },
    );

    expect(out.sql).toBe(
      "select * from (select * from orders where week > ?) where r = ?",
    );
    expect(out.params).toEqual(["4", "West"]);
  });

  it("rejects a cycle between two query files", () => {
    const out = interpolateQuery(
      "select * from {{/queries/b}}",
      {
        params: {},
        queries: {
          "/queries/a": "select * from {{/queries/b}}",
          "/queries/b": "select * from {{/queries/a}}",
        },
      },
      new Set(["/queries/a"]),
    );

    expect(out.errors).toEqual(["Circular query reference: {{/queries/a}}"]);
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

  describe("{{$translations.key}}", () => {
    const translations = {
      region_west: "l'Ouest",
      chart: { title: "Chiffre d'affaires" },
    };

    it("binds a key's text as a ? arg, in order with {{params.*}}", () => {
      const out = interpolateQuery(
        "select * from t where a = {{params.a}} and label = {{ $translations.region_west }}",
        { params: { a: 1 }, queries: {}, translations },
      );

      expect(out.sql).toBe("select * from t where a = ? and label = ?");
      expect(out.params).toEqual([1, "l'Ouest"]);
      expect(out.errors).toEqual([]);
    });

    it("binds a nested key by its dotted path", () => {
      const out = interpolateQuery("select {{$translations.chart.title}}", {
        params: {},
        queries: {},
        translations,
      });

      expect(out.params).toEqual(["Chiffre d'affaires"]);
    });

    it("binds a token inside an inlined query file", () => {
      const out = interpolateQuery("select * from {{/queries/west}}", {
        params: {},
        queries: {
          "/queries/west":
            "select * from t where label = {{$translations.region_west}}",
        },
        translations,
      });

      expect(out.sql).toBe("select * from (select * from t where label = ?)");
      expect(out.params).toEqual(["l'Ouest"]);
    });

    it("errors on a key the translations do not have, naming the token", () => {
      const out = interpolateQuery("select {{$translations.region_wst}}", {
        params: {},
        queries: {},
        translations,
      });

      expect(out.errors).toEqual([
        "Undefined translation key {{$translations.region_wst}} — expected a key of translations.yaml whose value is text",
      ]);
    });

    it("errors on a key that names nested keys rather than text", () => {
      const out = interpolateQuery("select {{$translations.chart}}", {
        params: {},
        queries: {},
        translations,
      });

      expect(out.errors[0]).toContain("{{$translations.chart}}");
    });

    it("errors on every key when the page has no translations", () => {
      const out = interpolateQuery("select {{$translations.region_west}}", {
        params: {},
        queries: {},
      });

      expect(out.errors[0]).toContain("{{$translations.region_west}}");
    });

    it("does not read a key inherited from Object.prototype", () => {
      const out = interpolateQuery("select {{$translations.constructor}}", {
        params: {},
        queries: {},
        translations,
      });

      expect(out.errors[0]).toContain("{{$translations.constructor}}");
    });
  });
});
