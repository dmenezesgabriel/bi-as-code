import { afterEach, describe, expect, it } from "vitest";
import { isOutsidePress } from "./use-docked-dismissal";

/** An app root holding a bar and page content, plus a popup portaled to
 * `<body>` beside it. */
function mountPage(): Record<"bar" | "field" | "chart" | "popup", HTMLElement> {
  document.body.innerHTML = `
    <div id="root">
      <div id="bar"><input id="field" /></div>
      <div id="chart"></div>
    </div>
    <div id="popup"></div>`;
  const byId = (id: string): HTMLElement => document.getElementById(id)!;
  return {
    bar: byId("bar"),
    field: byId("field"),
    chart: byId("chart"),
    popup: byId("popup"),
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("isOutsidePress", () => {
  it("is true for a target in the app root but outside the bar", () => {
    const { bar, chart } = mountPage();

    expect(isOutsidePress(bar, chart)).toBe(true);
  });

  it("is false for the bar itself and anything inside it", () => {
    const { bar, field } = mountPage();

    expect(isOutsidePress(bar, bar)).toBe(false);
    expect(isOutsidePress(bar, field)).toBe(false);
  });

  it("is false for a target portaled outside the app root", () => {
    const { bar, popup } = mountPage();

    expect(isOutsidePress(bar, popup)).toBe(false);
  });

  it("is false without a bar or without a node target", () => {
    const { bar, chart } = mountPage();

    expect(isOutsidePress(null, chart)).toBe(false);
    expect(isOutsidePress(bar, null)).toBe(false);
    expect(isOutsidePress(bar, window)).toBe(false);
  });
});
