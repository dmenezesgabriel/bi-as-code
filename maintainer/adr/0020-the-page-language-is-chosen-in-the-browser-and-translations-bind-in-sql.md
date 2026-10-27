# ADR-0020 — The page language is chosen in the browser, and a translation in SQL is a bound value

Status: accepted
Date: 2026-10-21

## Context

A project declares its page text per language in `translations.yaml` at its root: ISO 639-1 codes as top-level keys, i18next-shaped values (https://www.i18next.com/translation-function/nesting). The engine reads and validates it (`src/engine/translations-file.ts`), resolves every declared language at build time — `en` merged under the language's own keys, `$t()` references expanded (`src/engine/resolve-translations.ts`) — and serves the resolved maps as `virtual:biac-translations` (`src/engine/translations-module.ts`). A page writes `{$translations.key}` in text and attributes and `{{$translations.key}}` in SQL.

Three choices remained: where the reader's language is decided, how a translation enters a query, and what the document declares as its language.

`biac build` emits a folder of static files with no server ([ADR-0008](0008-static-build-is-a-spa-folder.md)), so nothing can read a request's cookie or `Accept-Language` before the page is sent. Queries run in the browser in DuckDB-WASM ([ADR-0005](0005-queries-run-client-side-in-duckdb-wasm.md)), and `{{params.x}}` is already bound as a `?` argument (`src/web/src/features/pages/interpolate.ts`). WCAG 2.2 SC 3.1.1 Language of Page (Level A) requires the page's language to be programmatically determinable (https://www.w3.org/TR/WCAG22/#language-of-page).

## Decision drivers

- `biac dev` and a static build choose the same language for the same URL and browser.
- A shared link shows the language it was copied in.
- A reader's pick follows them to a new tab.
- A translated value in SQL cannot break or inject into the query, apostrophes included.
- Assistive technology reads the page in the language it is shown in.
- A broken `translations.yaml` fails only the pages that read it, at a located line.

## Options considered

| Option                                                                      | Pro                                                     | Con                                                                                             |
| --------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Server chooses from `?lang=` then a `lang` cookie                           | One decision before render                              | No server in a static build                                                                     |
| Browser chooses from `?lang=`, then `localStorage`, then the first declared | Same in dev and build; a link carries its language      | The first paint before React mounts declares `index.html`'s `lang`                              |
| Browser follows `navigator.language`                                        | No pick needed                                          | A reader on a shared machine cannot override it without a menu anyway; a link does not carry it |
| Splice the translation into SQL as text, with an escaping accessor          | A translation can name a column (`label_{{…langcode}}`) | Authors must remember the accessor; a missed one is an injection or a syntax error on `l'Ouest` |
| Bind the translation as a `?` argument                                      | Injection-safe; no accessor to remember                 | A bound value is never an identifier, so a column chosen by language is written as a `case`     |
| Keep `<html lang>` fixed                                                    | Nothing to do                                           | Fails SC 3.1.1 for every non-first language                                                     |

## Decision

The browser chooses the language: `?lang=` when it names a declared language, else the reader's last menu pick in `localStorage` under `biac.lang`, else the first language the file declares (`resolveLanguage` in `src/web/src/features/chrome/language.ts`). A header menu lists every declared language by its own name (`Intl.DisplayNames`) with the current one checked, and is hidden below two languages (`src/web/src/features/chrome/language-menu.tsx`). A pick is stored and written to the URL's `lang`, replacing the history entry and keeping every other search key (`useLanguage` in `src/web/src/features/chrome/use-language.ts`). `<html lang>` follows the chosen language. `lang` is a reserved filter id beside `edit`, rejected at compile time (`src/engine/reserved-filter-id.ts`) and at run time for computed ids (`src/web/src/features/filters/reserved-search-keys.ts`).

`{{$translations.key}}` in a SQL fence or `queries/*.sql` binds the key's text in the chosen language as a `?` argument; there is no accessor that splices it as SQL text.

The shell reads the declared languages from their own module, `virtual:biac-languages` (`src/engine/languages-module.ts`), never from `virtual:biac-translations`. That module serves an empty list while the file is broken, so only the pages that read the file show its located error; in dev it accepts its own updates and keeps its list in `import.meta.hot.data`, so a saved file updates the menu and the default language without a reload.

## Consequences

- A static build needs no server-side language logic: the same `?lang=` link and the same stored pick give the same page in `biac dev` and `biac preview`.
- A `?lang=` link applies to the page it opens; only a menu pick is stored. A reader who arrives on a French link and follows a sidebar link sees their stored or default language, not French.
- Until React mounts, `<html lang>` is `index.html`'s `en`. A pre-paint inline script, like the theme's, is where to set it earlier if that window matters.
- A column chosen by language is written `case {{$translations.langcode}} when 'fr' then label_fr else label_en end`, not `label_{{$translations.langcode}}`. A future reader will be tempted to add a splicing accessor for that. Don't: the `case` costs one line, and a splice brings back the escaping rule binding removed.
- A page filter cannot be named `lang` or `edit`.
- Number and date formats do not follow the language; `LOCALE` in `src/web/src/features/widgets/value/format.ts` stays `en-US`.
