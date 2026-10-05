import { afterEach, describe, expect, it, vi } from "vitest";
import { registerSource } from "./register-source";

class FakeFileRegistry {
  readonly urls: { name: string; url: string }[] = [];
  async registerFileURL(name: string, url: string): Promise<void> {
    this.urls.push({ name, url });
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
        `CREATE TABLE "orders" AS FROM 'data/orders.${ext}'`,
      ]);
      expect(connection.inserted).toEqual([]);
    },
  );

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
      `CREATE TABLE "we""ird" AS FROM 'data/it''x.csv'`,
    ]);
  });
});
