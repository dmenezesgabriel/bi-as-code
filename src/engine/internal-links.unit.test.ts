import { afterEach, describe, expect, it } from "vitest";
import {
  cleanupProjects,
  makeTempProject,
  writeProjectFile,
} from "../../test/lib/temp-project.js";
import {
  assertInternalLinksResolve,
  brokenLinkReason,
} from "./internal-links.js";

afterEach(() => cleanupProjects());

const ROUTES: ReadonlySet<string> = new Set(["/", "/nested/page"]);

describe("brokenLinkReason", () => {
  it.each([
    "https://example.com/x",
    "mailto:a@b.c",
    "//cdn.example.com/x",
    "#section",
    "?q=1",
    "",
  ])("skips %j, which names no page route", (href) => {
    const reason = brokenLinkReason(href, ROUTES);

    expect(reason).toBeUndefined();
  });

  it.each([
    "/",
    "/nested/page",
    "/nested/page/",
    "/nested/page#a",
    "/nested/page?q=1",
  ])("accepts %j, which a page serves", (href) => {
    const reason = brokenLinkReason(href, ROUTES);

    expect(reason).toBeUndefined();
  });

  it("accepts a percent-encoded route", () => {
    const reason = brokenLinkReason("/my%20page", new Set(["/my page"]));

    expect(reason).toBeUndefined();
  });

  it("rejects a /-rooted path no page serves", () => {
    const reason = brokenLinkReason("/no-such-page", ROUTES);

    expect(reason).toMatch(/no page serves this route/);
  });

  it.each(["x", "./x", "../x"])(
    "rejects the relative %j, whose target depends on the URL's trailing slash",
    (href) => {
      const reason = brokenLinkReason(href, ROUTES);

      expect(reason).toMatch(/write it \/-rooted/);
    },
  );
});

describe("assertInternalLinksResolve", () => {
  it("passes when every internal link names a page", async () => {
    const root = makeTempProject("biac-internal-links-");
    writeProjectFile(root, "pages/index.md", "[a](/nested/page)\n");
    writeProjectFile(root, "pages/nested/page.md", "[home](/)\n");

    await expect(assertInternalLinksResolve(root)).resolves.toBeUndefined();
  });

  it("lists every broken link with its page file, line and target", async () => {
    const root = makeTempProject("biac-internal-links-");
    writeProjectFile(
      root,
      "pages/index.md",
      "# Home\n\n[gone](/no-such-page)\n",
    );
    writeProjectFile(root, "pages/b.md", "[up](../x)\n");

    const check = assertInternalLinksResolve(root);

    await expect(check).rejects.toThrow(/2 broken internal links/);
    await expect(check).rejects.toThrow(/pages\/index\.md:3 → \/no-such-page/);
    await expect(check).rejects.toThrow(/pages\/b\.md:1 → \.\.\/x/);
  });
});
