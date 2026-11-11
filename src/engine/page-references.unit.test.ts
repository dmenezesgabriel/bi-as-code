import { describe, expect, it } from "vitest";
import { pageReferences } from "./page-references.js";

describe("pageReferences links", () => {
  it("names each link's line in the page file, front-matter included", async () => {
    const markdown = "---\ntitle: T\n---\n# T\n\n[gone](/no-such-page)\n";

    const { links } = await pageReferences(markdown, "pages/a.md");

    expect(links).toEqual([{ href: "/no-such-page", line: 6 }]);
  });

  it("collects reference definitions and literal <a href> attributes", async () => {
    const markdown = '[x][ref]\n\n[ref]: /a\n\n<a href="/b">b</a>\n';

    const { links } = await pageReferences(markdown, "pages/a.md");

    expect(links.map((link) => link.href)).toEqual(["/a", "/b"]);
  });

  it.each([
    ["an <a> whose href is an expression", "<a href={target}>b</a>\n"],
    [
      "a link shown in a plain code fence",
      "```md\n[gone](/no-such-page)\n```\n",
    ],
    // The page transform reports the compile error at the page file.
    ["a page that does not compile", "[gone](/no-such-page)\n\n<Callout\n"],
  ])("collects no link from %s", async (_case, markdown) => {
    const { links } = await pageReferences(markdown, "pages/a.md");

    expect(links).toEqual([]);
  });

  it("collects a link rendered by an mdx echo fence at its page line", async () => {
    const markdown = "# T\n\n```mdx echo\n[gone](/no-such-page)\n```\n";

    const { links } = await pageReferences(markdown, "pages/a.md");

    expect(links).toEqual([{ href: "/no-such-page", line: 4 }]);
  });
});

describe("pageReferences images", () => {
  it("reads a definition used only by an image as an image, not a page link", async () => {
    const markdown = "![a][r]\n\n[r]: /data/x.png\n";

    const references = await pageReferences(markdown, "pages/a.md");

    expect(references).toEqual({
      links: [],
      images: [{ src: "/data/x.png", line: 3 }],
    });
  });

  it("matches a reference to its definition ignoring case", async () => {
    const markdown = "![a][R]\n\n[r]: /data/x.png\n";

    const { links, images } = await pageReferences(markdown, "pages/a.md");

    expect([links, images]).toEqual([[], [{ src: "/data/x.png", line: 3 }]]);
  });

  it("keeps a definition a link when a link reference uses it", async () => {
    const markdown = "[a][r]\n\n[r]: /page\n";

    const { links, images } = await pageReferences(markdown, "pages/a.md");

    expect([links, images]).toEqual([[{ href: "/page", line: 3 }], []]);
  });

  it("reads a definition used by a link and an image as both", async () => {
    const markdown = "[a][r] ![b][r]\n\n[r]: /data/x.png\n";

    const { links, images } = await pageReferences(markdown, "pages/a.md");

    expect([links, images]).toEqual([
      [{ href: "/data/x.png", line: 3 }],
      [{ src: "/data/x.png", line: 3 }],
    ]);
  });

  it("keeps an unused definition a link", async () => {
    const markdown = "[r]: /page\n";

    const { links, images } = await pageReferences(markdown, "pages/a.md");

    expect([links, images]).toEqual([[{ href: "/page", line: 1 }], []]);
  });

  it("names an inline image's line in the page file, front-matter included", async () => {
    const markdown = "---\ntitle: T\n---\n# T\n\n![gone](/data/gone.png)\n";

    const { links, images } = await pageReferences(markdown, "pages/a.md");

    expect([links, images]).toEqual([[], [{ src: "/data/gone.png", line: 6 }]]);
  });

  it("collects a literal <img src> and leaves an expression-valued one out", async () => {
    const markdown =
      '<img src="/data/a.png" alt="a" />\n\n<img src={path} />\n';

    const { images } = await pageReferences(markdown, "pages/a.md");

    expect(images).toEqual([{ src: "/data/a.png", line: 1 }]);
  });

  it("collects an image an mdx echo fence renders at its page line", async () => {
    const markdown = "# T\n\n```mdx echo\n![gone](/data/gone.png)\n```\n";

    const { images } = await pageReferences(markdown, "pages/a.md");

    expect(images).toEqual([{ src: "/data/gone.png", line: 4 }]);
  });

  it.each([
    ["an image shown in a plain code fence", "```md\n![a](/data/a.png)\n```\n"],
    ["a page that does not compile", "![a](/data/a.png)\n\n<Callout\n"],
  ])("collects no image from %s", async (_case, markdown) => {
    const { images } = await pageReferences(markdown, "pages/a.md");

    expect(images).toEqual([]);
  });
});
