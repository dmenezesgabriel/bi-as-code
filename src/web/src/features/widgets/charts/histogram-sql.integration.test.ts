import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clauseInterval } from "../../crossfilter/clause";
import type { FilterPredicate } from "../../crossfilter/types";
import type { InterpolatedQuery } from "../../pages/interpolate";
import { histogramQuery } from "./histogram-sql";
import { fromHistogramBins, toHistogram } from "./to-histogram";
import type { Row } from "../../data/types";
import type { HistogramModel } from "./types";
import { NodeDuckDb } from "../../data/node-duckdb.fixture";

const FLIGHTS = fileURLToPath(
  new URL("../../../../../../data/flights.parquet", import.meta.url),
);
// The fence every `pages/crossfilter-scale.md` histogram reads.
const FENCE: InterpolatedQuery = {
  sql: "select delay, distance, time\nfrom flights",
  params: [],
  errors: [],
};
const KEEP_ALL: FilterPredicate = { sql: "true", params: [] };
const COLUMNS = ["delay", "distance", "time"] as const;

const DISTANCE_WINDOW = [500, 1200] as const;

let db: NodeDuckDb;
// The fence's raw rows, materialized once — the client-side reference.
let raw: Row[];

// Opening DuckDB and scanning the parquet fixture takes ~5s alone on a
// loaded host — half vitest's 10s hook default, which a shared suite run
// then overruns.
beforeAll(async () => {
  db = await NodeDuckDb.open();
  db.rows(
    `create view flights as select * from read_parquet('${FLIGHTS.replaceAll("'", "''")}')`,
  );
  raw = db.rows(FENCE.sql);
}, 30_000);

afterAll(() => db.close());

function sqlModel(
  value: string,
  predicate: FilterPredicate,
  binCount?: number,
): HistogramModel {
  const query = histogramQuery(FENCE, predicate, { value, binCount });
  return fromHistogramBins(db.rows(query.sql, query.params), {
    value,
    binCount,
  });
}

describe("histogramQuery over data/flights.parquet", () => {
  describe("unfiltered", () => {
    it.each(COLUMNS)(
      "bins %s exactly as toHistogram bins the fence's raw rows",
      (value) => {
        const model = sqlModel(value, KEEP_ALL);

        expect(model).toEqual(toHistogram(raw, { value }));
      },
    );

    it("honours binCount like toHistogram", () => {
      const model = sqlModel("delay", KEEP_ALL, 12);

      expect(model).toEqual(toHistogram(raw, { value: "delay", binCount: 12 }));
    });
  });

  describe("with a series column", () => {
    const SPLIT: InterpolatedQuery = {
      sql: "select delay, case when time < 12 then 'morning' else 'later' end as half\nfrom flights",
      params: [],
      errors: [],
    };

    it("orders series and counts them as toHistogram does", () => {
      const spec = { value: "delay", series: "half" };
      const query = histogramQuery(SPLIT, KEEP_ALL, spec);

      const model = fromHistogramBins(db.rows(query.sql, query.params), spec);

      expect(model).toEqual(toHistogram(db.rows(SPLIT.sql), spec));
    });
  });

  describe("under a distance interval", () => {
    const predicate = clauseInterval("distance", DISTANCE_WINDOW, {
      source: {},
    }).predicate as FilterPredicate;
    const [low, high] = DISTANCE_WINDOW;
    const kept = (): Row[] =>
      raw.filter((row) => {
        const distance = Number(row.distance);
        return distance >= low && distance <= high;
      });

    it.each(COLUMNS)("keeps %s on the unfiltered domain", (value) => {
      const full = sqlModel(value, KEEP_ALL);

      const filtered = sqlModel(value, predicate);

      expect(filtered.bins).toEqual(full.bins);
    });

    it.each(COLUMNS)("counts only the kept %s rows, bin by bin", (value) => {
      const values = kept().map((row) => Number(row[value]));

      const filtered = sqlModel(value, predicate);

      const last = filtered.bins.length - 1;
      const expected = filtered.bins.map(
        (bin, i) =>
          values.filter(
            (v) => v >= bin.start && (i === last ? v <= bin.end : v < bin.end),
          ).length,
      );
      expect(filtered.series[0]?.counts).toEqual(expected);
    });
  });
});
