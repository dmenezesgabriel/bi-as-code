import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import { DEFAULT_INTERPRETERS } from "./data-loader-interpreters.js";
import {
  assertImagesResolve,
  brokenImageReason,
  servedDataPaths,
} from "./image-sources.js";

afterEach(() => cleanupProjects());

const SERVED: ReadonlySet<string> = new Set([
  "a.png",
  "nested/a.png",
  "a b.png",
  "island-summary.csv",
]);

describe("brokenImageReason", () => {
  it.each(["https://example.com/a.png", "//cdn.example.com/a.png", ""])(
    "skips %j, which names no file biac serves",
    (src) => {
      const reason = brokenImageReason(src, SERVED);

      expect(reason).toBeUndefined();
    },
  );

  it("skips a data: URI, which carries its own bytes", () => {
    const reason = brokenImageReason("data:image/png;base64,AA==", SERVED);

    expect(reason).toBeUndefined();
  });

  it.each([
    "/data/a.png",
    "/data/nested/a.png",
    "/data/a.png?v=1",
    "/data/a.png#frag",
    "/data/a%20b.png",
    "/data/island-summary.csv",
  ])("accepts %j, which a served file answers", (src) => {
    const reason = brokenImageReason(src, SERVED);

    expect(reason).toBeUndefined();
  });

  it("rejects a /data/ path no file answers, naming the file it wants", () => {
    const reason = brokenImageReason("/data/gone.png", SERVED);

    expect(reason).toBe("no file at data/gone.png");
  });

  it("matches the case exactly, as the data mount does on a case-sensitive disk", () => {
    const reason = brokenImageReason("/data/A.png", SERVED);

    expect(reason).toBe("no file at data/A.png");
  });

  it("rejects a /data/ path that climbs out of data/", () => {
    const reason = brokenImageReason("/data/../a.png", SERVED);

    expect(reason).toMatch(/no file at/);
  });

  it("rejects a malformed %-escape", () => {
    const reason = brokenImageReason("/data/%zz.png", SERVED);

    expect(reason).toMatch(/no file at/);
  });

  it.each(["/logo.png", "/"])(
    "rejects the root-relative %j, because only data/ is served",
    (src) => {
      const reason = brokenImageReason(src, SERVED);

      expect(reason).toMatch(/only data\/ is served/);
    },
  );

  it.each(["a.png", "./a.png", "../a.png"])(
    "rejects the relative %j, whose target depends on the URL's trailing slash",
    (src) => {
      const reason = brokenImageReason(src, SERVED);

      expect(reason).toMatch(/write it \/-rooted/);
    },
  );
});

describe("servedDataPaths", () => {
  it("is empty for a project without data/", () => {
    const root = makeTempProject("biac-image-sources-");

    const served = servedDataPaths(join(root, "data"), DEFAULT_INTERPRETERS);

    expect(served.size).toBe(0);
  });

  it("holds files at any depth and loader targets, and no loader source", () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(root, "data/a.png", "x");
    writeProjectFile(root, "data/nested/b.png", "x");
    writeProjectFile(root, "data/sum.csv.js", "console.log('a')");

    const served = servedDataPaths(join(root, "data"), DEFAULT_INTERPRETERS);

    expect([...served].sort()).toEqual(["a.png", "nested/b.png", "sum.csv"]);
  });
});

describe("assertImagesResolve", () => {
  it("passes when every image names a served file", async () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(root, "data/a.png", "x");
    writeProjectFile(root, "pages/index.md", "![a](/data/a.png)\n");

    const check = assertImagesResolve(root, DEFAULT_INTERPRETERS);

    await expect(check).resolves.toBeUndefined();
  });

  it("lists every broken image with its page file, line and source", async () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(
      root,
      "pages/index.md",
      "# Home\n\n![g](/data/gone.png)\n",
    );
    writeProjectFile(root, "pages/b.md", '<img src="x.png" />\n');

    const check = assertImagesResolve(root, DEFAULT_INTERPRETERS);

    await expect(check).rejects.toThrow(/2 broken images — each must name/);
    await expect(check).rejects.toThrow(
      /pages\/index\.md:3 → \/data\/gone\.png \(no file at data\/gone\.png\)/,
    );
    await expect(check).rejects.toThrow(/pages\/b\.md:1 → x\.png/);
  });

  it("passes a reference-style image through its definition", async () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(root, "data/a.png", "x");
    writeProjectFile(
      root,
      "pages/index.md",
      "![a][img]\n\n[img]: /data/a.png\n",
    );

    const check = assertImagesResolve(root, DEFAULT_INTERPRETERS);

    await expect(check).resolves.toBeUndefined();
  });

  it("reports a loader source's path, which is never copied", async () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(root, "data/sum.csv.js", "console.log('a')");
    writeProjectFile(root, "pages/index.md", "![a](/data/sum.csv.js)\n");

    const check = assertImagesResolve(root, DEFAULT_INTERPRETERS);

    await expect(check).rejects.toThrow(/1 broken image —/);
  });

  it("names the page line of an image an mdx echo fence renders", async () => {
    const root = makeTempProject("biac-image-sources-");
    writeProjectFile(
      root,
      "pages/index.md",
      "# T\n\n```mdx echo\n![g](/data/gone.png)\n```\n",
    );

    const check = assertImagesResolve(root, DEFAULT_INTERPRETERS);

    await expect(check).rejects.toThrow(
      /pages\/index\.md:4 → \/data\/gone\.png/,
    );
  });
});
