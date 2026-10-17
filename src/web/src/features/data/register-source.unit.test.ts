import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSource } from "./register-source";

class FakeFileRegistry {
  readonly urls: { name: string; url: string }[] = [];
  /** Every call in order, e.g. `["drop data/a.csv", "register data/a.csv"]`. */
  readonly calls: string[] = [];
  async registerFileURL(name: string, url: string): Promise<void> {
    this.urls.push({ name, url });
    this.calls.push(`register ${name}`);
  }
  async dropFile(name: string): Promise<null> {
    this.calls.push(`drop ${name}`);
    return null;
  }
}

class FakeConnection {
  readonly queries: string[] = [];
  readonly inserted: { buffer: Uint8Array; name: string }[] = [];
  async query(sql: string): Promise<void> {
    this.queries.push(sql);
  }
  async insertArrowFromIPCStream(
    buffer: Uint8Array,
    options: { name?: string },
  ): Promise<void> {
    this.inserted.push({ buffer, name: options.name ?? "" });
  }
}

/** A connection whose every query fails the way duckdb's HTTP reader does. */
class UnreadableSourceConnection extends FakeConnection {
  override async query(sql: string): Promise<void> {
    this.queries.push(sql);
    throw new Error("Failed to open file: data/orders.csv");
  }
}

afterEach(() => vi.unstubAllGlobals());

describe("registerSource", () => {
  it.each(["csv", "json", "parquet"])(
    "registers the data URL over HTTP and materializes a %s source as a table",
    async (ext) => {
      const files = new FakeFileRegistry();
      const connection = new FakeConnection();

      await registerSource(files, connection, "orders", `data/orders.${ext}`);

      expect(files.urls).toEqual([
        {
          name: `data/orders.${ext}`,
          url: `${location.origin}/data/orders.${ext}`,
        },
      ]);
      expect(connection.queries).toEqual([
        `CREATE OR REPLACE TABLE "orders" AS FROM 'data/orders.${ext}'`,
      ]);
      expect(connection.inserted).toEqual([]);
    },
  );

  it("drops the file before registering it, so a re-registration re-reads it", async () => {
    const files = new FakeFileRegistry();

    await registerSource(files, new FakeConnection(), "orders", "data/a.csv");

    expect(files.calls).toEqual(["drop data/a.csv", "register data/a.csv"]);
  });

  it("fetches an arrow file in full and inserts its IPC stream", async () => {
    const files = new FakeFileRegistry();
    const connection = new FakeConnection();
    const bytes = new Uint8Array([65, 82, 82, 79, 87, 49]); // "ARROW1" magic
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(bytes, { status: 200 })),
    );

    await registerSource(files, connection, "orders", "data/orders.arrow");

    expect(fetch).toHaveBeenCalledWith(`${location.origin}/data/orders.arrow`);
    expect(connection.inserted).toHaveLength(1);
    expect(connection.inserted[0]?.name).toBe("orders");
    expect(Array.from(connection.inserted[0]!.buffer)).toEqual([
      65, 82, 82, 79, 87, 49,
    ]);
    expect(connection.queries).toEqual([]);
  });

  it("fails the arrow insert when the file fetch fails", async () => {
    const files = new FakeFileRegistry();
    const connection = new FakeConnection();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("missing", { status: 404 })),
    );

    await expect(
      registerSource(files, connection, "orders", "data/missing.arrow"),
    ).rejects.toThrow("data/missing.arrow");
    expect(connection.inserted).toEqual([]);
  });

  it("escapes quotes in the table name and source for the CREATE TABLE", async () => {
    const files = new FakeFileRegistry();
    const connection = new FakeConnection();

    await registerSource(files, connection, 'we"ird', "data/it'x.csv");

    expect(connection.queries).toEqual([
      `CREATE OR REPLACE TABLE "we""ird" AS FROM 'data/it''x.csv'`,
    ]);
  });

  it("does not fetch the source itself when the table registers", async () => {
    vi.stubGlobal("fetch", vi.fn());

    await registerSource(
      new FakeFileRegistry(),
      new FakeConnection(),
      "orders",
      "data/orders.csv",
    );

    expect(fetch).not.toHaveBeenCalled();
  });

  it("replaces duckdb's error with the server's plain-text reason when the source fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response("data loader data/orders.csv.js exited with code 3", {
            status: 500,
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          }),
      ),
    );

    await expect(
      registerSource(
        new FakeFileRegistry(),
        new UnreadableSourceConnection(),
        "orders",
        "data/orders.csv",
      ),
    ).rejects.toThrow(
      `fetch ${location.origin}/data/orders.csv → HTTP 500: data loader data/orders.csv.js exited with code 3`,
    );
  });

  it("keeps duckdb's error when the source fetches fine", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("not,a,table", { status: 200 })),
    );

    await expect(
      registerSource(
        new FakeFileRegistry(),
        new UnreadableSourceConnection(),
        "orders",
        "data/orders.csv",
      ),
    ).rejects.toThrow("Failed to open file: data/orders.csv");
  });

  it("keeps duckdb's error when the diagnostic fetch itself fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    await expect(
      registerSource(
        new FakeFileRegistry(),
        new UnreadableSourceConnection(),
        "orders",
        "data/orders.csv",
      ),
    ).rejects.toThrow("Failed to open file: data/orders.csv");
  });

  it("names a missing file's status without a body when the server sends none", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 404 })),
    );

    await expect(
      registerSource(
        new FakeFileRegistry(),
        new UnreadableSourceConnection(),
        "orders",
        "data/orders.csv",
      ),
    ).rejects.toThrow(
      new RegExp(`^fetch ${location.origin}/data/orders\\.csv → HTTP 404$`),
    );
  });
});
