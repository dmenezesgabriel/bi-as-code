import { MoonIcon, SunIcon } from "../../components/icons";
import type { ThemeMode } from "./theme";

/**
 * Header button that flips the persisted theme. The icon shows the mode a
 * click switches to — a moon invites dark, a sun invites light (the same
 * convention evidence's mode-watcher toggle uses). The component is
 * controlled: `useTheme` in the shell owns resolution, application and
 * storage so chrome-free layouts still get the theme.
 *
 * @example
 * const { mode, toggle } = useTheme(site.theme);
 * <ThemeToggle mode={mode} onToggle={toggle} />
 */
export function ThemeToggle({
  mode,
  onToggle,
}: {
  mode: ThemeMode;
  onToggle: () => void;
}) {
  const target: ThemeMode = mode === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      aria-label={`Switch to ${target} mode`}
      title={`Switch to ${target} mode`}
      onClick={onToggle}
      className="ml-2 rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
