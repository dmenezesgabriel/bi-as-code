import { Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Autocomplete } from "../../components/autocomplete";
import type {
  LoadPageSearchDocuments,
  PageIndexState,
  PageSearchResult,
} from "./types";
import { usePageIndex } from "./use-page-index";

/**
 * The sidebar's search box: typing lists the pages whose title, text or
 * keywords match, ranked, in place under the box; a click, or Enter on the
 * highlighted result (the first, until the arrows move it), opens the page.
 * The documents load on first focus through `loadDocuments`.
 *
 * @example
 * <SiteSearch loadDocuments={() => import("virtual:biac-search").then((m) => m.documents)} onNavigate={closeDrawer} />
 */
export function SiteSearch({
  loadDocuments,
  onNavigate,
}: {
  loadDocuments: LoadPageSearchDocuments;
  onNavigate: () => void;
}) {
  const [query, setQuery] = useState("");
  const { state, prepare } = usePageIndex(loadDocuments);
  const searching = query.trim() !== "";
  const results = useMemo(
    () =>
      state.status === "ready" && searching ? state.index.search(query) : [],
    [state, query, searching],
  );
  const open = (result: PageSearchResult) => {
    setQuery("");
    onNavigate();
    return result;
  };

  return (
    <div className="px-3 pb-2">
      <Autocomplete.Root
        inline
        open={searching}
        mode="none"
        autoHighlight="always"
        items={results}
        value={query}
        onValueChange={setQuery}
        itemToStringValue={(result: PageSearchResult) => result.title}
      >
        <Autocomplete.Input
          type="search"
          placeholder="Search"
          aria-label="Search pages"
          onFocus={prepare}
          onKeyDown={prepare}
          className="h-8 w-full rounded-md border border-input bg-field px-2 text-sm text-foreground placeholder:text-muted-foreground-faded"
        />
        {searching && <SearchResults state={state} onOpen={open} />}
      </Autocomplete.Root>
    </div>
  );
}

function SearchResults({
  state,
  onOpen,
}: {
  state: PageIndexState;
  onOpen: (result: PageSearchResult) => void;
}) {
  return (
    <>
      <Autocomplete.Empty className="px-2 py-1.5 text-sm text-muted-foreground empty:hidden">
        {emptyMessage(state)}
      </Autocomplete.Empty>
      <Autocomplete.List className="mt-1 empty:hidden">
        {(result: PageSearchResult) => (
          <Autocomplete.Item
            key={result.id}
            value={result}
            render={<Link to={result.id} onClick={() => onOpen(result)} />}
            className="block rounded-sm px-2 py-1.5 text-sm text-muted-foreground data-highlighted:bg-accent data-highlighted:text-accent-foreground"
          >
            {result.title}
          </Autocomplete.Item>
        )}
      </Autocomplete.List>
    </>
  );
}

function emptyMessage(state: PageIndexState): string {
  if (state.status === "failed") return "Search is unavailable";
  if (state.status === "ready") return "No results";
  return "Loading…";
}
