import { pages, navTree, subscribePageUpdates } from "virtual:biac-pages";
import { config } from "virtual:biac-config";
import { pageSourceClient } from "./features/editor/page-source-client";
import { buildPageRouter } from "./features/pages/page-router";

// Only the dev server mounts the page-source endpoint, and only the dev
// server defines `import.meta.hot`; every build folds this to `undefined`
// whatever NODE_ENV says, so `?edit` is inert there.
const pageSource = import.meta.hot
  ? pageSourceClient((url, init) => fetch(url, init))
  : undefined;

export const router = buildPageRouter(
  pages,
  config,
  navTree,
  undefined,
  pageSource,
);

// A hot-swapped page re-runs the matched route's loader, which now resolves
// to the new module — the page re-renders in place, URL and app state kept.
subscribePageUpdates(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
