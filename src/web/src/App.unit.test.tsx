import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import type { BiacConfig } from "virtual:biac-config";
import type { NavTree } from "virtual:biac-pages";
import { AppShell } from "./App";
import { stubMatchMedia } from "./features/chrome/match-media.stub";

const tree: NavTree = {
  rootPages: [{ name: "Home", href: "/" }],
  directories: [
    {
      id: "nested",
      name: "Nested",
      pages: [{ name: "Region detail", href: "/nested/page" }],
    },
  ],
};

const site: BiacConfig = {
  title: "ACME Site",
  theme: "system",
  nav: { sidebar: true },
};

async function renderShell(
  initialPath: string,
  config: BiacConfig = site,
  navTree: NavTree = tree,
) {
  const rootRoute = createRootRoute({
    component: () => <AppShell tree={navTree} site={config} />,
  });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => <p>route body</p>,
  });
  const nestedRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/nested/page",
    component: () => <p>nested body</p>,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, nestedRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  render(<RouterProvider router={router} />);
  await screen.findByText(/body/);
}

function sidebar(): HTMLElement {
  return screen.getByRole("complementary");
}

beforeEach(() => {
  window.sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AppShell", () => {
  it("renders the outlet content of the matched route", async () => {
    await renderShell("/");

    expect(screen.getByText("route body")).toBeInTheDocument();
  });

  it("renders the sidebar nav with the site title and tree links", async () => {
    await renderShell("/");

    expect(
      screen.getByRole("navigation", { name: "Site navigation" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "ACME Site" })).toBeInTheDocument();
    expect(screen.getByText("Nested")).toBeInTheDocument();
  });

  it("omits the sidebar and its toggle when nav.sidebar is false", async () => {
    await renderShell("/", { ...site, nav: { sidebar: false } });

    expect(screen.getByText("route body")).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Site navigation" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Toggle sidebar" }),
    ).not.toBeInTheDocument();
  });

  it("hides the sidebar on toggle click and persists the choice", async () => {
    await renderShell("/");

    const toggle = screen.getByRole("button", { name: "Toggle sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(sidebar()).toHaveClass("translate-x-0");

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(sidebar()).toHaveClass("-translate-x-full");
    expect(window.sessionStorage.getItem("biac.sidebar.open")).toBe("false");
  });

  it("restores a persisted desktop collapse", async () => {
    window.sessionStorage.setItem("biac.sidebar.open", "false");

    await renderShell("/");

    expect(sidebar()).toHaveClass("-translate-x-full");
  });

  describe("below the lg breakpoint", () => {
    it("starts closed, opens as an overlay, and Escape closes it without persisting", async () => {
      stubMatchMedia(true);
      await renderShell("/");

      expect(sidebar()).toHaveClass("-translate-x-full");

      fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));

      expect(sidebar()).toHaveClass("translate-x-0");
      expect(screen.getByTestId("sidebar-backdrop")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });

      expect(sidebar()).toHaveClass("-translate-x-full");
      expect(screen.queryByTestId("sidebar-backdrop")).not.toBeInTheDocument();
      expect(window.sessionStorage.getItem("biac.sidebar.open")).toBeNull();
    });

    it("closes the drawer when a nav link is clicked", async () => {
      stubMatchMedia(true);
      await renderShell("/");

      fireEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
      fireEvent.click(screen.getByRole("link", { name: "Home" }));

      expect(sidebar()).toHaveClass("-translate-x-full");
    });
  });
});
