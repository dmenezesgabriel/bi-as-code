import { useCallback, useRef, useState } from "react";
import type { LoadPageSearchDocuments, PageIndexState } from "./types";

/**
 * The site-search index, built the first time `prepare` is called — on the
 * box's first focus — so a reader who never searches never downloads the
 * documents or the search library: both are dynamic imports, their own
 * chunks in a build. Later calls are no-ops.
 *
 * @example
 * const { state, prepare } = usePageIndex(loadDocuments);
 * <input onFocus={prepare} />
 */
export function usePageIndex(load: LoadPageSearchDocuments): {
  state: PageIndexState;
  prepare: () => void;
} {
  const [state, setState] = useState<PageIndexState>({ status: "idle" });
  const requested = useRef(false);
  const prepare = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    setState({ status: "loading" });
    Promise.all([load(), import("./page-index")]).then(
      ([documents, { buildPageIndex }]) =>
        setState({ status: "ready", index: buildPageIndex(documents) }),
      () => setState({ status: "failed" }),
    );
  }, [load]);
  return { state, prepare };
}
