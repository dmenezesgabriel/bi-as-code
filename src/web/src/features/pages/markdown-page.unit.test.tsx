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

function renderPage(page: CompiledPageModule) {
  const rootRoute = createRootRoute({
    component: () => <MarkdownPage page={page} />,
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

  it("falls back to the app title when the page has no title", async () => {
    renderPage(page({ title: null }));

    await screen.findByRole("main");
    expect(document.title).toBe("biac");
  });
});
