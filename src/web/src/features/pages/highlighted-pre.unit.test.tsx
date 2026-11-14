import { describe, expect, it } from "vitest";
import { act, render, waitFor } from "@testing-library/react";
import { HighlightedPre } from "./highlighted-pre";

/**
 * Flushes the async highlight effect: the highlighter loads grammars on
 * demand, so a fence resolves a tick (or a few) after first render.
 */
async function flushHighlight() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

/** Renders `sql` as a fence and waits for shiki to replace the plain `pre`. */
async function renderHighlightedSql(sql: string): Promise<HTMLElement> {
  const { container } = render(
    <HighlightedPre>
      <code className="language-sql">{sql}</code>
    </HighlightedPre>,
  );
  await waitFor(() => {
    expect(container.querySelector("pre.shiki")).not.toBeNull();
  });
  return container;
}

/** Renders `code` in a language shiki lacks and waits for the highlight effect to settle. */
async function renderUnhighlighted(code: string): Promise<HTMLElement> {
  const { container } = render(
    <HighlightedPre>
      <code className="language-not-a-real-lang">{code}</code>
    </HighlightedPre>,
  );
  await flushHighlight();
  return container;
}

describe("HighlightedPre", () => {
  it("highlights a fenced code block into shiki token markup", async () => {
    const container = await renderHighlightedSql("select 1");
    // Every token colour is a --shiki-token-* custom property that
    // styles.css defines per mode, so the fence follows the theme class.
    const token = container.querySelector('pre.shiki span[style*="--shiki-"]');
    expect(token).not.toBeNull();
    expect(token?.getAttribute("style")).toContain("var(--shiki-token-");
    expect(container.querySelector("pre.shiki")).toHaveTextContent("select 1");
  });

  it("paints a SQL comment and its fence from the theme tokens", async () => {
    const container = await renderHighlightedSql("-- note");
    const pre = container.querySelector("pre.shiki");
    const comment = container.querySelector("pre.shiki span[style]");

    expect(pre?.getAttribute("style")).toContain("var(--shiki-background)");
    expect(comment?.getAttribute("style")).toContain(
      "var(--shiki-token-comment)",
    );
  });

  it("sets a highlighted fence on the muted, rounded, small-type surface", async () => {
    const container = await renderHighlightedSql("select 1");
    const scroller = container.querySelector("pre.shiki")?.parentElement;
    expect(scroller).toHaveClass("bg-muted", "rounded-md", "text-sm");
  });

  it("sets an unhighlighted fence on the same surface", async () => {
    const container = await renderUnhighlighted("x = 1");
    expect(container.querySelector("pre")).toHaveClass(
      "bg-muted",
      "rounded-md",
      "text-sm",
      "px-4",
      "py-3",
    );
  });

  it("renders a pre whose code child has no language class unchanged", async () => {
    const { container } = render(
      <HighlightedPre>
        <code>plain block</code>
      </HighlightedPre>,
    );

    await flushHighlight();
    expect(container.querySelector(".shiki")).toBeNull();
    expect(container.querySelector("pre > code")).toHaveTextContent(
      "plain block",
    );
  });

  it("leaves a fence with an unknown language unhighlighted", async () => {
    const container = await renderUnhighlighted("x = 1");
    expect(container.querySelector(".shiki")).toBeNull();
    expect(container.querySelector("pre")).toHaveTextContent("x = 1");
  });

  it("wraps a highlighted fence in a keyboard-focusable horizontal scroller", async () => {
    const container = await renderHighlightedSql("select 1");
    const scroller = container.querySelector("pre.shiki")?.parentElement;
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveClass("overflow-x-auto");
  });

  it("makes an unhighlighted pre its own keyboard-focusable horizontal scroller", async () => {
    const container = await renderUnhighlighted("x = 1");
    const pre = container.querySelector("pre");
    expect(pre).toHaveAttribute("tabindex", "0");
    expect(pre).toHaveClass("overflow-x-auto");
  });

  it("passes through non-element children", async () => {
    const { container } = render(<HighlightedPre>just text</HighlightedPre>);

    await flushHighlight();
    expect(container.querySelector("pre")).toHaveTextContent("just text");
    expect(container.querySelector(".shiki")).toBeNull();
  });
});
