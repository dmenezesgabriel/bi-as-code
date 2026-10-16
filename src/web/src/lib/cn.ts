import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// tailwind-merge only knows Tailwind's default theme steps; `measure` is
// `--container-measure` in `styles.css`, so without this a caller's
// `max-w-none` would sit beside `max-w-measure` instead of replacing it.
const twMerge = extendTailwindMerge({
  extend: { theme: { container: ["measure"] } },
});

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind
 * utilities. The only sanctioned import site for clsx/tailwind-merge —
 * dependency-cruiser enforces it so custom type-scale names can be taught
 * to the merge in exactly one place.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
