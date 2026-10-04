import { Moon, Sun, type LucideProps } from "lucide-react";

/**
 * The `lucide-react` wrap site — `.dependency-cruiser.cjs` keeps the icon
 * set behind `src/web/src/components/` so sizes stay consistent and the
 * library stays swappable. Icons render `aria-hidden`: they are
 * decorative, so a control carrying one must name itself.
 */

/** Sun glyph — the theme toggle shows it while the UI is dark. */
export function SunIcon(props: LucideProps) {
  return <Sun aria-hidden size={16} {...props} />;
}

/** Moon glyph — the theme toggle shows it while the UI is light. */
export function MoonIcon(props: LucideProps) {
  return <Moon aria-hidden size={16} {...props} />;
}
