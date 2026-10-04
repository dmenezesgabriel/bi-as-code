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
      className="ml-2 rounded p-1.5 text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
    >
      {mode === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
