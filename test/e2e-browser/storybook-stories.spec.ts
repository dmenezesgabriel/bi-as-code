import { expect, test, type Page } from "@playwright/test";

/* eslint-disable sonarjs/no-empty-collection -- KNOWN_NOISE and
 * INTENTIONAL_ERROR_STATE_STORIES are allowlists that start empty by
 * design: entries appear only when real noise or an error-state story
 * is observed, and the comments on each demand a dated justification. */

// Regression guard for every colocated story: a component whose render or
// play function throws (a provider a story forgot to wrap itself in, an
// uncaught promise rejection, a React error boundary) always lands on the
// console even when the story's own UI looks "fine" at a glance. The sweep
// visits every story's iframe so a failure is attributed to its story id.
const STORYBOOK_URL = process.env.BIAC_STORYBOOK_URL ?? "http://localhost:6175";

interface StoryIndexEntry {
  id: string;
  type?: string;
}

// One entry in `window.__STORYBOOK_PREVIEW__.storyRenders` — see
// collectStoryConsoleErrors for what the phases mean to this sweep.
interface PreviewStoryRender {
  id: string;
  phase?: string;
}

// Console errors that are framework noise rather than component bugs —
// each entry needs a comment naming the day it was observed and what fires
// it, or the allowlist quietly masks a real regression.
const KNOWN_NOISE: RegExp[] = [];

// Stories that deliberately exercise an error path — Chrome logs a console
// error for the failed condition itself (independent of whether the
// component handled it correctly), so excluding by id keeps that expected
// noise from masking a real, *unintended* error on some other story.
const INTENTIONAL_ERROR_STATE_STORIES = new Set<string>();

// A story's goto → finished → networkidle takes ~2s warm; the ceiling has
// to cover a cold vite compile plus a play chaining several 4s findBy waits
// (asyncUtilTimeout in .storybook/preview.tsx), so it must outlast a play's
// slowest legitimate run rather than reporting "never reached terminal" over
// a real error still in flight. It doubles as the suite's per-story pacing.
const PER_STORY_BUDGET_MS = 30_000;

/**
 * Visit one story's iframe and collect every unexpected console error or
 * uncaught exception from navigation until the story's render reaches a
 * terminal phase — so play-function failures count — plus a settle at
 * networkidle for requests the play itself fires.
 *
 * The render loop lives on `window.__STORYBOOK_PREVIEW__.storyRenders`
 * (one entry per render, `id` is the story id, `phase` walks
 * preparing → … → playing → completing → completed → afterEach → finished).
 * A play failure reaches the console via renderException's logger.error while
 * the phase is still heading to "finished", so waiting for the terminal phase
 * keeps the listeners attached through the play — `networkidle` alone fires
 * mid-play and lets a failed play go green. "completed" and "errored" are
 * transient and always continue to "finished"; "aborted" is the terminal for
 * a cancelled render.
 */
async function collectStoryConsoleErrors(
  page: Page,
  id: string,
): Promise<string[]> {
  const messages: string[] = [];
  const onConsole = (msg: { type(): string; text(): string }): void => {
    if (
      msg.type() === "error" &&
      !KNOWN_NOISE.some((noise) => noise.test(msg.text()))
    ) {
      messages.push(msg.text());
    }
  };
  const onPageError = (err: Error): void => {
    messages.push(err.message);
  };
  page.on("console", onConsole);
  page.on("pageerror", onPageError);

  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=story`);
  try {
    await page.waitForFunction(
      (storyId) => {
        const renders = (
          globalThis as typeof globalThis & {
            __STORYBOOK_PREVIEW__?: {
              storyRenders?: PreviewStoryRender[];
            };
          }
        ).__STORYBOOK_PREVIEW__?.storyRenders;
        const phase = renders?.find((r) => r.id === storyId)?.phase;
        return phase === "finished" || phase === "aborted";
      },
      id,
      { timeout: PER_STORY_BUDGET_MS },
    );
  } catch {
    messages.push(
      `render never reached a terminal phase within ${PER_STORY_BUDGET_MS}ms`,
    );
  }
  await page.waitForLoadState("networkidle");

  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return messages;
}

test.describe("storybook stories", () => {
  test("every story renders without an unexpected console error or uncaught exception", async ({
    page,
    request,
  }) => {
    const indexResponse = await request.get(`${STORYBOOK_URL}/index.json`);
    expect(indexResponse.ok()).toBe(true);
    const index = (await indexResponse.json()) as {
      entries: Record<string, StoryIndexEntry>;
    };
    const storyIds = Object.values(index.entries)
      .filter((entry) => entry.type === undefined || entry.type === "story")
      .map((entry) => entry.id);
    expect(storyIds.length).toBeGreaterThan(0);
    // One test visits every story, so its budget grows with the story
    // count rather than the fixed per-test timeout.
    test.setTimeout(30_000 + storyIds.length * PER_STORY_BUDGET_MS);

    // localStorage AND sessionStorage survive page.goto inside this one
    // context, and real plays write both (theme lives in localStorage, the
    // sidebar's desktop-open flag in sessionStorage) — a story that toggles
    // a persisted preference ends with state that changes how the next
    // story renders. A standalone visit starts on empty storage; clearing
    // on every navigation keeps the sweep equivalent to it.
    await page.addInitScript(() => {
      window.localStorage.clear();
      window.sessionStorage.clear();
    });

    const failuresByStory: string[] = [];

    for (const id of storyIds) {
      if (INTENTIONAL_ERROR_STATE_STORIES.has(id)) continue;
      const messages = await collectStoryConsoleErrors(page, id);
      if (messages.length > 0) {
        failuresByStory.push(`${id}: ${messages.join(" | ")}`);
      }
    }

    expect(failuresByStory).toEqual([]);
  });
});
