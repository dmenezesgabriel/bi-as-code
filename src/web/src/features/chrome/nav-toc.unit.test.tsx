import { afterEach, describe, expect, it, vi } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { useState, type ReactNode } from "react";
import { stubIntersectionObserver } from "./intersection-observer.stub";
import { NavToc } from "./nav-toc";

function renderToc(markup: ReactNode) {
  function Host() {
    const [article, setArticle] = useState<HTMLElement | null>(null);
    return (
      <div>
        <article ref={setArticle}>{markup}</article>
        {article && <NavToc article={article} />}
      </div>
    );
  }
  return render(<Host />);
}

function stubTop(id: string, top: number) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`expected a heading with id "${id}"`);
  vi.spyOn(el, "getBoundingClientRect").mockReturnValue({ top } as DOMRect);
}

/**
 * Simulates a `#beta` jump on a page with a docked filter bar: Beta lands at
 * its 136px scroll margin, and the short section's successor, Gamma, also
 * sits above jsdom's 384px viewport center.
 */
function landBetaBelowDockedBar() {
  window.location.hash = "#beta";
  document.getElementById("beta")!.style.scrollMarginTop = "136px";
  stubTop("alpha", -500);
  stubTop("beta", 136);
  stubTop("gamma", 300);
}

const THREE_SECTIONS = (
  <>
    <h2>Alpha</h2>
    <h2>Beta</h2>
    <h2>Gamma</h2>
  </>
);

afterEach(() => {
  window.location.hash = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("NavToc", () => {
  it("renders an on-this-page nav linking each h2/h3 by slug", async () => {
    renderToc(
      <>
        <h2>Alpha One</h2>
        <h3>Nested bit</h3>
        <h2>Beta</h2>
      </>,
    );

    await screen.findByRole("navigation", { name: "On this page" });
    expect(screen.getByRole("link", { name: "Alpha One" })).toHaveAttribute(
      "href",
      "#alpha-one",
    );
    expect(screen.getByRole("link", { name: "Nested bit" })).toHaveAttribute(
      "href",
      "#nested-bit",
    );
    expect(document.getElementById("alpha-one")).not.toBeNull();
  });

  it("indents h3 entries relative to h2 entries", async () => {
    renderToc(
      <>
        <h2>Alpha</h2>
        <h3>Beta</h3>
      </>,
    );

    await screen.findByRole("navigation", { name: "On this page" });
    expect(
      screen.getByRole("link", { name: "Beta" }).closest("li"),
    ).toHaveClass("pl-4");
    expect(
      screen.getByRole("link", { name: "Alpha" }).closest("li"),
    ).not.toHaveClass("pl-4");
  });

  it("renders nothing when the article has fewer than two headings", async () => {
    renderToc(<h2>Solo</h2>);

    await screen.findByText("Solo");
    expect(
      screen.queryByRole("navigation", { name: "On this page" }),
    ).toBeNull();
  });

  it("marks the last heading above the viewport center as current", async () => {
    const io = stubIntersectionObserver();
    renderToc(THREE_SECTIONS);
    await screen.findByRole("navigation", { name: "On this page" });

    // jsdom reports every rect top as 0, so all three sit above the center
    // line and the last wins on the mount-time recompute.
    expect(screen.getByRole("link", { name: "Gamma" })).toHaveAttribute(
      "aria-current",
      "location",
    );

    stubTop("beta", 700);
    stubTop("gamma", 600);
    act(() => io.fire());

    expect(screen.getByRole("link", { name: "Alpha" })).toHaveAttribute(
      "aria-current",
      "location",
    );
    expect(screen.getByRole("link", { name: "Gamma" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("prefers the hash-matched heading where its scroll margin landed it", async () => {
    const io = stubIntersectionObserver();
    renderToc(THREE_SECTIONS);
    await screen.findByRole("navigation", { name: "On this page" });

    landBetaBelowDockedBar();
    act(() => io.fire());

    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  it("recomputes the current entry when the hash changes", async () => {
    stubIntersectionObserver();
    renderToc(THREE_SECTIONS);
    await screen.findByRole("navigation", { name: "On this page" });

    landBetaBelowDockedBar();
    act(() => {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(screen.getByRole("link", { name: "Beta" })).toHaveAttribute(
      "aria-current",
      "location",
    );
  });

  it("positions the highlight bar over the active link", async () => {
    const io = stubIntersectionObserver();
    renderToc(
      <>
        <h2>Alpha</h2>
        <h2>Beta</h2>
      </>,
    );
    await screen.findByRole("navigation", { name: "On this page" });

    const item = screen.getByRole("link", { name: "Beta" }).closest("li");
    if (!item) throw new Error("expected a <li> wrapping the Beta link");
    Object.defineProperty(item, "offsetTop", { value: 42 });
    Object.defineProperty(item, "offsetHeight", { value: 18 });
    act(() => io.fire());

    expect(screen.getByTestId("toc-highlight")).toHaveStyle({
      top: "42px",
      height: "18px",
    });
  });

  it("re-extracts headings added after mount", async () => {
    renderToc(
      <>
        <h2>Alpha</h2>
        <h2>Beta</h2>
      </>,
    );
    await screen.findByRole("navigation", { name: "On this page" });

    vi.useFakeTimers();
    try {
      document
        .querySelector("article")!
        .insertAdjacentHTML("beforeend", "<h2>Late section</h2>");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
    } finally {
      vi.useRealTimers();
    }

    expect(screen.getByRole("link", { name: "Late section" })).toHaveAttribute(
      "href",
      "#late-section",
    );
  });

  it("disconnects the scroll-spy observer on unmount", async () => {
    const io = stubIntersectionObserver();
    const view = renderToc(
      <>
        <h2>Alpha</h2>
        <h2>Beta</h2>
      </>,
    );
    await screen.findByRole("navigation", { name: "On this page" });
    expect(io.liveCount()).toBe(1);
    expect(io.observedCount()).toBe(2);

    view.unmount();

    expect(io.liveCount()).toBe(0);
  });
});
