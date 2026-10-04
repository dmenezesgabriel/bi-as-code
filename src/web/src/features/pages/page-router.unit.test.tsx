import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { buildPageRouter } from "./page-router";
import type { CompiledPageModule, ManifestPageEntry } from "./types";

function pageEntry(
  route: string,
  load: () => Promise<CompiledPageModule>,
): ManifestPageEntry {
  return {
    route,
    file: `pages${route === "/" ? "/index" : route}.md`,
    isIndex: route === "/",
    load,
  };
}

function textPage(text: string, title: string | null): CompiledPageModule {
  return {
    default: () => <p>{text}</p>,
    frontmatter: {},
    title,
    sqlBlocks: [],
  };
}

const homePage: CompiledPageModule = {
  default: ({ components }) => {
    const Anchor = components?.a ?? "a";
    return (
      <p>
        home body <Anchor href="/nested">go nested</Anchor>
      </p>
    );
  },
  frontmatter: { title: "Home" },
  title: "Home",
  sqlBlocks: [],
};

const pages: ManifestPageEntry[] = [
  pageEntry("/", async () => homePage),
  pageEntry("/nested", async () => textPage("nested body", "Nested")),
];

const site = {
  title: "ACME Site",
  theme: "system" as const,
  nav: { sidebar: true },
};

function renderRouter(entries: ManifestPageEntry[], initialPath: string) {
  const router = buildPageRouter(
    entries,
    site,
    createMemoryHistory({ initialEntries: [initialPath] }),
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe("buildPageRouter", () => {
  it("renders the manifest page matched to the index route", async () => {
    renderRouter(pages, "/");

    expect(await screen.findByText(/home body/)).toBeInTheDocument();
    expect(document.title).toBe("Home");
  });

  it("renders the manifest page matched to a nested route", async () => {
    renderRouter(pages, "/nested");

    expect(await screen.findByText("nested body")).toBeInTheDocument();
    expect(document.title).toBe("Nested");
  });

  it("navigates client-side when a page's internal link is clicked", async () => {
    const router = renderRouter(pages, "/");

    fireEvent.click(await screen.findByRole("link", { name: "go nested" }));

    expect(await screen.findByText("nested body")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/nested");
  });

  it("renders the not-found page for a path no manifest entry matches", async () => {
    renderRouter(pages, "/no-such-page");

    expect(
      await screen.findByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
    expect(document.title).toBe("Page not found");
  });

  it("uses the configured site title for an untitled page", async () => {
    const withUntitled = [
      pageEntry("/untitled", async () => textPage("body", null)),
    ];
    renderRouter(withUntitled, "/untitled");

    expect(await screen.findByText("body")).toBeInTheDocument();
    expect(document.title).toBe("ACME Site");
  });

  it("renders an in-page error when a page module fails to load", async () => {
    const broken = [
      pageEntry("/", async () => textPage("home body", "Home")),
      pageEntry("/broken", async () => {
        throw new Error("page load exploded");
      }),
    ];
    renderRouter(broken, "/broken");

    expect(await screen.findByText("page load exploded")).toBeInTheDocument();
    expect(document.title).toBe("Error");
  });
});
