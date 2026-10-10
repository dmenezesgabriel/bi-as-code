import { describe, expect, it } from "vitest";
import type { InterpolatedQuery } from "../../pages/interpolate";
import type { FilterPredicate } from "../../crossfilter/types";
import { histogramQuery } from "./histogram-sql";

const block: InterpolatedQuery = {
  sql: "select * from orders where year = ?",
  params: [2024],
  errors: [],
};
const predicate: FilterPredicate = { sql: "region = ?", params: ["West"] };

describe("histogramQuery", () => {
  describe("domain", () => {
    it("reads min, max and count from the unfiltered block", () => {
      const query = histogramQuery(block, predicate, { value: "amount" });

      expect(query.sql).toContain(
        "with base as (select * from orders where year = ?)",
      );
      expect(query.sql).toMatch(
        /stats as \(select min\(.+\) as lo, max\(.+\) as hi, count\(.+\) as n from base\)/,
      );
    });

    it("counts only the rows the predicate keeps", () => {
      const query = histogramQuery(block, predicate, { value: "amount" });

      expect(query.sql).toContain("(select * from base where region = ?)");
    });

    it("casts and quotes the value column", () => {
      const query = histogramQuery(block, predicate, { value: 'odd"amount' });

      expect(query.sql).toContain('try_cast(f."odd""amount" as double)');
    });

    it("clamps the max into the last bin", () => {
      const query = histogramQuery(block, predicate, { value: "amount" });

      expect(query.sql).toContain(
        'least(floor((try_cast(f."amount" as double) - g.lo) / g.bin_width), g.bin_count - 1) as bin_index',
      );
    });
  });

  describe("params", () => {
    it("binds block, then rule, then predicate params under binCount", () => {
      const query = histogramQuery(block, predicate, {
        value: "amount",
        binCount: 12,
      });

      expect(query.params).toEqual([2024, 12, 12, "West"]);
      expect(query.errors).toEqual([]);
    });

    it("lets binWidth win over binCount", () => {
      const query = histogramQuery(block, predicate, {
        value: "amount",
        binCount: 12,
        binWidth: 5,
      });

      expect(query.params).toEqual([2024, 5, 5, "West"]);
      expect(query.sql).toContain("ceil((hi - lo) / cast(? as double))");
    });

    it("binds no rule params under the rice rule", () => {
      const query = histogramQuery(block, predicate, { value: "amount" });

      expect(query.params).toEqual([2024, "West"]);
      expect(query.sql).toContain("ceil(2 * cbrt(n))");
    });
  });

  describe("series", () => {
    it("groups by the series column and records its first appearance", () => {
      const query = histogramQuery(block, predicate, {
        value: "amount",
        series: "region",
      });

      expect(query.sql).toContain('f."region" as series');
      expect(query.sql).toContain("min(f.__biac_ordinal) as first_seen");
      expect(query.sql).toContain("row_number() over () as __biac_ordinal");
    });

    it("leaves the ordinal out when no series is bound", () => {
      const query = histogramQuery(block, predicate, { value: "amount" });

      expect(query.sql).not.toContain("ordinal");
    });
  });
});
