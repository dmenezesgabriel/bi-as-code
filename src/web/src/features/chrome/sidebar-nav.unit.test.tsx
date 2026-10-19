import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import type { NavTree } from "virtual:biac-pages";
import { renderWithRouter } from "./router-harness";
import { SidebarNav } from "./sidebar-nav";

const tree: NavTree = {
  rootPages: [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
  ],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Region detail", href: "/nested/page" }],
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
    <SidebarNav tree={tree} siteTitle="ACME" onNavigate={onNavigate} />,
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

  it("opens the directory containing the active route and closes the rest", async () => {
    await renderNav("/nested/page");

    expect(dirElement("Nested")).toHaveAttribute("open");
    expect(dirElement("Guides")).not.toHaveAttribute("open");
  });

  it("marks the active page link with aria-current", async () => {
    await renderNav("/nested/page");

    expect(screen.getByRole("link", { name: "Region detail" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "About" })).not.toHaveAttribute(
      "aria-current",
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
