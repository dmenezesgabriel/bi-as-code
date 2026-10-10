import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { decodePathname, resolveContained } from "./contained-path.js";

describe("decodePathname", () => {
  it("decodes escapes and drops the query and fragment", () => {
    expect(decodePathname("/a%20b.md?t=1#top")).toBe("/a b.md");
  });

  it("treats a missing url as the root", () => {
    expect(decodePathname(undefined)).toBe("/");
  });

  it("returns null for a malformed escape", () => {
    expect(decodePathname("/%zz")).toBeNull();
  });
});

describe("resolveContained", () => {
  const root = "/site/pages";

  it("resolves a nested path under the root", () => {
    expect(resolveContained(root, "/a/b.md")).toBe(join(root, "a/b.md"));
  });

  it("counts the root itself as contained", () => {
    expect(resolveContained(root, "/")).toBe(root);
  });

  it("returns null for a traversal out of the root", () => {
    expect(resolveContained(root, "/../secret.md")).toBeNull();
  });

  it("returns null for a sibling sharing the root's name prefix", () => {
    expect(resolveContained(root, "/../pages-old/x.md")).toBeNull();
  });
});
