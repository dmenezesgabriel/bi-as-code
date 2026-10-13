import { html } from "@codemirror/lang-html";
import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import type { Language } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

const SQL_LANGUAGE = sql().language;

/**
 * Pages are MDX, where `/>` closes any component, but lang-html's default
 * dialect is plain HTML, where it closes nothing: typing
 * `<Table data="orders" />` got a `</Table>` appended, which then failed
 * the page compile. `selfClosingTags` parses `/>` the JSX way, so only a
 * tag left open is auto-closed. Passing our own tag language replaces
 * lang-markdown's default wholesale, so its `matchClosingTags: false` is
 * restated here.
 * https://github.com/codemirror/lang-html#readme
 */
const PAGE_TAG_LANGUAGE = html({
  matchClosingTags: false,
  selfClosingTags: true,
});

/**
 * A page fence's info string is `<lang> <name>` (```` ```sql orders ````),
 * so only its first word picks the nested language.
 */
function fenceLanguage(info: string): Language | null {
  return info.trim().split(/\s+/)[0] === "sql" ? SQL_LANGUAGE : null;
}

/**
 * Markdown highlighting for a page source, with the bodies of `sql`
 * fences parsed (and so highlighted) as SQL, and widget tags closed the
 * JSX way: `<Details title="x">` gains `</Details>`, `<Table … />` stays.
 *
 * @example
 * new EditorView({ extensions: [basicSetup, pageSourceLanguage()] });
 */
export function pageSourceLanguage(): Extension {
  return markdown({
    codeLanguages: fenceLanguage,
    htmlTagLanguage: PAGE_TAG_LANGUAGE,
  });
}
