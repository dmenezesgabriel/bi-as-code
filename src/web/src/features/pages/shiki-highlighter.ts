import {
  bundledLanguages,
  createHighlighter,
  createJavaScriptRegexEngine,
  type BundledLanguage,
} from "shiki";

const THEME = "github-light";

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;
const failedLanguages = new Set<string>();

/**
 * The JS engine, not oniguruma: the wasm engine fetches `shiki/onig.wasm`
 * at runtime — jsdom can't serve that fetch in tests and the SPA would
 * ship a wasm asset. The JS engine transpiles the same TextMate grammars
 * to native RegExp, so one code path runs everywhere. `forgiving` keeps
 * a grammar with an unconvertible pattern on best-effort tokens instead
 * of throwing mid-render.
 */
function getHighlighter(): ReturnType<typeof createHighlighter> {
  highlighterPromise ??= createHighlighter({
    themes: [THEME],
    langs: ["sql"],
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}

/**
 * Highlights one fenced code block, lazy-loading any bundled language on
 * first use. Returns null when `lang` isn't a shiki language or fails to
 * load — the caller renders the fence unhighlighted. A failed language is
 * remembered so a broken grammar costs one lookup, not one per fence.
 *
 * @example
 * const html = await highlightFence("sql", "select 1");
 * // html → '<pre class="shiki github-light" ...>…</pre>' or null
 */
export async function highlightFence(
  lang: string,
  code: string,
): Promise<string | null> {
  if (!(lang in bundledLanguages) || failedLanguages.has(lang)) {
    return null;
  }
  try {
    const highlighter = await getHighlighter();
    const bundled = lang as BundledLanguage;
    if (!highlighter.getLoadedLanguages().includes(bundled)) {
      await highlighter.loadLanguage(bundled);
    }
    return highlighter.codeToHtml(code, { lang: bundled, theme: THEME });
  } catch {
    failedLanguages.add(lang);
    return null;
  }
}
