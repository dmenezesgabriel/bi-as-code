import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { stubIntersectionObserver } from "../../chrome/intersection-observer.stub";
import { FakeFilterUrlPort } from "../../filters/fake-url-port";
import { FiltersProvider } from "../../filters/page-filters-context";
import { FilterBar } from "./filter-bar";
import { Toggle } from "./toggle";

/** Docks a bar holding two real toggles, seeded from `search`. */
function renderDockedToggles(search: string): void {
  const io = stubIntersectionObserver();
  render(
    <FiltersProvider port={new FakeFilterUrlPort(search)}>
      <FilterBar>
        <Toggle id="large_orders" label="Large orders only" />
        <Toggle id="returned" label="Returned" />
      </FilterBar>
    </FiltersProvider>,
  );
  act(() => io.fire(false));
}

function filtersTrigger(): HTMLElement {
  return screen.getByRole("button", { name: "Filters" });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("FilterBar active count", () => {
  it("shows no count while no input is applied", () => {
    renderDockedToggles("");

    expect(filtersTrigger()).toHaveTextContent(/^Filters$/);
    expect(filtersTrigger()).not.toHaveAccessibleDescription();
  });

  it("counts the applied inputs, as the trigger's description", () => {
    renderDockedToggles("?large_orders=true&returned=true");

    expect(filtersTrigger()).toContainElement(screen.getByText("· 2"));
    expect(filtersTrigger()).toHaveAccessibleDescription("2 active");
  });

  it("follows an input switched on and off through the opened bar", () => {
    renderDockedToggles("");
    fireEvent.click(filtersTrigger());
    const largeOrders = screen.getByRole("switch", {
      name: "Large orders only",
    });

    fireEvent.click(largeOrders);
    const descriptionWhenOn = filtersTrigger().getAttribute("aria-describedby");
    fireEvent.click(largeOrders);

    expect(descriptionWhenOn).not.toBeNull();
    expect(filtersTrigger()).not.toHaveAccessibleDescription();
  });
});
