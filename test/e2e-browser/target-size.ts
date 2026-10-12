import type { Locator } from "@playwright/test";

/**
 * Asserts a pointer target's rendered box is at least `minPx` on both axes —
 * WCAG 2.2 SC 2.5.8 Target Size (Minimum) sets the floor at 24 CSS px
 * (https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
 *
 * @example
 * await expectMinTargetSize(page.getByRole("button", { name: "Next page" }), 24);
 */
export async function expectMinTargetSize(
  target: Locator,
  minPx: number,
): Promise<void> {
  const box = await target.boundingBox();
  if (!box) {
    throw new Error(
      `${target} has no bounding box; expected a rendered target`,
    );
  }
  if (box.width >= minPx && box.height >= minPx) return;
  throw new Error(
    `${target} measures ${box.width}×${box.height}; expected ≥ ${minPx}×${minPx}`,
  );
}
