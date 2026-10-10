import type { FilterPredicate } from "../../crossfilter/types";
import { identifier } from "../../data/sql-identifier";
import type { InterpolatedQuery } from "../../pages/interpolate";
import { binRule } from "./to-histogram";
import type { BinRule, HistogramSpec } from "./types";

/** Bin width and count SQL over the `stats` columns, plus their bound args. */
interface GeometrySql {
  readonly width: string;
  readonly count: string;
  readonly params: readonly unknown[];
}

const RICE_COUNT = "greatest(1, ceil(2 * cbrt(n)))";

/**
 * A cross-filtered histogram re-query that returns bin counts, not rows:
 * the bin domain (min, max, rice `n`) comes from the **unfiltered** block —
 * the full extent, so bars stay put while filtering and agree with the
 * client-side `toHistogram` binning of the unfiltered fence — and only the
 * rows `predicate` keeps are counted. The geometry follows `binRule`, and
 * the max clamps into the last bin as `toHistogram`'s `binIndex` does.
 * One row per non-empty (bin, series) pair: `bin_index`, `lo`,
 * `bin_width`, `bin_count`, `frequency`, plus `series`/`first_seen` when
 * `series` is bound. Every value binds as a `?` arg (ADR-0005).
 *
 * @example
 * histogramQuery(block, { sql: "region = ?", params: ["West"] }, { value: "amount" });
 * // → { sql: "with base as (…), stats as (…) … group by all", params: [...block.params, "West"] }
 */
export function histogramQuery(
  block: InterpolatedQuery,
  predicate: FilterPredicate,
  spec: HistogramSpec,
): InterpolatedQuery {
  const geometry = geometrySql(binRule(spec));
  const value = (alias: string): string =>
    `try_cast(${alias}${identifier(spec.value)} as double)`;
  const sql = [
    `with base as (${baseSql(block, spec)}),`,
    `stats as (select min(${value("")}) as lo, max(${value("")}) as hi, count(${value("")}) as n from base),`,
    `geometry as (select lo, ${geometry.width} as bin_width, ${geometry.count} as bin_count from stats)`,
    `select least(floor((${value("f.")} - g.lo) / g.bin_width), g.bin_count - 1) as bin_index, g.lo, g.bin_width, g.bin_count,${seriesColumns(spec)} count(*) as frequency`,
    `from (select * from base where ${predicate.sql}) as f cross join geometry as g`,
    `where ${value("f.")} is not null`,
    "group by all",
  ].join("\n");
  return {
    sql,
    params: [...block.params, ...geometry.params, ...predicate.params],
    errors: [],
  };
}

/** The block, numbered in scan order when series need a first-appearance key. */
function baseSql(block: InterpolatedQuery, spec: HistogramSpec): string {
  if (spec.series === undefined) return block.sql;
  return `select *, row_number() over () as __biac_ordinal from (${block.sql})`;
}

function seriesColumns(spec: HistogramSpec): string {
  if (spec.series === undefined) return "";
  return ` f.${identifier(spec.series)} as series, min(f.__biac_ordinal) as first_seen,`;
}

/** `toHistogram`'s `resolveBins` in SQL; `lo = hi` collapses to one bin. */
function geometrySql(rule: BinRule): GeometrySql {
  if (rule.binWidth !== undefined) {
    return {
      width: "cast(? as double)",
      count:
        "case when lo = hi then 1 else ceil((hi - lo) / cast(? as double)) end",
      params: [rule.binWidth, rule.binWidth],
    };
  }
  const count = rule.binCount === undefined ? RICE_COUNT : "cast(? as double)";
  const countParams = rule.binCount === undefined ? [] : [rule.binCount];
  return {
    width: `case when lo = hi then 1 else (hi - lo) / ${count} end`,
    count: `case when lo = hi then 1 else ${count} end`,
    params: [...countParams, ...countParams],
  };
}
