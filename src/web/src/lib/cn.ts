import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge conditional class names and de-duplicate conflicting Tailwind
 * utilities. The only sanctioned import site for clsx/tailwind-merge —
 * dependency-cruiser enforces it so custom type-scale names can be taught
 * to the merge in exactly one place.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
