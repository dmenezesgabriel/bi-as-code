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
    expect(
      container.querySelector('pre.shiki span[style*="color"]'),
    ).not.toBeNull();
    expect(container.querySelector("pre.shiki")).toHaveTextContent("select 1");
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

  it("passes through non-element children", async () => {
    const { container } = render(<HighlightedPre>just text</HighlightedPre>);

    await flushHighlight();
    expect(container.querySelector("pre")).toHaveTextContent("just text");
    expect(container.querySelector(".shiki")).toBeNull();
  });
});
