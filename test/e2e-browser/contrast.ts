import type { Locator, Page } from "@playwright/test";

/** An sRGB colour as 0–255 channels. */
export type Rgb = readonly [number, number, number];

/**
 * A computed CSS colour as the sRGB channels it paints. Tailwind 4 colours
 * compute as oklch() and theme tokens as hex, so each is painted on a 1×1
 * canvas and read back to compare like with like.
 *
 * @example
 * expect(await paintedRgb(page, "oklch(0.205 0 0)")).toEqual([23, 23, 23]);
 */
export function paintedRgb(page: Page, color: string): Promise<Rgb> {
  return page.evaluate((css) => {
    const context = document.createElement("canvas").getContext("2d", {
      willReadFrequently: true,
    })!;
    context.fillStyle = css;
    context.fillRect(0, 0, 1, 1);
    const [r = 0, g = 0, b = 0] = context.getImageData(0, 0, 1, 1).data;
    return [r, g, b] as const;
  }, color);
}

/**
 * WCAG 2 contrast ratio of two computed CSS colors, each read back as the
 * sRGB it paints before applying the relative-luminance formula.
 *
 * @example
 * expect(await contrastRatio(page, "oklch(0.5 0.1 160)", "#fff")).toBeGreaterThanOrEqual(4.5);
 */
export async function contrastRatio(
  page: Page,
  foreground: string,
  background: string,
): Promise<number> {
  const [first, second] = [
    luminance(await paintedRgb(page, foreground)),
    luminance(await paintedRgb(page, background)),
  ];
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

function luminance(rgb: Rgb): number {
  const weights = [0.2126, 0.7152, 0.0722];
  return rgb
    .map((channel) => channel / 255)
    .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((sum, c, i) => sum + c * (weights[i] ?? 0), 0);
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

/** The value custom property `token` holds on the document root, trimmed. */
export function readRootToken(page: Page, token: string): Promise<string> {
  return page.evaluate(
    (name) =>
      getComputedStyle(document.documentElement).getPropertyValue(name).trim(),
    token,
  );
}
