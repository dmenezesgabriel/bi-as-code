import type { BiacConfig } from "virtual:biac-config";

/**
 * Theme persistence, resolution and application. Unlike the sidebar's
 * sessionStorage, the theme rides `localStorage` — the choice is per
 * browser and survives tabs and restarts, matching the persisted toggles
 * the reference products ship (evidence's mode-watcher, streamlit's
 * theme.base). Every reader is guarded: storage can throw in private
 * modes and hand-edited values must never break the shell.
 */

const STORAGE_KEY = "biac.theme";

/** A resolved mode — what actually gets applied to the document. */
export type ThemeMode = "light" | "dark";

/**
 * The user's explicit choice, or null for "follow the configured default".
 * Anything else stored under the key is treated as absent.
 */
export function readStoredTheme(): ThemeMode | null {
  const raw = read();
  if (raw === "dark" || raw === "light") return raw;
  return null;
}

export function writeStoredTheme(mode: ThemeMode): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private mode, quota) — the toggle still works
    // for the session, the choice just doesn't persist.
  }
}

/**
 * Resolution order: the user's persisted choice wins; otherwise the
 * `biac.config.ts` default, with `"system"` deferring to
 * `prefers-color-scheme`.
 */
export function resolveTheme(
  configTheme: BiacConfig["theme"],
  stored: ThemeMode | null,
  systemDark: boolean,
): ThemeMode {
  if (stored) return stored;
  if (configTheme !== "system") return configTheme;
  return systemDark ? "dark" : "light";
}

/**
 * Applies a resolved mode to the document root. `color-scheme` rides along
 * so native UI (scrollbars, form controls) matches without extra styling.
 */
export function applyTheme(mode: ThemeMode): void {
  document.documentElement.classList.toggle("dark", mode === "dark");
  document.documentElement.style.colorScheme = mode;
}

function read(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}
