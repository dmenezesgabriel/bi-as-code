import { describe, expect, it } from "vitest";
import { attributedToQueryFile } from "./query-file-source";
import type { QueryResult } from "./types";

const failed: QueryResult = {
  status: "error",
  message: 'Parser Error: syntax error at or near "selec"',
};

describe("a query file block's result", () => {
  it("names the file ahead of its error", () => {
    const result = attributedToQueryFile("/queries/region_orders", failed);

    expect(result).toEqual({
      status: "error",
      message:
        'queries/region_orders.sql: Parser Error: syntax error at or near "selec"',
    });
  });

  it("names a file in a subdirectory of queries/ by its full path", () => {
    const result = attributedToQueryFile("/queries/sales/totals", failed);

    expect(result).toMatchObject({
      message: expect.stringMatching(/^queries\/sales\/totals\.sql: /),
    });
  });

  it("passes a success through unchanged", () => {
    const success: QueryResult = { status: "success", rows: [] };

    expect(attributedToQueryFile("/queries/region_orders", success)).toBe(
      success,
    );
  });
});

describe("a page fence's result", () => {
  it("keeps the error as the warehouse wrote it", () => {
    expect(attributedToQueryFile("orders", failed)).toBe(failed);
  });
});
