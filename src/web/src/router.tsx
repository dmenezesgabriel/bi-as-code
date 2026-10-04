import { pages } from "virtual:biac-pages";
import { buildPageRouter } from "./features/pages/page-router";

export const router = buildPageRouter(pages);

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
