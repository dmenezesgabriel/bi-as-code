import type { LoadPageSearchDocuments, PageSearchDocument } from "./types";

/**
 * Three pages shaped like the example project's: two whose title holds
 * "weekly" and one whose text alone does, plus "fulfilment" in that one.
 */
export const SAMPLE_SEARCH_PAGES: readonly PageSearchDocument[] = [
  {
    id: "/weekly-orders",
    title: "Weekly orders",
    text: "Orders by week.",
    keywords: "",
  },
  {
    id: "/weekly-review",
    title: "Weekly review",
    text: "Takeaways for the week.",
    keywords: "",
  },
  {
    id: "/nested/allocation",
    title: "Allocation",
    text: "How the weekly order volume splits across fulfilment channels.",
    keywords: "",
  },
];

/**
 * In-memory stand-in for the lazily imported `virtual:biac-search` module.
 * It serves `documents` once `release()` is called, or straight away when
 * built with `{ held: false }`, and counts how often it was asked. `fail`
 * makes the pending load reject, the way a failed chunk request does.
 *
 * @example
 * const documents = new FakeSearchDocuments([{ id: "/", title: "Home", text: "", keywords: "" }]);
 * render(<SiteSearch loadDocuments={documents.load} onNavigate={() => {}} />);
 * documents.release();
 */
export class FakeSearchDocuments {
  loadCount = 0;
  private settle: { resolve: () => void; reject: (error: Error) => void };
  private readonly gate: Promise<void>;

  constructor(
    private readonly documents: readonly PageSearchDocument[],
    { held = true }: { held?: boolean } = {},
  ) {
    let settle = { resolve: () => {}, reject: (_error: Error) => {} };
    this.gate = new Promise<void>((resolve, reject) => {
      settle = { resolve, reject };
    });
    this.settle = settle;
    if (!held) settle.resolve();
  }

  readonly load: LoadPageSearchDocuments = async () => {
    this.loadCount += 1;
    await this.gate;
    return this.documents;
  };

  release(): void {
    this.settle.resolve();
  }

  fail(): void {
    this.settle.reject(
      new Error("Failed to fetch dynamically imported module"),
    );
  }
}
