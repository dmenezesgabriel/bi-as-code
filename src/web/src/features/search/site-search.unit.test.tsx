import { act, fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "../chrome/router-harness";
import {
  FakeSearchDocuments,
  SAMPLE_SEARCH_PAGES as PAGES,
} from "./fake-search-documents";
import { SiteSearch } from "./site-search";

const PATHS = ["/", "/weekly-orders", "/weekly-review", "/nested/allocation"];

async function renderSearch(
  documents: FakeSearchDocuments,
  onNavigate = vi.fn(),
) {
  const router = await renderWithRouter(
    <SiteSearch loadDocuments={documents.load} onNavigate={onNavigate} />,
    PATHS,
    "/",
  );
  return {
    router,
    onNavigate,
    box: screen.getByRole("combobox", { name: "Search pages" }),
  };
}

async function type(box: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.focus(box);
    fireEvent.change(box, { target: { value } });
  });
}

function optionNames(): string[] {
  return screen
    .queryAllByRole("option")
    .map((option) => option.textContent ?? "");
}

describe("SiteSearch — loading", () => {
  it("asks for the documents on first focus only", async () => {
    const documents = new FakeSearchDocuments(PAGES, { held: false });
    const { box } = await renderSearch(documents);

    await act(async () => {
      fireEvent.focus(box);
      fireEvent.blur(box);
      fireEvent.focus(box);
    });

    expect(documents.loadCount).toBe(1);
  });

  it("does not ask before the box is used", async () => {
    const documents = new FakeSearchDocuments(PAGES, { held: false });

    await renderSearch(documents);

    expect(documents.loadCount).toBe(0);
  });

  it("answers what was typed while the documents loaded", async () => {
    const documents = new FakeSearchDocuments(PAGES);
    const { box } = await renderSearch(documents);
    await type(box, "fulfil");

    await act(async () => documents.release());

    expect(optionNames()).toEqual(["Allocation"]);
  });

  it("says search is unavailable when the documents fail to load", async () => {
    const documents = new FakeSearchDocuments(PAGES);
    const { box } = await renderSearch(documents);
    await type(box, "weekly");

    await act(async () => documents.fail());

    expect(screen.getByText("Search is unavailable")).toBeInTheDocument();
  });
});

describe("SiteSearch — results", () => {
  it("shows no list before anything is typed", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );

    await act(async () => fireEvent.focus(box));

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("lists matches ranked, each linking to its page", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );

    await type(box, "weekly");

    expect(optionNames()).toEqual([
      "Weekly orders",
      "Weekly review",
      "Allocation",
    ]);
    expect(screen.getByRole("option", { name: "Allocation" })).toHaveAttribute(
      "href",
      "/nested/allocation",
    );
  });

  it("says when nothing matches", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );

    await type(box, "zebra");

    expect(screen.getByText("No results")).toBeInTheDocument();
  });
});

describe("SiteSearch — choosing", () => {
  it("opens the highlighted result on Enter, the first one by default", async () => {
    const { box, router, onNavigate } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    await type(box, "weekly");

    await act(async () => fireEvent.keyDown(box, { key: "Enter" }));

    expect(router.state.location.pathname).toBe("/weekly-orders");
    expect(onNavigate).toHaveBeenCalledOnce();
  });

  it("moves the highlight with ArrowDown and names it on the box", async () => {
    const { box, router } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    await type(box, "weekly");

    await act(async () => fireEvent.keyDown(box, { key: "ArrowDown" }));
    const active = box.getAttribute("aria-activedescendant");
    expect(document.getElementById(active ?? "")).toHaveTextContent(
      "Weekly review",
    );
    await act(async () => fireEvent.keyDown(box, { key: "Enter" }));

    expect(router.state.location.pathname).toBe("/weekly-review");
  });

  it("clears the box once a result is opened", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    await type(box, "weekly");

    await act(async () =>
      fireEvent.click(screen.getByRole("option", { name: "Allocation" })),
    );

    expect(box).toHaveValue("");
  });
});
