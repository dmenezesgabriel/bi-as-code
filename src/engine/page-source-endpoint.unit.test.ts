import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import {
  isCrossOriginRequest,
  parseSourceBody,
  readBodyCapped,
  resolvePageFile,
  writePageAtomically,
} from "./page-source-endpoint.js";

afterEach(() => {
  cleanupProjects();
});

function makePagesDir(): string {
  const root = makeTempProject("biac-page-source-");
  writeProjectFile(root, "pages/weekly.md", "# Weekly\n");
  writeProjectFile(root, "pages/nested/deep.mdx", "# Deep\n");
  writeProjectFile(root, "pages/notes.txt", "not a page\n");
  writeProjectFile(root, "secret.md", "# Outside\n");
  mkdirSync(join(root, "pages/folder.md"));
  return join(root, "pages");
}

describe("resolvePageFile", () => {
  it("resolves an existing .md page under pages/", () => {
    const pagesDir = makePagesDir();

    const file = resolvePageFile(pagesDir, "/weekly.md");

    expect(file).toBe(join(pagesDir, "weekly.md"));
  });

  it("resolves a nested .mdx page and ignores the query string", () => {
    const pagesDir = makePagesDir();

    const file = resolvePageFile(pagesDir, "/nested/deep.mdx?t=1");

    expect(file).toBe(join(pagesDir, "nested/deep.mdx"));
  });

  it.each([
    ["a malformed percent-escape", "/%zz.md", 400],
    ["an encoded traversal out of pages/", "/..%2Fsecret.md", 403],
    ["a non-page extension", "/notes.txt", 404],
    ["a missing page — the endpoint never creates pages", "/new.md", 404],
    ["a directory named like a page", "/folder.md", 404],
  ])("rejects %s", (_case, url, status) => {
    const pagesDir = makePagesDir();

    expect(resolvePageFile(pagesDir, url)).toBe(status);
  });
});

describe("isCrossOriginRequest", () => {
  const host = "localhost:5175";

  it.each([
    ["no Origin or Sec-Fetch-Site (curl, address bar)", {}],
    [
      "the dev server's own origin",
      { origin: "http://localhost:5175", "sec-fetch-site": "same-origin" },
    ],
    [
      "Sec-Fetch-Site none — a user-initiated navigation",
      { "sec-fetch-site": "none" },
    ],
  ])("accepts %s", (_case, headers) => {
    expect(isCrossOriginRequest({ host, ...headers })).toBe(false);
  });

  it.each([
    [
      "another localhost port, which vite's default CORS allows",
      { origin: "http://localhost:3000" },
    ],
    ["an opaque Origin", { origin: "null" }],
    [
      "Sec-Fetch-Site same-site — a sibling port is same-site",
      { "sec-fetch-site": "same-site" },
    ],
    ["Sec-Fetch-Site cross-site", { "sec-fetch-site": "cross-site" }],
  ])("rejects %s", (_case, headers) => {
    expect(isCrossOriginRequest({ host, ...headers })).toBe(true);
  });
});

describe("parseSourceBody", () => {
  it("returns the source string of a { source } body", () => {
    expect(parseSourceBody('{"source":"# Hi\\n"}')).toBe("# Hi\n");
  });

  it("accepts an empty source — clearing a page is a valid edit", () => {
    expect(parseSourceBody('{"source":""}')).toBe("");
  });

  it.each([
    ["malformed JSON", "{source"],
    ["a source that is not a string", '{"source":42}'],
    ["a JSON body that is not an object", "null"],
  ])("rejects %s with 400", (_case, body) => {
    expect(parseSourceBody(body)).toBe(400);
  });
});

describe("readBodyCapped", () => {
  it("returns the body text when it fits the limit", async () => {
    const body = Readable.from([Buffer.from("abc"), Buffer.from("def")]);

    expect(await readBodyCapped(body, 6)).toBe("abcdef");
  });

  it("returns 413 once the streamed body exceeds the limit", async () => {
    const body = Readable.from([Buffer.from("abcd"), Buffer.from("efg")]);

    expect(await readBodyCapped(body, 6)).toBe(413);
  });

  it("decodes multi-byte characters split across chunks", async () => {
    const bytes = Buffer.from("é");
    const body = Readable.from([bytes.subarray(0, 1), bytes.subarray(1)]);

    expect(await readBodyCapped(body, 10)).toBe("é");
  });
});

describe("writePageAtomically", () => {
  it("replaces the page's content", async () => {
    const pagesDir = makePagesDir();
    const file = join(pagesDir, "weekly.md");

    await writePageAtomically(file, "# Rewritten\n");

    expect(readFileSync(file, "utf8")).toBe("# Rewritten\n");
  });

  it("leaves no temp file behind in the page's directory", async () => {
    const pagesDir = makePagesDir();
    const before = readdirSync(pagesDir).sort();

    await writePageAtomically(join(pagesDir, "weekly.md"), "# Rewritten\n");

    expect(readdirSync(pagesDir).sort()).toEqual(before);
  });

  it("removes the temp file and rethrows when the rename fails", async () => {
    const pagesDir = makePagesDir();
    const before = readdirSync(pagesDir).sort();

    // Renaming a file over a directory fails with EISDIR.
    await expect(
      writePageAtomically(join(pagesDir, "folder.md"), "# x\n"),
    ).rejects.toThrow(/EISDIR/);

    expect(readdirSync(pagesDir).sort()).toEqual(before);
  });
});
