import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { diskQueryFiles } from "./disk-query-files.js";

let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "biac-queries-"));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function writeQuery(name: string, sql: string): void {
  const file = join(root, "queries", name);
  mkdirSync(join(file, ".."), { recursive: true });
  writeFileSync(file, sql);
}

describe("diskQueryFiles.read", () => {
  it("reads a file under queries/, subdirectories included", async () => {
    writeQuery("sales/totals.sql", "select 1");

    const sql = await diskQueryFiles(root).read("sales/totals.sql");

    expect(sql).toBe("select 1");
  });

  it("returns undefined for a missing file", async () => {
    expect(await diskQueryFiles(root).read("absent.sql")).toBeUndefined();
  });

  it("returns undefined for a path that escapes queries/", async () => {
    writeFileSync(join(root, "secret.sql"), "select 'secret'");

    expect(await diskQueryFiles(root).read("../secret.sql")).toBeUndefined();
  });
});

describe("diskQueryFiles.list", () => {
  it("lists every .sql file under queries/ by its path there", async () => {
    writeQuery("a.sql", "select 1");
    writeQuery("sales/totals.sql", "select 2");
    writeQuery("notes.txt", "not a query");

    const names = await diskQueryFiles(root).list();

    expect(names.sort()).toEqual(["a.sql", "sales/totals.sql"]);
  });

  it("lists nothing when the project has no queries/ directory", async () => {
    expect(await diskQueryFiles(root).list()).toEqual([]);
  });
});
