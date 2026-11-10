import { describe, expect, it } from "vitest";
import { chartSourceFixes, patchChartSource } from "./chart-source-fixes.ts";

const ECHARTS_ID =
  "/app/node_modules/.pnpm/echarts@6.1.0/node_modules/echarts/lib/core/echarts.js";
const ZRENDER_ID =
  "/app/node_modules/.pnpm/zrender@6.1.0/node_modules/zrender/lib/canvas/Painter.js";

// The lines of the pristine 6.1.0 sources each fix is anchored to.
const PRISTINE_ECHARTS = [
  "        ecModel.eachSeries(function (seriesModel) {",
  "          var chartView = _this._chartsMap[seriesModel.__viewId];",
  "          chartView.updateVisual(seriesModel, ecModel, _this._api, payload);",
  "        });",
].join("\n");
const PRISTINE_ZRENDER = [
  "    CanvasPainter.prototype.dispose = function () {",
  "        this.root.innerHTML = '';",
  "        this.root =",
].join("\n");

const occurrences = (text: string, part: string): number =>
  text.split(part).length - 1;

describe("patchChartSource", () => {
  it("wraps echarts' updateVisual in clearStates and updateStates", () => {
    // Arrange
    const updateVisual =
      "chartView.updateVisual(seriesModel, ecModel, _this._api, payload);";

    // Act
    const patched = patchChartSource(PRISTINE_ECHARTS, ECHARTS_ID);

    // Assert
    const lines = patched.split("\n").map((line) => line.trim());
    const at = lines.indexOf(updateVisual);
    expect(lines[at - 1]).toBe("clearStates(seriesModel, chartView);");
    expect(lines[at + 1]).toBe("updateStates(seriesModel, chartView);");
    expect(occurrences(patched, "clearStates(")).toBe(1);
  });

  it("keeps the indentation of the line it wraps", () => {
    // Arrange / Act
    const patched = patchChartSource(PRISTINE_ECHARTS, ECHARTS_ID);

    // Assert
    expect(patched).toContain(
      "\n          clearStates(seriesModel, chartView);\n          chartView.updateVisual(",
    );
  });

  it("resets zrender's _redrawId before dispose empties the root", () => {
    // Arrange / Act
    const patched = patchChartSource(PRISTINE_ZRENDER, ZRENDER_ID);

    // Assert
    const lines = patched.split("\n").map((line) => line.trim());
    const at = lines.indexOf("this.root.innerHTML = '';");
    expect(lines[at - 1]).toBe("this._redrawId = null;");
    expect(occurrences(patched, "this._redrawId = null;")).toBe(1);
  });

  it("matches a Windows path and a Vite query suffix", () => {
    // Arrange
    const windowsId =
      "C:\\app\\node_modules\\zrender\\lib\\canvas\\Painter.js?v=1a2b";

    // Act
    const patched = patchChartSource(PRISTINE_ZRENDER, windowsId);

    // Assert
    expect(patched).toContain("this._redrawId = null;");
  });

  it("returns every other module unchanged", () => {
    // Arrange
    const id = "/app/node_modules/echarts/lib/chart/bar/BarView.js";

    // Act / Assert
    expect(patchChartSource(PRISTINE_ECHARTS, id)).toBe(PRISTINE_ECHARTS);
  });

  it("does not match a file of another package with the same name", () => {
    // Arrange
    const id = "/app/node_modules/not-echarts/lib/core/echarts.js";

    // Act / Assert
    expect(patchChartSource(PRISTINE_ECHARTS, id)).toBe(PRISTINE_ECHARTS);
  });

  it("throws naming the file and the anchor when the anchor moved", () => {
    // Arrange
    const upgraded = "var upgraded = true;";

    // Act / Assert
    expect(() => patchChartSource(upgraded, ECHARTS_ID)).toThrow(
      /echarts\/lib\/core\/echarts\.js.*chartView\.updateVisual\(seriesModel, ecModel, _this\._api, payload\);/s,
    );
  });

  it("throws instead of inserting a fix twice into an already patched file", () => {
    // Arrange
    const once = patchChartSource(PRISTINE_ZRENDER, ZRENDER_ID);

    // Act / Assert
    expect(() => patchChartSource(once, ZRENDER_ID)).toThrow(
      /already patched.*zrender\/lib\/canvas\/Painter\.js/s,
    );
  });
});

describe("chartSourceFixes", () => {
  it("transforms a matching module and leaves others to Vite", () => {
    // Arrange
    const plugin = chartSourceFixes();
    const transform = plugin.transform as (code: string, id: string) => unknown;

    // Act
    const patched = transform(PRISTINE_ZRENDER, ZRENDER_ID);
    const untouched = transform("export {};", "/app/src/main.tsx");

    // Assert
    expect(patched).toContain("this._redrawId = null;");
    expect(untouched).toBeNull();
  });
});
