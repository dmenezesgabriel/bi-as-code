import {
  useCallback,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  LoadPageSearchDocuments,
  PageIndex,
  PageIndexState,
  PageSearchDocument,
  PageSearchSource,
} from "./types";

/** The documents and the index builder, once both have loaded. */
type LoadedSearch =
  | { readonly status: "idle" | "loading" | "failed" }
  | {
      readonly status: "ready";
      readonly source: PageSearchSource;
      readonly build: (documents: readonly PageSearchDocument[]) => PageIndex;
    };

/**
 * The site-search index over `language`'s documents, built the first time
 * `prepare` is called — on the box's first focus — so a reader who never
 * searches never downloads the documents or the search library: both are
 * dynamic imports, their own chunks in a build. Later calls are no-ops.
 * The index rebuilds when the language changes or the documents update.
 *
 * @example
 * const { state, prepare } = usePageIndex(loadDocuments, "fr");
 * <input onFocus={prepare} />
 */
export function usePageIndex(
  load: LoadPageSearchDocuments,
  language: string | undefined,
): { state: PageIndexState; prepare: () => void } {
  const { loaded, prepare } = useLoadedSearch(load);
  const source = loaded.status === "ready" ? loaded.source : undefined;
  const documents = useSourceDocuments(source, language);
  const state = useMemo<PageIndexState>(() => {
    if (loaded.status !== "ready") return loaded;
    // Defined once ready: the source is what `documents` was read from.
    return { status: "ready", index: loaded.build(documents ?? []) };
  }, [loaded, documents]);
  return { state, prepare };
}

function useLoadedSearch(load: LoadPageSearchDocuments): {
  loaded: LoadedSearch;
  prepare: () => void;
} {
  const [loaded, setLoaded] = useState<LoadedSearch>({ status: "idle" });
  const requested = useRef(false);
  const prepare = useCallback(() => {
    if (requested.current) return;
    requested.current = true;
    setLoaded({ status: "loading" });
    Promise.all([load(), import("./page-index")]).then(
      ([source, { buildPageIndex }]) =>
        setLoaded({ status: "ready", source, build: buildPageIndex }),
      () => setLoaded({ status: "failed" }),
    );
  }, [load]);
  return { loaded, prepare };
}

const NO_SUBSCRIPTION = () => () => {};

/** `language`'s documents, re-read whenever the source reports an update. */
function useSourceDocuments(
  source: PageSearchSource | undefined,
  language: string | undefined,
): readonly PageSearchDocument[] | undefined {
  return useSyncExternalStore(source?.subscribe ?? NO_SUBSCRIPTION, () =>
    source?.documentsFor(language),
  );
}
