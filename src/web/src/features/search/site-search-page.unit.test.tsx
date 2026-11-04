import { act, cleanup, fireEvent, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../chrome/router-harness";
import {
  FakeSearchDocuments,
  SAMPLE_SEARCH_PAGES as PAGES,
} from "./fake-search-documents";
import { SiteSearch } from "./site-search";

const PAGE = readFileSync(
  path.join(
    import.meta.dirname,
    "../../../../../docs/pages/sql/site-search.md",
  ),
  "utf-8",
);

// Loading the index chunk up front leaves only the documents' timing, which
// the fake controls (see site-search.unit.test.tsx).
beforeAll(() => import("./page-index"));

/** Types `value` into a fresh box and returns the status line it shows. */
async function statusAfterTyping(
  documents: FakeSearchDocuments,
  value: string,
): Promise<string> {
  await renderWithRouter(
    <SiteSearch
      loadDocuments={documents.load}
      onNavigate={vi.fn()}
      onReveal={vi.fn()}
      onSearchingChange={vi.fn()}
    />,
    ["/"],
    "/",
  );
  const box = screen.getByRole("combobox", { name: "Search pages" });
  await act(async () => {
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value } });
  });
  return screen.getByRole("status").textContent ?? "";
}

describe("the Site search reference — the status line", () => {
  it("quotes the text shown while the documents load", async () => {
    // Arrange — held: the documents never arrive.
    const documents = new FakeSearchDocuments(PAGES);

    // Act
    const status = await statusAfterTyping(documents, "weekly");

    // Assert — a paraphrase would send a reader looking for text the box never shows.
    expect(PAGE).toContain(`\`${status}\``);
  });

  it("quotes the text shown when nothing matches", async () => {
    // Arrange
    const documents = new FakeSearchDocuments(PAGES, { held: false });

    // Act
    const status = await statusAfterTyping(documents, "zzzzqq");

    // Assert
    expect(PAGE).toContain(`\`${status}\``);
  });

  it("quotes the text shown when the documents fail to load", async () => {
    // Arrange
    const documents = new FakeSearchDocuments(PAGES);
    documents.fail();

    // Act
    const status = await statusAfterTyping(documents, "weekly");

    // Assert
    expect(PAGE).toContain(`\`${status}\``);
  });

  it("quotes how a match count reads, singular and plural", async () => {
    // Arrange
    const documents = new FakeSearchDocuments(PAGES, { held: false });

    // Act
    const one = await statusAfterTyping(documents, "fulfilment");
    cleanup();
    const several = await statusAfterTyping(documents, "weekly");

    // Assert
    expect(PAGE).toContain(`\`${one}\``);
    expect(PAGE).toContain(`\`${several}\``);
    expect([one, several]).toEqual(["1 result", "3 results"]);
  });
});
