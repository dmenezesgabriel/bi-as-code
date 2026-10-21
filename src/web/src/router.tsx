import { pages, navTree, subscribePageUpdates } from "virtual:biac-pages";
import { config } from "virtual:biac-config";
import { getLanguages, subscribeLanguages } from "virtual:biac-languages";
import { pageSourceClient } from "./features/editor/page-source-client";
import { hmrDataUpdates } from "./features/pages/data-updates";
import { buildPageRouter } from "./features/pages/page-router";

// Only the dev server mounts the page-source endpoint, and only the dev
// server defines `import.meta.hot`; every build folds this to `undefined`
// whatever NODE_ENV says, so `?edit` is inert there.
const pageSource = import.meta.hot
  ? pageSourceClient((url, init) => fetch(url, init))
  : undefined;
const dataUpdates = import.meta.hot
  ? hmrDataUpdates(import.meta.hot)
  : undefined;

export const router = buildPageRouter(
  pages,
  config,
  navTree,
  undefined,
  pageSource,
  dataUpdates,
  { get: getLanguages, subscribe: subscribeLanguages },
);

// A hot-swapped page re-runs the matched route's loader, which now resolves
// to the new module — the page re-renders in place, URL and app state kept.
subscribePageUpdates(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
