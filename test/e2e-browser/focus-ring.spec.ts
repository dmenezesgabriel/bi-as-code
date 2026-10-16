import type { Page } from "@playwright/test";
import {
  collectConsoleErrors,
  expect,
  resultTables,
  test,
} from "./dev-server.fixture.js";
import {
  contrastRatio,
  effectiveBackground,
  paintedRgb,
  readRootToken,
} from "./contrast.js";

/** Enough `Tab` presses to visit every kind of control on `/weekly-review`. */
const STOPS = 40;

/** The live result tables `/weekly-review` renders. */
const RESULT_TABLES = 4;

/** WCAG 2.4.13 Focus Appearance: a ring at least 2 CSS px thick … */
const MIN_RING_WIDTH = 2;
/** … whose pixels contrast 3:1 with the colour they sit next to. */
const MIN_RING_CONTRAST = 3;

/**
 * Smallest side a ring host may have: a visually hidden element is 1 px or
 * less, so a ring it draws is never seen.
 */
const MIN_HOST_SIDE = 2;

/**
 * Whether the ring host paints at all: a visually hidden input — Base UI's
 * slider thumb hides its `input[type=range]` with `clip-path: inset(50%)` —
 * takes the focus but cuts its own outline away.
 */
function isPainted(ring: FocusRing): boolean {
  return (
    ring.hostSide >= MIN_HOST_SIDE &&
    ring.hostClipPath === "none" &&
    ring.hostOpacity !== "0"
  );
}

/** Marks the element drawing the ring, and its parent, for later locators. */
const HOST_ATTRIBUTE = "data-focus-ring-host";
const NEIGHBOUR_ATTRIBUTE = "data-focus-ring-neighbour";

/** The outline one focus stop paints, read off the element that draws it. */
interface FocusRing {
  stop: number;
  /** The focused element, for failure messages. */
  label: string;
  style: string;
  width: number;
  offset: number;
  color: string;
  /** The ring host's shorter side, in px. */
  hostSide: number;
  hostClipPath: string;
  hostOpacity: string;
  /** Whether an `overflow` ancestor cuts any part of the ring off. */
  clipped: boolean;
}

/** A ring plus the backgrounds its pixels border, read while it is focused. */
interface FocusStop extends FocusRing {
  adjacent: string[];
}

/**
 * Reads the ring of the focused element, or — for a `focus-within` control
 * whose inner input draws none — of the nearest ancestor that draws one,
 * and tags that host and its parent with `HOST_ATTRIBUTE`/`NEIGHBOUR_ATTRIBUTE`.
 */
function readFocusRing(page: Page, stop: number): Promise<FocusRing> {
  const marks = { host: HOST_ATTRIBUTE, neighbour: NEIGHBOUR_ATTRIBUTE };
  return page.evaluate(
    async ({ stop, marks }) => {
      const focused = document.activeElement ?? document.body;
      const host = markRingHost(focused);
      // A `transition-colors` control fades its outline in from
      // currentColor; read the ring it settles on.
      await Promise.all(host.getAnimations().map((motion) => motion.finished));
      const style = getComputedStyle(host);
      const [width, offset] = [style.outlineWidth, style.outlineOffset].map(
        parseFloat,
      ) as [number, number];
      const box = host.getBoundingClientRect();
      return {
        stop,
        label: `${focused.tagName.toLowerCase()} "${(focused.getAttribute("aria-label") ?? focused.textContent ?? "").trim().slice(0, 40)}"`,
        style: style.outlineStyle,
        width,
        offset,
        color: style.outlineColor,
        hostSide: Math.min(box.width, box.height),
        hostClipPath: style.clipPath,
        hostOpacity: style.opacity,
        clipped: isClipped(host, Math.max(0, offset + width)),
      };

      function markRingHost(element: Element): Element {
        for (const mark of [marks.host, marks.neighbour])
          document.querySelector(`[${mark}]`)?.removeAttribute(mark);
        let host = element;
        while (
          getComputedStyle(host).outlineStyle === "none" &&
          host.parentElement
        )
          host = host.parentElement;
        host.setAttribute(marks.host, "");
        (host.parentElement ?? host).setAttribute(marks.neighbour, "");
        return host;
      }

      function isClipped(element: Element, outset: number): boolean {
        const ring = element.getBoundingClientRect();
        for (
          let node = element.parentElement;
          node;
          node = node.parentElement
        ) {
          const { overflowX, overflowY } = getComputedStyle(node);
          const box = node.getBoundingClientRect();
          const cut = (inner: number, outer: number) => inner < outer - 0.5;
          if (
            overflowX !== "visible" &&
            (cut(ring.left - outset, box.left) ||
              cut(box.right, ring.right + outset))
          )
            return true;
          if (
            overflowY !== "visible" &&
            (cut(ring.top - outset, box.top) ||
              cut(box.bottom, ring.bottom + outset))
          )
            return true;
        }
        return false;
      }
    },
    { stop, marks },
  );
}

/**
 * The colours the ring's pixels border: an outset ring sits on the parent's
 * background, an inset one on the host's own, and one straddling the border
 * edge touches both.
 */
async function adjacentColors(page: Page, ring: FocusRing): Promise<string[]> {
  const colors: string[] = [];
  if (ring.offset + ring.width > 0)
    colors.push(
      await effectiveBackground(page.locator(`[${NEIGHBOUR_ATTRIBUTE}]`)),
    );
  if (ring.offset < 0)
    colors.push(await effectiveBackground(page.locator(`[${HOST_ATTRIBUTE}]`)));
  return colors;
}

/** Asserts one stop's ring: solid, the `--ring` token, thick, unclipped, 3:1. */
async function expectDesignedRing(
  page: Page,
  ring: FocusStop,
  ringToken: readonly number[],
): Promise<void> {
  const at = `stop ${ring.stop} ${ring.label}`;
  expect.soft(ring.style, at).toBe("solid");
  expect.soft(ring.width, at).toBeGreaterThanOrEqual(MIN_RING_WIDTH);
  expect.soft(await paintedRgb(page, ring.color), at).toEqual(ringToken);
  expect.soft(isPainted(ring), `${at} host painted`).toBe(true);
  expect.soft(ring.clipped, at).toBe(false);
  for (const adjacent of ring.adjacent) {
    const ratio = await contrastRatio(page, ring.color, adjacent);
    expect
      .soft(ratio, `${at} on ${adjacent}`)
      .toBeGreaterThanOrEqual(MIN_RING_CONTRAST);
  }
}

/** Presses `Tab` `STOPS` times from a fresh load, reading each ring. */
async function tourFocusRings(page: Page): Promise<FocusStop[]> {
  const rings: FocusStop[] = [];
  for (let stop = 1; stop <= STOPS; stop += 1) {
    await page.keyboard.press("Tab");
    const ring = await readFocusRing(page, stop);
    rings.push({ ...ring, adjacent: await adjacentColors(page, ring) });
  }
  return rings;
}

async function openWeeklyReview(page: Page, url: string): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${url}weekly-review`);
  await expect(page.getByRole("combobox", { name: "Region" })).toBeVisible();
  // Each result table adds sort headers and a pager to the tour.
  await expect(resultTables(page)).toHaveCount(RESULT_TABLES);
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`${colorScheme} mode`, () => {
    test.use({ colorScheme });

    test(`every one of ${STOPS} Tab stops shows the one designed ring`, async ({
      page,
      biacDev,
    }) => {
      const errors = collectConsoleErrors(page);
      await openWeeklyReview(page, biacDev.url);
      const ringToken = await paintedRgb(
        page,
        await readRootToken(page, "--ring"),
      );

      const rings = await tourFocusRings(page);

      for (const ring of rings) await expectDesignedRing(page, ring, ringToken);
      const looks = new Set(
        rings.map((r) => `${r.style} ${r.width} ${r.color}`),
      );
      expect([...looks]).toHaveLength(1);
      expect(errors).toEqual([]);
    });
  });
}
