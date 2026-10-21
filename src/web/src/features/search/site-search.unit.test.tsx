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
  const onSearchingChange = vi.fn();
  const router = await renderWithRouter(
    <SiteSearch
      loadDocuments={documents.load}
      onNavigate={onNavigate}
      onReveal={vi.fn()}
      onSearchingChange={onSearchingChange}
    />,
    PATHS,
    "/",
  );
  return {
    router,
    onNavigate,
    onSearchingChange,
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

    expect(screen.getByRole("status")).toHaveTextContent("No results");
  });

  it.each([
    ["fulfilment", "1 result"],
    ["weekly", "3 results"],
  ])(
    "announces the count for %s in a polite live region",
    async (query, count) => {
      const { box } = await renderSearch(
        new FakeSearchDocuments(PAGES, { held: false }),
      );

      await type(box, query);

      const status = screen.getByRole("status");
      expect(status).toHaveTextContent(count);
      expect(status).toHaveAttribute("aria-live", "polite");
    },
  );

  it("reports when a search starts and when it ends", async () => {
    const { box, onSearchingChange } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );

    await type(box, "weekly");
    await type(box, "weekl");
    await type(box, "");

    expect(onSearchingChange.mock.calls).toEqual([[true], [false]]);
  });

  it("names its shortcuts on the box", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );

    expect(box).toHaveAttribute("aria-keyshortcuts", "/ Control+K Meta+K");
  });
});

/** Presses Escape on the box; returns how often it reached the window. */
async function pressEscapeCountingPageHears(box: HTMLElement): Promise<number> {
  const pageEscape = vi.fn();
  window.addEventListener("keydown", pageEscape);
  await act(async () => fireEvent.keyDown(box, { key: "Escape" }));
  window.removeEventListener("keydown", pageEscape);
  return pageEscape.mock.calls.length;
}

describe("SiteSearch — Escape", () => {
  it("clears a typed query and keeps the box focused", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    box.focus();
    await type(box, "weekly");

    await act(async () => fireEvent.keyDown(box, { key: "Escape" }));

    expect(box).toHaveValue("");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(document.activeElement).toBe(box);
  });

  it("does not let the clearing Escape reach the page", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    await type(box, "weekly");

    const heard = await pressEscapeCountingPageHears(box);

    expect(heard).toBe(0);
  });

  it("leaves an empty box, letting the Escape through", async () => {
    const { box } = await renderSearch(
      new FakeSearchDocuments(PAGES, { held: false }),
    );
    box.focus();

    const heard = await pressEscapeCountingPageHears(box);

    expect(document.activeElement).toBe(document.body);
    expect(heard).toBe(1);
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
