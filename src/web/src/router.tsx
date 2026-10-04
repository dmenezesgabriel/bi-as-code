import { pages, navTree } from "virtual:biac-pages";
import { config } from "virtual:biac-config";
import { buildPageRouter } from "./features/pages/page-router";

export const router = buildPageRouter(pages, config, navTree);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
