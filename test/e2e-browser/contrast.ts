import type { Locator, Page } from "@playwright/test";

/**
 * WCAG 2 contrast ratio of two computed CSS colors. Tailwind 4 colors
 * compute as oklch(), so each is painted on a 1×1 canvas to read back sRGB
 * before applying the relative-luminance formula.
 *
 * @example
 * expect(await contrastRatio(page, "oklch(0.5 0.1 160)", "#fff")).toBeGreaterThanOrEqual(4.5);
 */
export function contrastRatio(
  page: Page,
  foreground: string,
  background: string,
): Promise<number> {
  return page.evaluate(
    (colors) => {
      const context = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      })!;
      const weights = [0.2126, 0.7152, 0.0722];
      const luminance = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return Array.from(context.getImageData(0, 0, 1, 1).data)
          .slice(0, 3)
          .map((channel) => channel / 255)
          .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
          .reduce((sum, c, i) => sum + c * (weights[i] ?? 0), 0);
      };
      const [first, second] = colors.map(luminance) as [number, number];
      const [lighter, darker] = [
        Math.max(first, second),
        Math.min(first, second),
      ];
      return (lighter + 0.05) / (darker + 0.05);
    },
    [foreground, background],
  );
}

/**
 * The background an element's text is actually drawn on: its own and its
 * ancestors' background colors, from the first opaque one up the tree,
 * composited bottom-up on a 1×1 canvas. A translucent tint (a `bg-x/10`
 * chip) alone would read as near-transparent black.
 *
 * @example
 * const bg = await effectiveBackground(page.locator("[data-status]").first());
 */
export function effectiveBackground(element: Locator): Promise<string> {
  return element.evaluate((start) => {
    const context = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    const layers: string[] = [];
    for (let node: Element | null = start; node; node = node.parentElement) {
      const color = getComputedStyle(node).backgroundColor;
      layers.unshift(color);
      if (isOpaque(color)) break;
    }
    // A page with no opaque background renders on the canvas default white.
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 1, 1);
    for (const layer of layers) {
      context.fillStyle = layer;
      context.fillRect(0, 0, 1, 1);
    }
    const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
    return `rgb(${r}, ${g}, ${b})`;

    function isOpaque(color: string): boolean {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      return context.getImageData(0, 0, 1, 1).data[3] === 255;
    }
  });
}
