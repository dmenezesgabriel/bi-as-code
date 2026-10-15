import {
  createContext,
  useContext,
  type ReactElement,
  type ReactNode,
} from "react";
import type { ThemeMode } from "./theme";

/**
 * The resolved light/dark mode as a tree value. `useTheme` already decides
 * the mode and applies it to `documentElement`, but canvas-rendered widgets
 * (echarts) cannot read CSS classes — they need the mode as a JS value to
 * read their theme tokens for. Default `light` for provider-less mounts
 * (stories, tests).
 */
const ThemeModeContext = createContext<ThemeMode>("light");

/**
 * @example
 * <ThemeModeProvider mode={theme.mode}>{children}</ThemeModeProvider>
 */
export function ThemeModeProvider({
  mode,
  children,
}: {
  mode: ThemeMode;
  children: ReactNode;
}): ReactElement {
  return (
    <ThemeModeContext.Provider value={mode}>
      {children}
    </ThemeModeContext.Provider>
  );
}

/** The resolved mode for canvas/SVG engines that can't see `.dark`. */
export function useThemeMode(): ThemeMode {
  return useContext(ThemeModeContext);
}
