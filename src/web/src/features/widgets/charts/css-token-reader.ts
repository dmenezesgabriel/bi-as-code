import { createContext, useContext } from "react";
import type { ThemeMode } from "../../chrome/theme";
import type { ReadToken } from "./types";

/**
 * Where `withTokenProbe` appends its probe — `document.body` unless a
 * provider sets it. A widget mounted inside a shadow root (the exported
 * widget module) provides its shadow root: the probe must read the
 * stylesheet injected there, because the host page's document carries none
 * of the project's tokens.
 */
export const TokenProbeParentContext = createContext<Node | null>(null);

/**
 * Hands `consume` a reader of the theme tokens as they resolve for `mode`,
 * through a hidden probe classed `light` or `dark` under `parent`. The probe
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
  parent: Node = document.body,
): T {
  const probe = document.createElement("div");
  probe.className = mode;
  probe.hidden = true;
  parent.appendChild(probe);
  try {
    const style = getComputedStyle(probe);
    return consume((name) => style.getPropertyValue(name));
  } finally {
    probe.remove();
  }
}

/** The probe parent in effect where a chart renders — unset outside a shadow-rooted mount. */
export function useTokenProbeParent(): Node | undefined {
  return useContext(TokenProbeParentContext) ?? undefined;
}
