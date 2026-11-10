/**
 * Two fixes to the chart libraries the SPA bundles, applied to their sources
 * as Vite loads them so they reach every consumer of the package: a
 * dependency patch declared in a package manager never runs in an install of
 * `biac` (ADR-0036).
 *
 * - echarts (Apache-2.0, https://github.com/apache/echarts), `lib/core/echarts.js`:
 *   `updateVisual`, the update a `brush` action runs, restyles series without
 *   `renderSeries`' `clearStates`/`updateStates` wrap, so an element hovered
 *   or blurred while a brush greys it keeps that grey as its saved normal
 *   state and restores it when the hover leaves — a cleared brush leaves bars
 *   grey. Unfixed on echarts master; drop once `updateVisual` clears and
 *   re-applies element states.
 * - zrender (BSD-3-Clause, https://github.com/ecomfe/zrender),
 *   `lib/canvas/Painter.js`: echarts 6.1.0 marks every heatmap rect
 *   incremental, so a heatmap unmounted mid-paint leaves a `_paintList`
 *   continuation that runs after `dispose`. Unfixed on zrender master; drop
 *   once `Painter.dispose` resets `_redrawId`.
 *
 * An anchor that moved in a newer release fails the build naming the file,
 * rather than silently dropping the fix.
 */
import type { Plugin } from "vite";

interface SourceFix {
  /** Path below `node_modules/`. */
  readonly file: string;
  /** The one line of the pristine source the fix is placed around. */
  readonly anchor: string;
  readonly before: readonly string[];
  readonly after: readonly string[];
  /** Text that exists only in a patched file. */
  readonly marker: string;
}

const SOURCE_FIXES: readonly SourceFix[] = [
  {
    file: "echarts/lib/core/echarts.js",
    anchor:
      "chartView.updateVisual(seriesModel, ecModel, _this._api, payload);",
    before: [
      "// Like renderSeries: leave hover/select states before the restyle and",
      "// re-enter them after, or a state entered mid-brush keeps the stale",
      "// out-of-brush style as its normal state and restores it on leave.",
      "clearStates(seriesModel, chartView);",
    ],
    after: ["updateStates(seriesModel, chartView);"],
    marker: "Like renderSeries: leave hover/select states",
  },
  {
    file: "zrender/lib/canvas/Painter.js",
    anchor: "this.root.innerHTML = '';",
    before: [
      "// A pending `_paintList` continuation (an incremental layer that ran",
      "// over its frame budget) bails on a `_redrawId` mismatch; without",
      "// this it runs after dispose and reads the nulled `_i.layerStack`.",
      "this._redrawId = null;",
    ],
    after: [],
    marker: "A pending `_paintList` continuation",
  },
];

/** The module path as the file system spells it: posix, without Vite's `?query`. */
function modulePath(id: string): string {
  return id.split("?")[0]!.replaceAll("\\", "/");
}

function fixFor(id: string): SourceFix | undefined {
  const path = modulePath(id);
  return SOURCE_FIXES.find((fix) => path.endsWith(`/node_modules/${fix.file}`));
}

function indented(lines: readonly string[], indent: string): string[] {
  return lines.map((line) => indent + line);
}

function applyFix(code: string, fix: SourceFix): string {
  if (code.includes(fix.marker)) {
    throw new Error(
      `already patched: ${fix.file} contains "${fix.marker}"; the fix is applied once, by this plugin — remove any other patch of that file`,
    );
  }
  const found = code.split(fix.anchor).length - 1;
  if (found !== 1) {
    throw new Error(
      `${fix.file}: expected the line "${fix.anchor}" exactly once to place a fix around, found ${found}; the library changed — move the anchor`,
    );
  }
  const anchorAt = code.indexOf(fix.anchor);
  const lineStart = code.lastIndexOf("\n", anchorAt) + 1;
  const indent = code.slice(lineStart, anchorAt);
  const anchorEnd = anchorAt + fix.anchor.length;
  return [
    code.slice(0, lineStart),
    ...indented(fix.before, indent).map((line) => `${line}\n`),
    code.slice(lineStart, anchorEnd),
    ...indented(fix.after, indent).map((line) => `\n${line}`),
    code.slice(anchorEnd),
  ].join("");
}

/**
 * Applies the chart-library fix that belongs to `id`; any other module is
 * returned as given.
 *
 * @example
 * patchChartSource(source, "/app/node_modules/zrender/lib/canvas/Painter.js");
 */
export function patchChartSource(code: string, id: string): string {
  const fix = fixFor(id);
  return fix ? applyFix(code, fix) : code;
}

/**
 * Register it in `plugins` for `vite build` and in
 * `optimizeDeps.rolldownOptions.plugins` for the dev dependency pre-bundle,
 * which reads the libraries without going through `plugins`.
 */
export function chartSourceFixes(): Plugin {
  return {
    name: "biac:chart-source-fixes",
    enforce: "pre",
    transform(code, id) {
      const patched = patchChartSource(code, id);
      return patched === code ? null : patched;
    },
  };
}
