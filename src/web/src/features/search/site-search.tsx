import { Link } from "@tanstack/react-router";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Autocomplete } from "../../components/autocomplete";
import { usePageLanguage } from "../chrome/page-language";
import type {
  LoadPageSearchDocuments,
  PageIndexState,
  PageSearchResult,
} from "./types";
import { usePageIndex } from "./use-page-index";
import { useSearchShortcut } from "./use-search-shortcut";

/**
 * The sidebar's search box: typing lists the pages whose title, text or
 * keywords match, ranked, in place under the box; a click, or Enter on the
 * highlighted result (the first, until the arrows move it), opens the page.
 * `/` or ⌘K / Ctrl-K focuses the box after `onReveal` makes it visible;
 * Escape clears it, then leaves it. `onSearchingChange` reports when a
 * query starts and ends, so the host can hide what the results replace.
 * The documents load on first focus through `loadDocuments`; the box
 * searches those in the page's language, and follows their updates.
 *
 * @example
 * <SiteSearch loadDocuments={documents.load} onNavigate={closeDrawer} onReveal={openDrawer} onSearchingChange={setSearching} />
 */
export function SiteSearch({
  loadDocuments,
  onNavigate,
  onReveal,
  onSearchingChange,
}: {
  loadDocuments: LoadPageSearchDocuments;
  onNavigate: () => void;
  onReveal: () => void;
  onSearchingChange: (searching: boolean) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useSearchShortcut(inputRef, onReveal);
  const { query, searching, changeQuery } = useSearchQuery(onSearchingChange);
  const { state, prepare } = usePageIndex(loadDocuments, usePageLanguage());
  const results = useMemo(
    () =>
      state.status === "ready" && searching ? state.index.search(query) : [],
    [state, query, searching],
  );
  const open = (result: PageSearchResult) => {
    changeQuery("");
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
        onValueChange={changeQuery}
        itemToStringValue={(result: PageSearchResult) => result.title}
      >
        <Autocomplete.Input
          ref={inputRef}
          type="search"
          placeholder="Search"
          aria-label="Search pages"
          aria-keyshortcuts="/ Control+K Meta+K"
          onFocus={prepare}
          onKeyDown={(event) => {
            prepare();
            if (event.key === "Escape") escape(event, query, changeQuery);
          }}
          className="h-8 w-full rounded-md border border-input bg-field px-2 text-sm text-foreground placeholder:text-muted-foreground-faded"
        />
        <Autocomplete.Status className="px-2 pt-1.5 text-xs text-muted-foreground empty:hidden">
          {searching ? searchStatusMessage(state, results.length) : ""}
        </Autocomplete.Status>
        {searching && <SearchResults onOpen={open} />}
      </Autocomplete.Root>
    </div>
  );
}

/** The box's text, reporting each switch between empty and a query. */
function useSearchQuery(onSearchingChange: (searching: boolean) => void): {
  query: string;
  searching: boolean;
  changeQuery: (next: string) => void;
} {
  const [query, setQuery] = useState("");
  const searching = isQuery(query);
  const changeQuery = (next: string) => {
    if (isQuery(next) !== searching) onSearchingChange(!searching);
    setQuery(next);
  };
  return { query, searching, changeQuery };
}

function isQuery(value: string): boolean {
  return value.trim() !== "";
}

/**
 * Escape with a query clears it and stops there, so a drawer listening for
 * Escape stays open; on an empty box it leaves the box and lets the key
 * through.
 */
function escape(
  event: KeyboardEvent<HTMLInputElement>,
  query: string,
  changeQuery: (next: string) => void,
) {
  if (query === "") {
    event.currentTarget.blur();
    return;
  }
  event.stopPropagation();
  changeQuery("");
}

function SearchResults({
  onOpen,
}: {
  onOpen: (result: PageSearchResult) => void;
}) {
  return (
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
  );
}

function searchStatusMessage(state: PageIndexState, count: number): string {
  if (state.status === "failed") return "Search is unavailable";
  if (state.status !== "ready") return "Loading…";
  if (count === 0) return "No results";
  return `${count.toLocaleString("en-US")} result${count === 1 ? "" : "s"}`;
}
