import type {
  LoadPageSearchDocuments,
  PageSearchDocument,
  PageSearchSource,
} from "./types";

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
 * `byLanguage` holds other languages' documents; `documents` answers for
 * any other. `update` swaps `documents` the way a dev hot update does.
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
  private readonly listeners = new Set<() => void>();
  private readonly byLanguage: Readonly<
    Record<string, readonly PageSearchDocument[]>
  >;

  constructor(
    private documents: readonly PageSearchDocument[],
    {
      held = true,
      byLanguage = {},
    }: {
      held?: boolean;
      byLanguage?: Readonly<Record<string, readonly PageSearchDocument[]>>;
    } = {},
  ) {
    this.byLanguage = byLanguage;
    let settle = { resolve: () => {}, reject: (_error: Error) => {} };
    this.gate = new Promise<void>((resolve, reject) => {
      settle = { resolve, reject };
    });
    this.settle = settle;
    if (!held) settle.resolve();
  }

  private readonly source: PageSearchSource = {
    documentsFor: (language) =>
      language !== undefined && Object.hasOwn(this.byLanguage, language)
        ? this.byLanguage[language]!
        : this.documents,
    subscribe: (listener) => {
      this.listeners.add(listener);
      return () => void this.listeners.delete(listener);
    },
  };

  readonly load: LoadPageSearchDocuments = async () => {
    this.loadCount += 1;
    await this.gate;
    return this.source;
  };

  release(): void {
    this.settle.resolve();
  }

  fail(): void {
    this.settle.reject(
      new Error("Failed to fetch dynamically imported module"),
    );
  }

  update(documents: readonly PageSearchDocument[]): void {
    this.documents = documents;
    this.listeners.forEach((listener) => listener());
  }
}
