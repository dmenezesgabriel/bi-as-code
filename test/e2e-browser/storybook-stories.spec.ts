import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

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

// The settle window for requests a render fires late. A docs page that embeds
// many `inline: false` story iframes can leave Playwright's page-level
// `networkidle` unresolved for good: measured, `search-sitesearch--docs` (10
// nested iframes) never resolved it in 40 s while Chromium's own lifecycle
// events reported networkIdle for the main frame and every child, and CDP
// listed 0 requests in flight. Cold, the slowest page that does resolve took
// 12.8 s (`pages-themes-and-brand--docs`), so the ceiling clears that.
const SETTLE_BUDGET_MS = 15_000;

/**
 * Wait for the network to go quiet, but never longer than `SETTLE_BUDGET_MS`:
 * the settle only widens the window in which a late request's console error
 * is caught, so running out of window is not a failure of the page.
 */
async function settleNetwork(page: Page): Promise<void> {
  await page
    .waitForLoadState("networkidle", { timeout: SETTLE_BUDGET_MS })
    .catch(() => undefined);
}

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
  return collectConsoleErrorsDuring(page, (messages) =>
    visitStory(page, id, messages),
  );
}

/** Every unexpected console error or uncaught exception `visit` provokes. */
async function collectConsoleErrorsDuring(
  page: Page,
  visit: (messages: string[]) => Promise<void>,
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
  await visit(messages);
  page.off("console", onConsole);
  page.off("pageerror", onPageError);
  return messages;
}

async function visitStory(
  page: Page,
  id: string,
  messages: string[],
): Promise<void> {
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
  await settleNetwork(page);
}

/**
 * Visit one MDX docs page's iframe until its content has rendered and its
 * embedded stories have settled. Docs pages have no render phase to wait
 * on: addon-docs mounts `.sbdocs-content` once the MDX module and every
 * story it imports resolved, so a broken import never draws it. A canvas
 * with `inline: false` is a nested story iframe, and its console reaches
 * this page too, so its play runs here a second time — in a frame that is
 * never the focused document, which a focus-asserting play cannot pass.
 */
async function visitDocsPage(
  page: Page,
  id: string,
  messages: string[],
): Promise<void> {
  await page.goto(`${STORYBOOK_URL}/iframe.html?id=${id}&viewMode=docs`);
  try {
    await page
      .locator(".sbdocs-content h1")
      .first()
      .waitFor({ timeout: PER_STORY_BUDGET_MS });
  } catch {
    messages.push(
      `docs content never rendered within ${PER_STORY_BUDGET_MS}ms`,
    );
  }
  await settleNetwork(page);
  const rawTableRows = await countRawTablePipeParagraphs(page);
  if (rawTableRows > 0) {
    messages.push(`raw GFM table pipes in ${rawTableRows} paragraph(s)`);
  }
}

/**
 * Paragraphs on a docs page that are a Markdown table row printed as text.
 * MDX has no GFM tables unless addon-docs is handed `remark-gfm`; without
 * it a `| a | b |` table lands in a `<p>` instead of a `<table>`.
 */
async function countRawTablePipeParagraphs(page: Page): Promise<number> {
  return page
    .locator(".sbdocs-content p")
    .evaluateAll(
      (paragraphs) =>
        paragraphs.filter((paragraph) =>
          /^\|.*\|/.test((paragraph.textContent ?? "").trim()),
        ).length,
    );
}

/** The index entries of one `type`, by id. */
async function indexEntryIds(
  request: APIRequestContext,
  type: "story" | "docs",
): Promise<string[]> {
  const indexResponse = await request.get(`${STORYBOOK_URL}/index.json`);
  expect(indexResponse.ok()).toBe(true);
  const index = (await indexResponse.json()) as {
    entries: Record<string, StoryIndexEntry>;
  };
  return Object.values(index.entries)
    .filter((entry) => (entry.type ?? "story") === type)
    .map((entry) => entry.id);
}

test.describe("storybook stories", () => {
  test("every story renders without an unexpected console error or uncaught exception", async ({
    page,
    request,
  }) => {
    const storyIds = await indexEntryIds(request, "story");
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

  test("every MDX docs page renders without an unexpected console error or uncaught exception", async ({
    page,
    request,
  }) => {
    const docsIds = await indexEntryIds(request, "docs");
    expect(docsIds.length).toBeGreaterThan(0);
    test.setTimeout(30_000 + docsIds.length * PER_STORY_BUDGET_MS);

    const failuresByPage: string[] = [];
    for (const id of docsIds) {
      const messages = await collectConsoleErrorsDuring(page, (sink) =>
        visitDocsPage(page, id, sink),
      );
      if (messages.length > 0) {
        failuresByPage.push(`${id}: ${messages.join(" | ")}`);
      }
    }

    expect(failuresByPage).toEqual([]);
  });
});
