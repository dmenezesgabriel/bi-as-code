import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import type { NavTree } from "virtual:biac-pages";
import { FakeSearchDocuments } from "../search/fake-search-documents";
import type { PageSearchDocument } from "../search/types";
import { renderWithRouter } from "./router-harness";
import { SidebarNav } from "./sidebar-nav";

const tree: NavTree = {
  rootPages: [
    { name: "Home", href: "/", icon: "house" },
    { name: "About", href: "/about" },
  ],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Region detail", href: "/nested/page", icon: "map-pin" }],
    },
    {
      id: "guides",
      name: "Guides",
      pages: [{ name: "Intro", href: "/guides/intro" }],
    },
  ],
};

const paths = ["/", "/about", "/nested/page", "/guides/intro"];

async function renderNav(initialPath: string, onNavigate = vi.fn()) {
  await renderWithRouter(
    <SidebarNav
      tree={tree}
      siteTitle="ACME"
      onNavigate={onNavigate}
      onRevealSearch={vi.fn()}
    />,
    paths,
    initialPath,
  );
  return onNavigate;
}

function dirElement(name: string): HTMLElement {
  const details = screen.getByText(name).closest("details");
  if (!details) throw new Error(`expected a <details> wrapping "${name}"`);
  return details;
}

beforeEach(() => {
  window.sessionStorage.clear();
});

describe("SidebarNav — page icons", () => {
  it("shows a page's icon before its name, hidden from assistive tech", async () => {
    await renderNav("/");

    const home = screen.getByRole("link", { name: "Home" });
    const svg = home.querySelector("svg");
    expect(svg).toHaveClass("lucide-house");
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(home.firstElementChild).toBe(svg);
  });

  it("shows an icon inside a directory group too", async () => {
    await renderNav("/nested/page");

    const link = screen.getByRole("link", { name: "Region detail" });
    expect(link.querySelector("svg")).toHaveClass("lucide-map-pin");
  });

  it("shows the name alone when the page names no icon", async () => {
    await renderNav("/");

    const about = screen.getByRole("link", { name: "About" });
    expect(about.querySelector("svg")).toBeNull();
  });
});

describe("SidebarNav", () => {
  it("renders the site title linking home and every root page link", async () => {
    await renderNav("/");

    const title = screen.getByRole("link", { name: "ACME" });
    expect(title).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "About" })).toBeInTheDocument();
  });

  it("sets the site title in the brand heading font", async () => {
    await renderNav("/");

    const title = screen.getByRole("link", { name: "ACME" });

    expect(title).toHaveClass("font-heading");
  });

  it.each(["/nested/page/", "/nested/page"])(
    "opens the directory containing the active route at %s and closes the rest",
    async (path) => {
      await renderNav(path);

      expect(dirElement("Nested")).toHaveAttribute("open");
      expect(dirElement("Guides")).not.toHaveAttribute("open");
    },
  );

  it.each(["/nested/page/", "/nested/page"])(
    "marks the active page link at %s with aria-current",
    async (path) => {
      await renderNav(path);

      expect(
        screen.getByRole("link", { name: "Region detail" }),
      ).toHaveAttribute("aria-current", "page");
      expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute(
        "aria-current",
      );
    },
  );

  it("links each page at its route's directory URL", async () => {
    await renderNav("/");

    expect(screen.getByRole("link", { name: "About" })).toHaveAttribute(
      "href",
      "/about/",
    );
  });

  it("toggles a directory on summary click and persists the choice", async () => {
    await renderNav("/");

    fireEvent.click(screen.getByText("Nested"));
    expect(dirElement("Nested")).toHaveAttribute("open");
    expect(window.sessionStorage.getItem("biac.sidebar.dirs")).toBe(
      '{"nested":true}',
    );

    fireEvent.click(screen.getByText("Nested"));
    expect(dirElement("Nested")).not.toHaveAttribute("open");
    expect(window.sessionStorage.getItem("biac.sidebar.dirs")).toBe(
      '{"nested":false}',
    );
  });

  it("restores an explicit collapse across remounts, even for the active directory", async () => {
    window.sessionStorage.setItem(
      "biac.sidebar.dirs",
      '{"nested":false,"guides":true}',
    );

    await renderNav("/nested/page");

    expect(dirElement("Nested")).not.toHaveAttribute("open");
    expect(dirElement("Guides")).toHaveAttribute("open");
  });

  it("fires onNavigate when a page link is clicked", async () => {
    const onNavigate = await renderNav("/");

    fireEvent.click(screen.getByRole("link", { name: "About" }));

    expect(onNavigate).toHaveBeenCalled();
  });
});

describe("search box", () => {
  async function renderSearchNav(pages: readonly PageSearchDocument[] = []) {
    const documents = new FakeSearchDocuments(pages, { held: false });
    await renderWithRouter(
      <SidebarNav
        tree={tree}
        siteTitle="ACME"
        loadSearchDocuments={documents.load}
        onNavigate={vi.fn()}
        onRevealSearch={vi.fn()}
      />,
      paths,
      "/",
    );
    return screen.getByRole("combobox", { name: "Search pages" });
  }

  it("sits under the site title, above the page links, when search is on", async () => {
    await renderSearchNav();

    const box = screen.getByRole("combobox", { name: "Search pages" });
    const title = screen.getByRole("link", { name: "ACME" });
    const firstPage = screen.getByRole("link", { name: "Home" });

    expect(title.compareDocumentPosition(box)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(box.compareDocumentPosition(firstPage)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("hides the page links while results show, and brings them back once cleared", async () => {
    const box = await renderSearchNav([
      { id: "/about", title: "About", text: "", keywords: "" },
    ]);

    await act(async () => {
      fireEvent.focus(box);
      fireEvent.change(box, { target: { value: "about" } });
    });
    expect(
      screen.queryByRole("link", { name: "Home" }),
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole("option", { name: "About" }),
    ).toBeInTheDocument();

    await act(async () => fireEvent.change(box, { target: { value: "" } }));
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
  });

  it("is absent when no search documents are wired", async () => {
    await renderNav("/");

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });
});
