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

describe("HighlightedPre", () => {
  it("highlights a fenced code block into shiki token markup", async () => {
    const { container } = render(
      <HighlightedPre>
        <code className="language-sql">select 1</code>
      </HighlightedPre>,
    );

    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    });
    // Dual-theme output: the light value is a literal `color`, the dark
    // one a --shiki-dark custom property that styles.css applies under
    // .dark.
    const token = container.querySelector('pre.shiki span[style*="--shiki-"]');
    expect(token).not.toBeNull();
    expect(token?.getAttribute("style")).toContain("color:");
    expect(token?.getAttribute("style")).toContain("--shiki-dark");
    expect(container.querySelector("pre.shiki")).toHaveTextContent("select 1");
  });

  it("colors a dark SQL comment to read at text contrast on its fence", async () => {
    const { container } = render(
      <HighlightedPre>
        <code className="language-sql">-- note</code>
      </HighlightedPre>,
    );

    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    });
    const pre = container.querySelector("pre.shiki");
    const comment = container.querySelector(
      'pre.shiki span[style*="--shiki-dark"]',
    );

    // github-dark-default: #8b949e on #0d1117 is 6.15:1 (WCAG 1.4.3 asks
    // 4.5:1); github-dark's #6a737d on #24292e was 3.05:1.
    expect(pre?.getAttribute("style")?.toLowerCase()).toContain(
      "--shiki-dark-bg:#0d1117",
    );
    expect(comment?.getAttribute("style")?.toLowerCase()).toContain(
      "--shiki-dark:#8b949e",
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
    const { container } = render(
      <HighlightedPre>
        <code className="language-not-a-real-lang">x = 1</code>
      </HighlightedPre>,
    );

    await flushHighlight();
    expect(container.querySelector(".shiki")).toBeNull();
    expect(container.querySelector("pre")).toHaveTextContent("x = 1");
  });

  it("wraps a highlighted fence in a keyboard-focusable horizontal scroller", async () => {
    const { container } = render(
      <HighlightedPre>
        <code className="language-sql">select 1</code>
      </HighlightedPre>,
    );

    await waitFor(() => {
      expect(container.querySelector("pre.shiki")).not.toBeNull();
    });
    const scroller = container.querySelector("pre.shiki")?.parentElement;
    expect(scroller).toHaveAttribute("tabindex", "0");
    expect(scroller).toHaveClass("overflow-x-auto");
  });

  it("makes an unhighlighted pre its own keyboard-focusable horizontal scroller", async () => {
    const { container } = render(
      <HighlightedPre>
        <code className="language-not-a-real-lang">x = 1</code>
      </HighlightedPre>,
    );

    await flushHighlight();
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
