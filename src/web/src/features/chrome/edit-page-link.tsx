import { Link, useMatches, useSearch } from "@tanstack/react-router";
import { isEditSearch } from "../editor/edit-search";

type PageSearch = Record<string, unknown>;

const LINK_CLASS =
  "ml-2 rounded px-2 py-1 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground";

/**
 * Header toggle between a page and its source editor: `Edit` adds the
 * `edit` flag to the page's own URL (filters kept), `Done` removes only the
 * flag. Renders nothing off a page route — the not-found page has no
 * source to edit. The shell mounts it only under `biac dev`.
 *
 * @example
 * {editable && <EditPageLink />}
 */
export function EditPageLink() {
  const onPage = useMatches({ select: (matches) => matches.length > 1 });
  const editing = isEditSearch(useSearch({ strict: false }));
  if (!onPage) return null;
  if (editing) {
    return (
      <Link
        to="."
        search={({ edit: _edit, ...rest }: PageSearch) => rest}
        className={LINK_CLASS}
      >
        Done
      </Link>
    );
  }
  return (
    <Link
      to="."
      search={(prev: PageSearch) => ({ ...prev, edit: true })}
      className={LINK_CLASS}
    >
      Edit
    </Link>
  );
}
