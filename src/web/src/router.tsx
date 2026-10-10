import { pages, navTree, subscribePageUpdates } from "virtual:biac-pages";
import { config } from "virtual:biac-config";
import { buildPageRouter } from "./features/pages/page-router";

export const router = buildPageRouter(pages, config, navTree);

// A hot-swapped page re-runs the matched route's loader, which now resolves
// to the new module — the page re-renders in place, URL and app state kept.
subscribePageUpdates(() => void router.invalidate());

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
