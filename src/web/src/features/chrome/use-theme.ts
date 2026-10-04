import { useEffect, useState } from "react";
import type { BiacConfig } from "virtual:biac-config";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
  type ThemeMode,
} from "./theme";
import { useMediaQuery } from "./use-media-query";

const SYSTEM_DARK_QUERY = "(prefers-color-scheme: dark)";

/**
 * The resolved theme plus the user's toggle. State is the stored override —
 * null means "follow the `biac.config.ts` default", and a `"system"`
 * default keeps following `prefers-color-scheme` live. The mode is applied
 * to the document root on mount and on every change; the inline script in
 * index.html already applied the pre-paint choice, so the effect only
 * reasserts it.
 *
 * @example
 * const { mode, toggle } = useTheme(site.theme);
 * <ThemeToggle mode={mode} onToggle={toggle} />
 */
export function useTheme(configTheme: BiacConfig["theme"]): {
  mode: ThemeMode;
  toggle: () => void;
} {
  const systemDark = useMediaQuery(SYSTEM_DARK_QUERY);
  const [stored, setStored] = useState<ThemeMode | null>(readStoredTheme);
  const mode = resolveTheme(configTheme, stored, systemDark);

  useEffect(() => applyTheme(mode), [mode]);

  function toggle() {
    const next: ThemeMode = mode === "dark" ? "light" : "dark";
    setStored(next);
    writeStoredTheme(next);
  }

  return { mode, toggle };
}
