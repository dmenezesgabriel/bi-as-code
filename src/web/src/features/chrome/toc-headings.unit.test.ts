import { describe, expect, it } from "vitest";
import { collectTocHeadings, pickActiveHeadingId } from "./toc-headings";

function article(html: string): HTMLElement {
  const el = document.createElement("article");
  el.innerHTML = html;
  return el;
}

describe("collectTocHeadings", () => {
  it("collects h2 and h3 in document order with text and level", () => {
    const root = article(
      "<h1>Title</h1><h2>Alpha</h2><p>x</p><h3>Beta</h3><h4>Deep</h4><h2>Gamma</h2>",
    );

    const headings = collectTocHeadings(root);

    expect(headings.map((h) => [h.level, h.text])).toEqual([
      [2, "Alpha"],
      [3, "Beta"],
      [2, "Gamma"],
    ]);
  });

  it("slugs ids: lowercase, punctuation stripped, whitespace and underscores folded to dashes", () => {
    const root = article(
      "<h2>Hello, World!</h2><h2>a &amp; b</h2><h2>some_thing here</h2>",
    );

    const headings = collectTocHeadings(root);

    expect(headings.map((h) => h.id)).toEqual([
      "hello-world",
      "a-b",
      "some-thing-here",
    ]);
    expect(root.querySelector("h2")?.getAttribute("id")).toBe("hello-world");
  });

  it("dedupes identical slugs with -1/-2 suffixes", () => {
    const root = article("<h2>Repeat</h2><h2>Repeat</h2><h2>Repeat</h2>");

    const headings = collectTocHeadings(root);

    expect(headings.map((h) => h.id)).toEqual([
      "repeat",
      "repeat-1",
      "repeat-2",
    ]);
  });

  it("keeps an existing id and reserves it against later slugs", () => {
    const root = article('<h2 id="custom">X</h2><h2>custom</h2>');

    const headings = collectTocHeadings(root);

    expect(headings.map((h) => h.id)).toEqual(["custom", "custom-1"]);
  });

  it("skips headings with no text", () => {
    const root = article("<h2></h2><h2>Kept</h2>");

    const headings = collectTocHeadings(root);

    expect(headings.map((h) => h.id)).toEqual(["kept"]);
  });
});

describe("pickActiveHeadingId", () => {
  it("returns the last heading still above the viewport center", () => {
    const headings = [
      { id: "a", top: -10 },
      { id: "b", top: 100 },
      { id: "c", top: 700 },
    ];

    expect(pickActiveHeadingId(headings, "", 768)).toBe("b");
  });

  it("returns null when every heading is below the center", () => {
    const headings = [
      { id: "a", top: 700 },
      { id: "b", top: 900 },
    ];

    expect(pickActiveHeadingId(headings, "", 768)).toBeNull();
  });

  it("prefers the hash-matched heading sitting within 40px of the top", () => {
    const headings = [
      { id: "a", top: -100 },
      { id: "b", top: 100 },
      { id: "c", top: 20 },
    ];

    expect(pickActiveHeadingId(headings, "#c", 768)).toBe("c");
  });

  it("falls back to the center rule when the hash match is outside the top band", () => {
    const headings = [
      { id: "a", top: -500 },
      { id: "b", top: -100 },
      { id: "c", top: 600 },
    ];

    expect(pickActiveHeadingId(headings, "#c", 768)).toBe("b");
  });

  it("matches an encoded hash against a non-slug id", () => {
    const headings = [{ id: "Section One", top: 20 }];

    expect(pickActiveHeadingId(headings, "#Section%20One", 768)).toBe(
      "Section One",
    );
  });
});
