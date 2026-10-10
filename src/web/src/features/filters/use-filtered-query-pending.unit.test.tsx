import { act, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QueryClient } from "../crossfilter/types";
import { FakeDuckDb } from "../data/fake-duckdb";
import type { QueryResult, SqlBlock } from "../pages/types";
import { renderWithRegistry } from "../widgets/value/registry-harness";
import type { Filters } from "./filters";
import { usePageFilters } from "./page-filters-context";
import { useFilteredQueryClient } from "./use-filtered-query-rows";

const ORDERS_BLOCK: SqlBlock = { name: "orders", sql: "select * from orders" };

interface PendingRead {
  result: QueryResult | undefined;
  settled: QueryResult | undefined;
  pending: boolean;
  client: QueryClient;
  filters: Filters | undefined;
}

/** Records every render's read, so a test can drive the client directly. */
class PendingReadLog {
  readonly reads: PendingRead[] = [];

  latest(): PendingRead {
    const read = this.reads.at(-1);
    if (!read) throw new Error("PendingProbe has not rendered yet");
    return read;
  }
}

function PendingProbe({ log }: { log: PendingReadLog }): null {
  const { result, settled, pending, client } = useFilteredQueryClient(
    "orders",
    ["region"],
  );
  const filters = usePageFilters();
  log.reads.push({ result, settled, pending, client, filters });
  return null;
}

async function renderFilteredProbe(
  db = FakeDuckDb.withRows([{ region: "West" }]),
): Promise<PendingReadLog> {
  const log = new PendingReadLog();
  renderWithRegistry(<PendingProbe log={log} />, {
    db,
    blocks: [ORDERS_BLOCK],
    url: "?region=West",
  });
  await waitFor(() => expect(log.latest().result?.status).toBe("success"));
  return log;
}

describe("useFilteredQueryClient while a re-query is pending", () => {
  it("keeps the settled rows apart from the pending flag", async () => {
    const log = await renderFilteredProbe();
    const { client, settled } = log.latest();

    act(() => client.queryPending());

    expect(log.latest().result).toEqual({ status: "loading" });
    expect(log.latest().settled).toBe(settled);
    expect(log.latest().pending).toBe(true);
  });

  it("lands a result batched with the next publish's pending", async () => {
    const log = await renderFilteredProbe();
    const { client } = log.latest();
    const rows = [{ region: "West", n: 2 }];

    // The coordinator delivers a queued publish in the task the previous
    // query settles in, so React renders both updates at once.
    act(() => {
      client.queryResult(rows);
      client.queryPending();
    });

    expect(log.latest().settled).toEqual({ status: "success", rows });
    expect(log.latest().pending).toBe(true);
    expect(log.latest().result).toEqual({ status: "loading" });
  });

  it("forgets the filtered result once no clause narrows", async () => {
    const db = FakeDuckDb.withRows([{ region: "West" }]);
    const log = await renderFilteredProbe(db);
    const { filters } = log.latest();
    act(() => filters?.get("region")?.applySerialized(""));
    db.holdWhen = () => new Promise(() => {});

    act(() => filters?.get("region")?.applySerialized("North"));

    // A later clause must not resurface rows an earlier one narrowed to —
    // the registry's rows were painted in between.
    await waitFor(() => expect(log.latest().pending).toBe(true));
    expect(log.latest().settled).toEqual({ status: "loading" });
  });

  it("clears pending when the result lands", async () => {
    const log = await renderFilteredProbe();
    const { client } = log.latest();
    act(() => client.queryPending());

    act(() => client.queryResult([{ region: "West", n: 3 }]));

    expect(log.latest().pending).toBe(false);
    expect(log.latest().result).toEqual({
      status: "success",
      rows: [{ region: "West", n: 3 }],
    });
  });
});
