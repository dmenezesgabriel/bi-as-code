import {
  useEffect,
  useReducer,
  useState,
  type Dispatch,
  type ReactElement,
  type ReactNode,
} from "react";
import { CodeEditor } from "./code-editor";
import { nextEditorStatus } from "./editor-status";
import type { EditorStatus, EditorStatusEvent, PageSourcePort } from "./types";

type PageEditorProps = {
  /** The page's project-relative file, e.g. "pages/weekly-review.md". */
  file: string;
  port: PageSourcePort;
  /** The live rendered page — hot-swapped in place after every save. */
  children: ReactNode;
};

/**
 * Split-pane page authoring: the page's source on the left, the live page
 * on the right (stacked below `lg`). `Mod-s` writes the buffer to disk and
 * the dev server's hot update re-renders the preview; the editor keeps its
 * own buffer throughout, so cursor and scroll survive every save.
 *
 * @example
 * <PageEditor file="pages/weekly-review.md" port={pageSourceClient(fetch)}>
 *   <MarkdownPage page={mod} siteTitle={site.title} />
 * </PageEditor>
 */
export function PageEditor({
  file,
  port,
  children,
}: PageEditorProps): ReactElement {
  return (
    // One row pinned to the viewport below the 3rem header: an `auto` row
    // would grow to the page's length and scroll the whole document.
    <div className="grid lg:h-[calc(100vh-3rem)] lg:grid-cols-2 lg:grid-rows-[minmax(0,1fr)]">
      <section
        aria-label="Source editor"
        className="flex h-[60vh] min-w-0 flex-col border-b border-neutral-200 lg:h-full lg:border-r lg:border-b-0 dark:border-neutral-800"
      >
        <SourcePane file={file} port={port} />
      </section>
      {/* From `lg` the pane scrolls on its own with no header above it, so
          sticky page chrome docks near its top edge instead of 4rem down.
          Stacked, the window scrolls under the header and the default holds. */}
      <section
        aria-label="Live preview"
        className="min-w-0 lg:[--dock-top:1rem] lg:overflow-y-auto"
      >
        {children}
      </section>
    </div>
  );
}

function SourcePane({ file, port }: Omit<PageEditorProps, "children">) {
  const [status, dispatch] = useReducer(nextEditorStatus, { kind: "loading" });
  const source = useInitialSource(file, port, dispatch);
  async function save(doc: string) {
    dispatch({ type: "saveStarted" });
    try {
      await port.save(file, doc);
      dispatch({ type: "saveSucceeded" });
    } catch (error) {
      dispatch({ type: "saveFailed", message: errorMessage(error) });
    }
  }
  return (
    <>
      <div className="flex h-9 shrink-0 items-center justify-between gap-4 border-b border-neutral-200 px-4 text-sm dark:border-neutral-800">
        <code className="truncate text-neutral-600 dark:text-neutral-400">
          {file}
        </code>
        <p role="status" className="shrink-0">
          {statusText(status)}
        </p>
      </div>
      <div className="min-h-0 flex-1">
        {source !== null && (
          <CodeEditor
            doc={source}
            label="Page source"
            onChange={() => dispatch({ type: "edited" })}
            onSave={(doc) => void save(doc)}
          />
        )}
      </div>
    </>
  );
}

/** Reads the source once per file; a later read would clobber the buffer. */
function useInitialSource(
  file: string,
  port: PageSourcePort,
  dispatch: Dispatch<EditorStatusEvent>,
): string | null {
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    let current = true;
    port.read(file).then(
      (text) => {
        if (!current) return;
        setSource(text);
        dispatch({ type: "loaded" });
      },
      (error: unknown) => {
        if (!current) return;
        dispatch({ type: "loadFailed", message: errorMessage(error) });
      },
    );
    return () => {
      current = false;
    };
  }, [file, port, dispatch]);
  return source;
}

function statusText(status: EditorStatus): string {
  switch (status.kind) {
    case "loading":
      return "Loading source…";
    case "clean":
      return "No unsaved changes";
    case "dirty":
      return "Unsaved changes";
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "loadFailed":
    case "saveFailed":
      return status.message;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
