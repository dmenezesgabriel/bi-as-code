import {
  bundledLanguages,
  createHighlighter,
  createCssVariablesTheme,
  createJavaScriptRegexEngine,
  type BundledLanguage,
} from "shiki";

// One css-variables theme: shiki paints every token as
// `color: var(--shiki-token-*)` and the fence as `var(--shiki-background)`,
// and styles.css defines those per mode beside the other theme tokens
// (ADR-0014). The values are chosen to read at 4.5:1 (WCAG 1.4.3) on the
// `--muted` fence surface, which github-light's comment (4.42:1) and
// keyword (4.20:1) colours did not.
const TOKEN_THEME = createCssVariablesTheme({
  name: "biac-tokens",
  variablePrefix: "--shiki-",
});

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
    themes: [TOKEN_THEME],
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
 * // html → '<pre class="shiki biac-tokens" style="background-color:var(--shiki-background)…' or null
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
    return highlighter.codeToHtml(code, { lang: bundled, theme: TOKEN_THEME });
  } catch {
    failedLanguages.add(lang);
    return null;
  }
}
