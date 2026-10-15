import type { ThemeMode } from "../../chrome/theme";
import type { ReadToken } from "./types";

/**
 * Hands `consume` a reader of the theme tokens as they resolve for `mode`,
 * through a hidden probe classed `light` or `dark` under `<body>`. The probe
 * carries its own mode class rather than inheriting `<html>`'s because a
 * chart re-inits for the new mode before `useTheme` moves `.dark` on the
 * root — React runs a child's effects before its parent's. The probe is
 * removed once `consume` returns, so the reader must not outlive it.
 *
 * @example
 * const tokens = withTokenProbe("dark", readChartTokens);
 */
export function withTokenProbe<T>(
  mode: ThemeMode,
  consume: (read: ReadToken) => T,
): T {
  const probe = document.createElement("div");
  probe.className = mode;
  probe.hidden = true;
  document.body.append(probe);
  try {
    const style = getComputedStyle(probe);
    return consume((name) => style.getPropertyValue(name));
  } finally {
    probe.remove();
  }
}
