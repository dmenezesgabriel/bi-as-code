import { markdown } from "@codemirror/lang-markdown";
import { sql } from "@codemirror/lang-sql";
import type { Language } from "@codemirror/language";
import type { Extension } from "@codemirror/state";

const SQL_LANGUAGE = sql().language;

/**
 * A page fence's info string is `<lang> <name>` (```` ```sql orders ````),
 * so only its first word picks the nested language.
 */
function fenceLanguage(info: string): Language | null {
  return info.trim().split(/\s+/)[0] === "sql" ? SQL_LANGUAGE : null;
}

/**
 * Markdown highlighting for a page source, with the bodies of `sql`
 * fences parsed (and so highlighted) as SQL.
 *
 * @example
 * new EditorView({ extensions: [basicSetup, pageSourceLanguage()] });
 */
export function pageSourceLanguage(): Extension {
  return markdown({ codeLanguages: fenceLanguage });
}
