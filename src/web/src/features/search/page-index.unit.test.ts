import { describe, expect, it } from "vitest";
import { buildPageIndex } from "./page-index";
import type { PageSearchDocument } from "./types";

function page(
  id: string,
  title: string,
  text: string,
  keywords = "",
): PageSearchDocument {
  return { id, title, text, keywords };
}

const PAGES = [
  page("/weekly-orders", "Weekly orders", "Orders by week."),
  page(
    "/allocation",
    "Allocation",
    "Splits across fulfilment channels weekly.",
  ),
  page("/regions", "Regional orders", "Région totals.", "margin"),
];

function ids(query: string): string[] {
  return buildPageIndex(PAGES)
    .search(query)
    .map((result) => result.id);
}

describe("buildPageIndex — matching", () => {
  it("finds a page by a word only its text holds", () => {
    expect(ids("fulfilment")).toEqual(["/allocation"]);
  });

  it("matches a word one letter off", () => {
    expect(ids("fulfilmant")).toEqual(["/allocation"]);
  });

  it("matches a prefix", () => {
    expect(ids("fulfil")).toEqual(["/allocation"]);
  });

  it("finds a page by its keywords", () => {
    expect(ids("margin")).toEqual(["/regions"]);
  });

  it("matches across accents", () => {
    expect(ids("region")).toContain("/regions");
  });

  it("finds nothing for an unknown word", () => {
    expect(ids("zebra")).toEqual([]);
  });
});

describe("buildPageIndex — ranking", () => {
  it("ranks a title match above a text-only match", () => {
    expect(ids("weekly")).toEqual(["/weekly-orders", "/allocation"]);
  });

  it("returns each result's label", () => {
    const [first] = buildPageIndex(PAGES).search("fulfilment");

    expect(first).toEqual({ id: "/allocation", title: "Allocation" });
  });
});

describe("buildPageIndex — term processing", () => {
  it("leaves out terms with more than six digits", () => {
    const index = buildPageIndex([page("/a", "A", "order 1234567 shipped")]);

    expect(index.search("1234567")).toEqual([]);
  });

  it("matches a long word by its first fifteen characters", () => {
    const index = buildPageIndex([page("/a", "A", "internationalisation")]);

    expect(index.search("internationalization")).toHaveLength(1);
  });
});
