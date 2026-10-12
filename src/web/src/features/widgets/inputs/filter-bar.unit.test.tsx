import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubIntersectionObserver } from "../../chrome/intersection-observer.stub";
import { stubResizeObserver } from "../../chrome/resize-observer.stub";
import { FilterBar } from "./filter-bar";

const REST_HEIGHT = 190;

function renderBar() {
  return render(
    <FilterBar>
      <p>filter field</p>
    </FilterBar>,
  );
}

function inputsPanel(): HTMLElement {
  return screen.getByText("filter field").parentElement!;
}

function bar(): HTMLElement {
  return inputsPanel().closest<HTMLElement>(".sticky")!;
}

function filtersTrigger(): HTMLElement | null {
  return screen.queryByRole("button", { name: "Filters" });
}

function flowSpacer(): HTMLElement {
  return bar().nextElementSibling as HTMLElement;
}

/**
 * jsdom lays nothing out, so every `offsetHeight` is 0. Give the bar the
 * height its input block has in a browser.
 */
function stubBarHeight(restHeight: { value: number }): void {
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(
    () => restHeight.value,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FilterBar", () => {
  describe("layout", () => {
    it("renders children in a horizontal wrapping row inside a sticky bar", () => {
      stubIntersectionObserver();

      renderBar();

      for (const cls of ["sticky", "top-(--dock-top,4rem)", "z-10"]) {
        expect(bar().className).toContain(cls);
      }
      for (const cls of [
        "flex",
        "flex-row",
        "flex-wrap",
        "items-end",
        "gap-4",
      ]) {
        expect(inputsPanel().className).toContain(cls);
      }
    });

    it("never transitions its box, so a height read at the dock moment is final", () => {
      stubIntersectionObserver();

      renderBar();

      expect(bar().className).not.toContain("transition-all");
    });

    it("places an aria-hidden zero-size sentinel above the bar", () => {
      stubIntersectionObserver();

      renderBar();

      const sentinel = bar().previousElementSibling!;
      expect(sentinel).toHaveAttribute("aria-hidden", "true");
      for (const cls of [
        "pointer-events-none",
        "-mt-(--dock-top,4rem)",
        "mb-(--dock-top,4rem)",
        "h-0",
        "w-0",
      ]) {
        expect(sentinel.className).toContain(cls);
      }
    });
  });

  describe("card face", () => {
    it("renders at rest, not floating, before the sentinel is observed", () => {
      stubIntersectionObserver();

      renderBar();

      // `default: true` — the bar must not paint its card face on first
      // render and flash back when the observer lands.
      expect(bar().className).toContain("border-transparent");
      expect(bar().className).toContain("shadow-none");
      expect(bar().className).not.toContain(" bg-white");
    });

    it("gains the floating card style when the sentinel leaves the viewport", () => {
      const io = stubIntersectionObserver();
      renderBar();

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
      renderBar();

      act(() => io.fire(false));
      act(() => io.fire(true));

      const el = bar();
      expect(el.className).toContain("border-transparent");
      expect(el.className).toContain("shadow-none");
      expect(el.className).not.toContain(" bg-white");
    });

    it("disconnects the sentinel observer on unmount", () => {
      const io = stubIntersectionObserver();
      const view = renderBar();
      expect(io.liveCount()).toBe(1);
      expect(io.observedCount()).toBe(1);

      view.unmount();

      expect(io.liveCount()).toBe(0);
    });
  });

  describe("docked disclosure", () => {
    it("shows every input and no Filters trigger at rest", () => {
      stubIntersectionObserver();

      renderBar();

      expect(filtersTrigger()).toBeNull();
      expect(screen.getByText("filter field")).toBeVisible();
    });

    it("collapses to a Filters trigger when docked, keeping the inputs mounted but hidden", () => {
      const io = stubIntersectionObserver();
      renderBar();

      act(() => io.fire(false));

      expect(filtersTrigger()).toHaveAttribute("aria-expanded", "false");
      expect(inputsPanel()).toHaveAttribute("hidden");
      expect(screen.getByText("filter field")).toBeInTheDocument();
    });

    it("opens the inputs when the docked Filters trigger is clicked", () => {
      const io = stubIntersectionObserver();
      renderBar();
      act(() => io.fire(false));

      fireEvent.click(filtersTrigger()!);

      expect(filtersTrigger()).toHaveAttribute("aria-expanded", "true");
      expect(inputsPanel()).not.toHaveAttribute("hidden");
      expect(filtersTrigger()).toHaveAttribute(
        "aria-controls",
        inputsPanel().id,
      );
    });

    it("is exactly one fixed row tall while docked, and its natural height at rest", () => {
      const io = stubIntersectionObserver();
      renderBar();
      const heightAtRest = bar().style.height;

      act(() => io.fire(false));

      expect(heightAtRest).toBe("");
      expect(bar().style.height).toBe("2.5rem");
    });

    it("lays the opened docked inputs over the page instead of in flow", () => {
      const io = stubIntersectionObserver();
      renderBar();
      act(() => io.fire(false));

      fireEvent.click(filtersTrigger()!);

      expect(inputsPanel().className).toContain("absolute");
      expect(inputsPanel().className).toContain("top-full");
    });

    it("closes again on a second click of the trigger", () => {
      const io = stubIntersectionObserver();
      renderBar();
      act(() => io.fire(false));
      fireEvent.click(filtersTrigger()!);

      fireEvent.click(filtersTrigger()!);

      expect(filtersTrigger()).toHaveAttribute("aria-expanded", "false");
      expect(inputsPanel()).toHaveAttribute("hidden");
    });

    it("drops the trigger back at rest and docks collapsed the next time", () => {
      const io = stubIntersectionObserver();
      renderBar();
      act(() => io.fire(false));
      fireEvent.click(filtersTrigger()!);

      act(() => io.fire(true));
      const triggerAtRest = filtersTrigger();
      const panelHiddenAtRest = inputsPanel().hasAttribute("hidden");
      act(() => io.fire(false));

      expect(triggerAtRest).toBeNull();
      expect(panelHiddenAtRest).toBe(false);
      expect(filtersTrigger()).toHaveAttribute("aria-expanded", "false");
      expect(inputsPanel()).toHaveAttribute("hidden");
    });
  });

  describe("flow height", () => {
    it("holds no extra height at rest", () => {
      stubIntersectionObserver();
      stubBarHeight({ value: REST_HEIGHT });

      renderBar();

      expect(flowSpacer()).toHaveAttribute("aria-hidden", "true");
      expect(flowSpacer().style.height).toBe("0px");
    });

    it("holds the height the docked bar gave up, collapsed or opened", () => {
      const io = stubIntersectionObserver();
      stubBarHeight({ value: REST_HEIGHT });
      renderBar();

      act(() => io.fire(false));
      const collapsedHeld = flowSpacer().style.height;
      fireEvent.click(filtersTrigger()!);

      expect(collapsedHeld).toBe("max(0px, 190px - 2.5rem)");
      expect(flowSpacer().style.height).toBe(collapsedHeld);
    });

    it("holds the rest height last reported before docking", () => {
      const io = stubIntersectionObserver();
      const ro = stubResizeObserver();
      const restHeight = { value: REST_HEIGHT };
      stubBarHeight(restHeight);
      renderBar();

      // An input's options land after mount and the row wraps.
      restHeight.value = 258;
      act(() => ro.fire());
      act(() => io.fire(false));

      expect(flowSpacer().style.height).toBe("max(0px, 258px - 2.5rem)");
    });

    it("gives the held height back when the bar returns to rest", () => {
      const io = stubIntersectionObserver();
      stubBarHeight({ value: REST_HEIGHT });
      renderBar();
      act(() => io.fire(false));

      act(() => io.fire(true));

      expect(flowSpacer().style.height).toBe("0px");
    });

    it("stops watching the bar's size while docked and on unmount", () => {
      const io = stubIntersectionObserver();
      const ro = stubResizeObserver();
      const view = renderBar();
      const watchedAtRest = ro.liveCount();

      act(() => io.fire(false));
      const watchedDocked = ro.liveCount();
      act(() => io.fire(true));
      view.unmount();

      expect(watchedAtRest).toBe(1);
      expect(watchedDocked).toBe(0);
      expect(ro.liveCount()).toBe(0);
    });
  });
});
