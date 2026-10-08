import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubIntersectionObserver } from "../../chrome/intersection-observer.stub";
import { FilterBar } from "./filter-bar";

function bar(): HTMLElement {
  return screen.getByText("filter field").parentElement!;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilterBar", () => {
  it("renders children inside a sticky horizontal bar", () => {
    stubIntersectionObserver();
    render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );

    const el = bar();
    expect(el).toHaveTextContent("filter field");
    for (const cls of [
      "sticky",
      "top-16",
      "z-10",
      "flex",
      "flex-row",
      "flex-wrap",
      "items-end",
      "gap-4",
      "transition-all",
    ]) {
      expect(el.className).toContain(cls);
    }
  });

  it("places an aria-hidden zero-size sentinel above the bar", () => {
    stubIntersectionObserver();
    render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );

    const sentinel = bar().previousElementSibling!;
    expect(sentinel).toHaveAttribute("aria-hidden", "true");
    for (const cls of [
      "pointer-events-none",
      "-mt-16",
      "mb-16",
      "h-0",
      "w-0",
    ]) {
      expect(sentinel.className).toContain(cls);
    }
  });

  it("renders at rest, not floating, before the sentinel is observed", () => {
    stubIntersectionObserver();
    render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );

    // `default: true` — the bar must not paint its card face on first
    // render and flash back when the observer lands.
    expect(bar().className).toContain("border-transparent");
    expect(bar().className).toContain("shadow-none");
    expect(bar().className).not.toContain(" bg-white");
  });

  it("gains the floating card style when the sentinel leaves the viewport", () => {
    const io = stubIntersectionObserver();
    render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );

    act(() => io.fire(false));

    const el = bar();
    expect(el.className).toContain("border-neutral-200");
    expect(el.className).toContain("bg-white");
    expect(el.className).toContain("px-4");
    expect(el.className).toContain("shadow");
    expect(el.className).not.toContain("border-transparent");
  });

  it("drops the card style when the sentinel re-enters the viewport", () => {
    const io = stubIntersectionObserver();
    render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );

    act(() => io.fire(false));
    act(() => io.fire(true));

    const el = bar();
    expect(el.className).toContain("border-transparent");
    expect(el.className).toContain("shadow-none");
    expect(el.className).not.toContain(" bg-white");
  });

  it("disconnects the sentinel observer on unmount", () => {
    const io = stubIntersectionObserver();
    const view = render(
      <FilterBar>
        <p>filter field</p>
      </FilterBar>,
    );
    expect(io.liveCount()).toBe(1);
    expect(io.observedCount()).toBe(1);

    view.unmount();

    expect(io.liveCount()).toBe(0);
  });
});
