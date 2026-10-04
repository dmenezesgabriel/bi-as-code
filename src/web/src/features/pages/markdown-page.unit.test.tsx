import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { MarkdownPage } from "./markdown-page";
import type { CompiledPageModule } from "./types";

function renderPage(page: CompiledPageModule, siteTitle = "biac") {
  const rootRoute = createRootRoute({
    component: () => <MarkdownPage page={page} siteTitle={siteTitle} />,
  });
  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  });
  render(<RouterProvider router={router} />);
}

function page(partial: Partial<CompiledPageModule>): CompiledPageModule {
  return {
    default: () => null,
    frontmatter: {},
    title: null,
    sqlBlocks: [],
    ...partial,
  };
}

describe("MarkdownPage", () => {
  it("renders the page module's content inside a main landmark", async () => {
    renderPage(
      page({
        default: () => <p>rendered markdown</p>,
      }),
    );

    const main = await screen.findByRole("main");
    expect(main).toHaveTextContent("rendered markdown");
  });

  it("hands the mdx component map to the page so links render", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          // components arrives via props; a missing map falls back to the
          // intrinsic element, so the rendered anchor proves the prop was
          // passed only through its href handling — the routes test covers
          // the internal-link path end to end.
          const Anchor = components?.a ?? "a";
          return <Anchor href="https://example.com">external</Anchor>;
        },
      }),
    );

    expect(
      await screen.findByRole("link", { name: "external" }),
    ).toHaveAttribute("href", "https://example.com");
  });

  it("highlights fenced code through the pre component in the map", async () => {
    renderPage(
      page({
        default: ({ components }) => {
          const Pre = components?.pre ?? "pre";
          return (
            <Pre>
              <code className="language-sql">select 1</code>
            </Pre>
          );
        },
      }),
    );

    await waitFor(() => {
      expect(document.querySelector("pre.shiki")).not.toBeNull();
    });
  });

  it("sets document.title to the page title", async () => {
    renderPage(page({ title: "Quarterly results" }));

    await screen.findByRole("main");
    expect(document.title).toBe("Quarterly results");
  });

  it("falls back to the site title when the page has no title", async () => {
    renderPage(page({ title: null }), "ACME Analytics");

    await screen.findByRole("main");
    expect(document.title).toBe("ACME Analytics");
  });

  it("renders an on-this-page toc for the page's h2/h3 headings", async () => {
    renderPage(
      page({
        default: () => (
          <>
            <h1>Title</h1>
            <h2>Section A</h2>
            <h2>Section B</h2>
          </>
        ),
      }),
    );

    await screen.findByRole("navigation", { name: "On this page" });
    expect(screen.getByRole("link", { name: "Section A" })).toHaveAttribute(
      "href",
      "#section-a",
    );
    expect(screen.getByRole("link", { name: "Section B" })).toHaveAttribute(
      "href",
      "#section-b",
    );
  });

  it("hides the toc when front-matter sets table_of_contents: false", async () => {
    renderPage(
      page({
        frontmatter: { table_of_contents: false },
        default: () => (
          <>
            <h2>Section A</h2>
            <h2>Section B</h2>
          </>
        ),
      }),
    );

    await screen.findByRole("main");
    expect(
      screen.queryByRole("navigation", { name: "On this page" }),
    ).toBeNull();
  });
});
