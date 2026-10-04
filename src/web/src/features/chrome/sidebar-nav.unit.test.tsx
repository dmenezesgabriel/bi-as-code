import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { NavTree } from "virtual:biac-pages";
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
  const rootRoute = createRootRoute({
    component: () => (
      <SidebarNav tree={tree} siteTitle="ACME" onNavigate={onNavigate} />
    ),
  });
  const routes = paths.map((path) =>
    createRoute({
      getParentRoute: () => rootRoute,
      path,
      component: () => null,
    }),
  );
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  // The router resolves the initial match asynchronously — wait for the
  // nav landmark so each test body can assert synchronously.
  await screen.findByRole("navigation", { name: "Site navigation" });
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
